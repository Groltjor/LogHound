"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CircleDot,
  Crosshair,
  Globe2,
  Route,
  Search,
  Timer,
} from "lucide-react";
import * as THREE from "three";
import { listLogHoundAgentRules } from "./contramedidas/actions/firewallRuleActions";
import SelectionPanel from "./contramedidas/SelectionPanel";
import SpaceMenu from "./dashboards/menu/SpaceMenu";
import SecurityResourcesMenu from "./security/SecurityResourcesMenu";
import { formatMs, formatNumber } from "./utils/formatters";

const ENDPOINT = process.env.NEXT_PUBLIC_ML_TRAFFIC_ENDPOINT || "/data/predictions.json";
const LABEL_COLORS = ["#38bdf8", "#fb7185", "#34d399", "#a78bfa", "#fbbf24", "#22d3ee"];
const LABEL_PROFILES = {
  0: {
    name: "Visitas casi aisladas",
    pattern: "Baja repeticion",
    reading: "Trafico de baja repeticion; mezcla de requests unicos y grupos minimos.",
  },
  1: {
    name: "Alto volumen sostenido",
    pattern: "Crawler agresivo",
    reading: "Candidato fuerte a crawler agresivo o agente automatizado con muchas rutas visitadas.",
  },
  2: {
    name: "Burst rapido",
    pattern: "Varias requests juntas",
    reading: "Varias requests con separacion muy corta; util para detectar actividad concentrada.",
  },
  3: {
    name: "Bajo volumen con pausa larga",
    pattern: "Pocas requests espaciadas",
    reading: "Pocas requests repartidas en una ventana amplia; comportamiento menos agresivo.",
  },
};
const METRICS = [
  { id: "requests", label: "Requests" },
  { id: "routes", label: "Rutas" },
  { id: "window", label: "Ventana" },
];
const LAYER_TRANSITION_COMMIT_MS = 430;
const LAYER_TRANSITION_TOTAL_MS = 780;
const BOOT_MESSAGES = [
  "Inicializando terminal",
  "Cargando clusters",
  "Organizando grupos",
  "Identificando patrones",
  "Cargando terminal",
  "Armando espacio tactico",
  "Servicios online",
];
const BOOT_STEP_MS = 420;

function dedupeRules(rules) {
  const seen = new Set();
  return rules.filter((rule) => {
    const key = `${rule.action}-${rule.operator}-${rule.conditionValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ruleMatchesUserAgent(rule, userAgent) {
  if (!rule?.conditionValue || !userAgent) return false;
  if (rule.operator === "contains") return userAgent.includes(rule.conditionValue);
  return userAgent === rule.conditionValue;
}

function getAppliedRulesForUserAgent(rules, userAgent) {
  return dedupeRules(rules.filter((rule) => ruleMatchesUserAgent(rule, userAgent)));
}

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getLabelProfile(label) {
  return (
    LABEL_PROFILES[String(label)] || {
      name: `Label ${label}`,
      pattern: "Patron sin clasificar",
      reading: "Cluster pendiente de interpretacion.",
    }
  );
}

function compactUserAgent(userAgent) {
  if (!userAgent) return "Unknown agent";

  const lower = userAgent.toLowerCase();
  const knownAgents = [
    ["oai-searchbot", "OAI SearchBot"],
    ["chatgpt-user", "ChatGPT User"],
    ["gptbot", "GPTBot"],
    ["googlebot", "Googlebot"],
    ["bingbot", "Bingbot"],
    ["claudebot", "ClaudeBot"],
    ["criteobot", "CriteoBot"],
    ["lanai", "Lanai"],
    ["ias-va", "IAS crawler"],
  ];
  const known = knownAgents.find(([token]) => lower.includes(token));
  if (known) return known[1];

  const chrome = userAgent.match(/Chrome\/([\d.]+)/);
  const safari = userAgent.match(/Version\/([\d.]+).*Safari/);
  const mobile = /mobile|android|iphone/i.test(userAgent);
  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /macintosh|mac os/i.test(userAgent)
      ? "Mac"
      : /android/i.test(userAgent)
        ? "Android"
        : /iphone/i.test(userAgent)
          ? "iPhone"
          : "Browser";

  if (chrome) return `${mobile ? "Mobile " : ""}Chrome ${chrome[1].split(".")[0]} (${os})`;
  if (safari) return `${mobile ? "Mobile " : ""}Safari ${safari[1].split(".")[0]} (${os})`;
  return userAgent.length > 42 ? `${userAgent.slice(0, 39)}...` : userAgent;
}

function normalizeRecords(records) {
  return records.map((record, index) => {
    const userAgent = record["proxy.userAgent"] || "Unknown agent";
    const clientIp = record["proxy.clientIp"] || "0.0.0.0";

    return {
      id: `${record.label}-${clientIp}-${index}`,
      label: String(record.label ?? "unknown"),
      ja4Digest: record.ja4Digest || "unknown",
      userAgent,
      agentName: compactUserAgent(userAgent),
      clientIp,
      requests: Number(record.conteo_requests ?? record.request_amount ?? 0),
      timestamps: Number(record.times_timestamp ?? 0),
      routes: Number(record.routes_visited ?? 0),
      activityWindowMs: Number(record.activity_window_ms ?? 0),
      meanBetweenMs: Number(record.mean_time_between_requests_ms ?? 0),
      medianBetweenMs: Number(record.median_time_between_requests_ms ?? 0),
      oneShot: Boolean(record.is_one_shot),
    };
  });
}

function buildClusters(records) {
  const labelMap = new Map();

  for (const record of records) {
    if (!labelMap.has(record.label)) {
      labelMap.set(record.label, {
        id: `label-${record.label}`,
        type: "label",
        label: record.label,
        name: getLabelProfile(record.label).name,
        profile: getLabelProfile(record.label),
        records: [],
        agentMap: new Map(),
      });
    }

    const labelGroup = labelMap.get(record.label);
    labelGroup.records.push(record);

    const agentKey = `${record.agentName}|${record.userAgent}`;
    if (!labelGroup.agentMap.has(agentKey)) {
      labelGroup.agentMap.set(agentKey, {
        id: `agent-${record.label}-${hashString(agentKey)}`,
        type: "agent",
        label: record.label,
        name: record.agentName,
        userAgent: record.userAgent,
        records: [],
      });
    }

    labelGroup.agentMap.get(agentKey).records.push(record);
  }

  return Array.from(labelMap.values())
    .map((labelGroup) => {
      const agents = Array.from(labelGroup.agentMap.values()).map((agentGroup) => ({
        ...agentGroup,
        requests: agentGroup.records.reduce((sum, item) => sum + item.requests, 0),
        routes: agentGroup.records.reduce((sum, item) => sum + item.routes, 0),
        activityWindowMs: agentGroup.records.reduce((sum, item) => sum + item.activityWindowMs, 0),
        ips: agentGroup.records.length,
        oneShotCount: agentGroup.records.filter((item) => item.oneShot).length,
        appliedRules: dedupeRules(agentGroup.records.flatMap((item) => item.appliedRules || [])),
      }));

      const requests = labelGroup.records.reduce((sum, item) => sum + item.requests, 0);
      const oneShotCount = labelGroup.records.filter((item) => item.oneShot).length;

      return {
        ...labelGroup,
        agents,
        requests,
        routes: labelGroup.records.reduce((sum, item) => sum + item.routes, 0),
        activityWindowMs: labelGroup.records.reduce((sum, item) => sum + item.activityWindowMs, 0),
        ips: new Set(labelGroup.records.map((item) => item.clientIp)).size,
        oneShotCount,
        recurrentCount: labelGroup.records.length - oneShotCount,
        appliedRules: dedupeRules(labelGroup.records.flatMap((item) => item.appliedRules || [])),
      };
    })
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function metricValue(item, metric) {
  if (metric === "routes") return item.routes || 1;
  if (metric === "window") return Math.max(1, (item.activityWindowMs || 0) / 1000);
  return item.requests || 1;
}

function sphereRadius(item, metric, mode, maxValue = 1) {
  const value = metricValue(item, metric);
  if (mode === "label") {
    const ratio = Math.max(0.08, value / Math.max(1, maxValue));
    return 0.72 + Math.pow(ratio, 1.55) * 1.72;
  }

  const base = mode === "agent" ? 0.48 : 0.28;
  const boost = Math.log2(value + 1) * (mode === "agent" ? 0.18 : 0.12);
  return Math.max(base, base + boost);
}

function labelColor(label) {
  const index = Number.isNaN(Number(label)) ? hashString(String(label)) : Number(label);
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

function getUniversePosition(item, index, total) {
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const radius = 4.4 + (hashString(item.id) % 4) * 0.5;
  const y = ((hashString(`${item.id}-y`) % 300) - 150) / 100;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

function getOrbitPosition(item, index, total, scale = 4.8) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, total - 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = golden * index + (hashString(item.id) % 100) / 100;
  return [Math.cos(theta) * radius * scale, y * scale * 0.62, Math.sin(theta) * radius * scale];
}

function getLockPoint(selectedRecord) {
  if (!selectedRecord?.__position) return null;
  return new THREE.Vector3(...selectedRecord.__position);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getLockCameraPosition(lockPoint, isCompact, targetRadius = 0.8) {
  const direction = isCompact ? new THREE.Vector3(0, 0.22, 1).normalize() : new THREE.Vector3(-0.44, 0.19, 0.88).normalize();
  const radiusFactor = Math.pow(Math.max(targetRadius, 0.45), 0.92);
  const distance = isCompact ? clamp(radiusFactor * 9.4, 7.4, 16) : clamp(radiusFactor * 10.8, 7.2, 22);
  return lockPoint.clone().add(direction.multiplyScalar(distance));
}

function getLockLookAt(lockPoint, cameraPosition, isCompact, viewportSize, cameraFov = 48) {
  if (isCompact) return lockPoint.clone();

  const forward = lockPoint.clone().sub(cameraPosition).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const aspect = viewportSize.width / Math.max(1, viewportSize.height);
  const distance = cameraPosition.distanceTo(lockPoint);
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(cameraFov) / 2) * distance * aspect;
  return lockPoint.clone().add(right.multiplyScalar(halfWidth * 0.5));
}

function CameraDirector({ viewMode, activeLabel, activeAgent, selectedRecord, selectedRadius }) {
  const { camera, size } = useThree();
  const framesLeft = useRef(0);
  const viewKey = `${viewMode}-${activeLabel?.id || "none"}-${activeAgent?.id || "none"}-${
    selectedRecord?.id || "none"
  }`;
  const isCompact = size.width < 720;
  const lockPoint = useMemo(() => {
    if (viewMode !== "agent" || !activeAgent) return null;
    return getLockPoint(selectedRecord);
  }, [activeAgent, selectedRecord, viewMode]);
  const target = useMemo(() => {
    if (lockPoint) {
      return getLockCameraPosition(lockPoint, isCompact, selectedRadius);
    }

    if (viewMode === "agent" && activeAgent) {
      return new THREE.Vector3(0, isCompact ? 1.2 : 0.6, isCompact ? 11 : 6.8);
    }
    if (viewMode === "label" && activeLabel) {
      return new THREE.Vector3(0, isCompact ? 3.4 : 2.6, isCompact ? 20 : 15);
    }
    return new THREE.Vector3(0, isCompact ? 3.4 : 2.6, isCompact ? 18 : 12);
  }, [activeAgent, activeLabel, isCompact, lockPoint, selectedRadius, viewMode]);
  const lookAtTarget = useMemo(
    () =>
      lockPoint
        ? getLockLookAt(lockPoint, target, isCompact, size, camera.isPerspectiveCamera ? camera.fov : 48)
        : new THREE.Vector3(0, 0, 0),
    [camera, isCompact, lockPoint, size, target],
  );

  useEffect(() => {
    framesLeft.current = lockPoint ? 95 : 70;
  }, [viewKey, isCompact, lockPoint]);

  useFrame(() => {
    if (framesLeft.current <= 0) return;
    framesLeft.current -= 1;
    camera.position.lerp(target, lockPoint ? 0.06 : 0.045);
    camera.lookAt(lookAtTarget);
  });

  return null;
}

function SceneOrbitControls({ activeAgent, selectedRecord, selectedRadius }) {
  const { camera, size } = useThree();
  const controlsRef = useRef(null);
  const isCompact = size.width < 720;
  const controlsTarget = useMemo(() => {
    if (!activeAgent) return new THREE.Vector3(0, 0, 0);

    const lockPoint = getLockPoint(selectedRecord);
    if (!lockPoint) return new THREE.Vector3(0, 0, 0);

    const cameraPosition = getLockCameraPosition(lockPoint, isCompact, selectedRadius);
    return getLockLookAt(lockPoint, cameraPosition, isCompact, size, camera.isPerspectiveCamera ? camera.fov : 48);
  }, [activeAgent, camera, isCompact, selectedRadius, selectedRecord, size]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.copy(controlsTarget);
    controlsRef.current.update();
  }, [controlsTarget]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.07}
      minDistance={selectedRecord ? 6 : 4.5}
      maxDistance={selectedRecord ? 28 : 18}
    />
  );
}

function SpaceSphere({
  item,
  position,
  radius,
  color,
  selected,
  focused,
  locked,
  mitigated,
  transitioning,
  focusActive,
  lockActive,
  onSelect,
  onHover,
}) {
	  const groupRef = useRef(null);
	  const appliedRules = item.appliedRules || [];
	  const actioned = mitigated || appliedRules.length > 0;
	  const displayColor = actioned ? "#34d399" : locked ? "#fb923c" : color;
  const materialColor = useMemo(() => new THREE.Color(displayColor), [displayColor]);
  const softColor = useMemo(() => new THREE.Color(displayColor).lerp(new THREE.Color("#ffffff"), 0.22), [displayColor]);
  const highlighted = selected || focused || locked;
  const muted = (focusActive && !focused && !locked) || (lockActive && !locked);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const seed = (hashString(item.id) % 100) / 100;
    const floatOffset = locked ? 0 : Math.sin(clock.elapsedTime * 0.32 + seed * 8) * 0.045;
    groupRef.current.position.y = position[1] + floatOffset;
    groupRef.current.rotation.y += locked ? 0.0008 : 0.0014 + seed * 0.0007;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(item);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHover(null);
        document.body.style.cursor = "default";
      }}
    >
      <mesh scale={0.72}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color={softColor}
          transparent
          opacity={muted ? 0.035 : highlighted ? 0.26 : 0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color={softColor}
          emissive={materialColor}
          emissiveIntensity={muted ? 0.04 : highlighted ? 0.48 : 0.18}
          roughness={0.18}
          metalness={0}
          transparent
          opacity={muted ? 0.08 : highlighted ? 0.4 : 0.22}
          clearcoat={1}
          clearcoatRoughness={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={displayColor}
          transparent
          opacity={muted ? 0.08 : highlighted ? 0.52 : 0.2}
          wireframe
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.42}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={displayColor}
          transparent
          opacity={muted ? 0.025 : highlighted ? 0.16 : 0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
      {radius > 0.55 ? (
        <Html position={[0, radius + 0.34, 0]} center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="pointer-events-none max-w-36 truncate rounded-full border border-white/10 bg-black/35 px-2 py-1 text-center text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
            {item.name}
          </div>
        </Html>
      ) : null}
	      {actioned && !locked ? (
	        <Html position={[0, radius + 0.78, 0]} center zIndexRange={[44, 18]} style={{ pointerEvents: "none" }}>
	          <div className="pointer-events-none rounded-md border border-emerald-300/42 bg-emerald-300/14 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,.22)] backdrop-blur-md">
	            Acciones tomadas
	          </div>
	        </Html>
	      ) : null}
	      {locked ? (
	        <Html position={[0, radius + 0.9, 0]} center zIndexRange={[45, 20]} style={{ pointerEvents: "none" }}>
	          <div
	            className={`pointer-events-none rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] shadow-[0_0_24px_rgba(251,146,60,.4)] backdrop-blur-md ${
	              actioned
	                ? "border-emerald-300/60 bg-emerald-300/18 text-emerald-50"
	                : "border-orange-300/55 bg-orange-400/15 text-orange-100"
	            }`}
	          >
	            {actioned ? "Acciones tomadas" : "Seleccionado"}
	          </div>
	        </Html>
	      ) : null}
      {transitioning ? <LayerTransitionBurst color={displayColor} radius={radius} /> : null}
    </group>
  );
}

function LayerTransitionBurst({ color, radius }) {
  const fragments = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        angle: `${(index / 14) * 360}deg`,
        distance: `${72 + (index % 4) * 18}px`,
        delay: `${index * 18}ms`,
      })),
    [],
  );

  return (
    <Html position={[0, 0, 0]} center zIndexRange={[88, 55]} style={{ pointerEvents: "none" }}>
      <div
        className="layer-transition-burst"
        style={{
          "--burst-color": color,
          "--burst-size": `${Math.max(92, Math.min(190, radius * 92))}px`,
        }}
      >
        {fragments.map((fragment) => (
          <span
            key={`${fragment.angle}-${fragment.distance}`}
            className="layer-transition-fragment"
            style={{
              "--angle": fragment.angle,
              "--distance": fragment.distance,
              animationDelay: fragment.delay,
            }}
          />
        ))}
      </div>
    </Html>
  );
}

function HoverTooltip({ item }) {
  if (!item) return null;

  const position = item.__position || [0, 0, 0];
  const requests = item.requests ?? 0;
  const secondary =
    item.type === "ip"
      ? item.clientIp
      : item.type === "agent"
        ? `${item.ips} IPs`
        : `Label ${item.label} - ${item.profile?.pattern || "Patron"}`;

  return (
    <Html
      position={[position[0], position[1] + 0.9, position[2]]}
      center
      zIndexRange={[30, 10]}
      style={{ pointerEvents: "none" }}
    >
      <div className="pointer-events-none min-w-44 rounded-md border border-white/15 bg-zinc-950/90 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
        <div className="font-semibold">{item.name}</div>
        <div className="mt-1 text-white/60">{secondary}</div>
        {item.type === "label" && item.profile?.reading ? (
          <div className="mt-1 max-w-56 text-white/50">{item.profile.reading}</div>
        ) : null}
        <div className="mt-1 text-cyan-200">{formatNumber(requests)} requests</div>
      </div>
    </Html>
  );
}

function SpaceScene({
  clusters,
  activeLabel,
  activeAgent,
  metric,
  hovered,
  selectedRecord,
  mitigatedTargetId,
  layerTransition,
  setHovered,
  onSelect,
}) {
  const viewMode = activeAgent ? "agent" : activeLabel ? "label" : "universe";
  const focusActive =
    (hovered?.type === "label" && viewMode === "universe") ||
    (hovered?.type === "agent" && viewMode === "label");
  const lockActive = Boolean(activeAgent && selectedRecord);
  const items = useMemo(() => {
    if (activeAgent) {
      return activeAgent.records.map((record, index) => ({
        ...record,
        id: `ip-${record.id}`,
        type: "ip",
        name: record.clientIp,
        label: activeAgent.label,
        __position: getOrbitPosition(record, index, activeAgent.records.length, 3.6),
      }));
    }

    if (activeLabel) {
      return activeLabel.agents.map((agent, index) => ({
        ...agent,
        profile: activeLabel.profile,
        __position: getOrbitPosition(agent, index, activeLabel.agents.length, 5.2),
      }));
    }

    return clusters.map((cluster, index) => ({
      ...cluster,
      __position: getUniversePosition(cluster, index, clusters.length),
    }));
  }, [activeAgent, activeLabel, clusters]);

  const centerColor = activeLabel ? labelColor(activeLabel.label) : "#38bdf8";
  const maxVisibleMetric = useMemo(
    () => Math.max(...items.map((item) => metricValue(item, metric)), 1),
    [items, metric],
  );
  const selectedRadius = selectedRecord
    ? sphereRadius(selectedRecord, metric, selectedRecord.type, maxVisibleMetric)
    : 0.8;

  return (
    <>
      <color attach="background" args={["#030712"]} />
      <fog attach="fog" args={["#030712", 12, 28]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[3, 6, 5]} intensity={2.2} color="#e0f2fe" />
      <pointLight position={[-6, -2, -4]} intensity={1.6} color="#fda4af" />
      <Stars radius={80} depth={38} count={1400} factor={4} saturation={0} fade speed={0.4} />
      <CameraDirector
        viewMode={viewMode}
        activeLabel={activeLabel}
        activeAgent={activeAgent}
        selectedRecord={selectedRecord}
        selectedRadius={selectedRadius}
      />

      {activeLabel ? (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <meshStandardMaterial color={centerColor} emissive={centerColor} emissiveIntensity={0.8} />
        </mesh>
      ) : null}

      {activeAgent
        ? items.map((item) => (
            <Line
              key={`line-${item.id}`}
              points={[[0, 0, 0], item.__position]}
              color={(item.appliedRules || []).length > 0 ? "#34d399" : labelColor(item.label)}
              lineWidth={1}
              transparent
              opacity={(item.appliedRules || []).length > 0 ? 0.52 : 0.34}
            />
          ))
        : null}

      {items.map((item) => (
        <SpaceSphere
          key={item.id}
          item={item}
          position={item.__position}
          radius={sphereRadius(item, metric, item.type, maxVisibleMetric)}
          color={item.type === "ip" ? (item.oneShot ? "#94a3b8" : labelColor(item.label)) : labelColor(item.label)}
          selected={activeAgent?.id === item.id || hovered?.id === item.id}
          focused={hovered?.id === item.id}
          locked={selectedRecord?.id === item.id}
          mitigated={mitigatedTargetId === item.id || (item.appliedRules || []).length > 0}
          transitioning={layerTransition?.itemId === item.id && layerTransition.phase === "exit"}
          focusActive={focusActive}
          lockActive={lockActive}
          onSelect={onSelect}
          onHover={setHovered}
        />
      ))}

      {focusActive && hovered ? (
        <TacticalHoverPanel item={hovered} radius={sphereRadius(hovered, metric, hovered.type, maxVisibleMetric)} />
      ) : null}

      {activeAgent && selectedRecord ? (
        <TargetLockConnector
          item={selectedRecord}
          radius={selectedRadius}
          mitigated={mitigatedTargetId === selectedRecord.id || (selectedRecord.appliedRules || []).length > 0}
        />
      ) : null}

      {hovered && hovered.type === "ip" ? <HoverTooltip item={hovered} /> : null}
      <SceneOrbitControls activeAgent={activeAgent} selectedRecord={selectedRecord} selectedRadius={selectedRadius} />
    </>
  );
}

function LayerWarpOverlay({ transition }) {
  if (!transition) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[72] overflow-hidden ${
        transition.phase === "enter" ? "layer-warp-overlay layer-warp-overlay--enter" : "layer-warp-overlay"
      }`}
      style={{ "--warp-color": transition.color }}
    >
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-orange-200/20" />
      <div className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/20 border-dashed" />
      <div className="absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 translate-y-28 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-100/65">
          {transition.phase === "enter" ? "Capa desplegada" : "Abriendo capa"}
        </div>
        <div className="mt-2 truncate text-sm font-semibold text-white/80">{transition.name}</div>
      </div>
    </div>
  );
}

function BootSplash({ step }) {
  const activeStep = BOOT_MESSAGES[step % BOOT_MESSAGES.length];

  return (
    <div className="pointer-events-auto fixed inset-0 z-[140] flex items-center justify-center overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.16),transparent_34%),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.05)_1px,transparent_1px)] bg-[size:auto,34px_34px,34px_34px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0_13%,rgba(0,0,0,.55)_39%,rgba(0,0,0,.82)_100%)]" />

      <section className="relative w-[min(88vw,560px)] overflow-hidden rounded-md border border-cyan-200/22 bg-black/42 p-6 text-center shadow-2xl shadow-cyan-950/35 backdrop-blur-xl">
        <div className="boot-radar mx-auto">
          <div className="boot-radar-sweep" />
          <div className="boot-radar-core" />
        </div>

        <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">Log Hound</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-normal">Cargando Log Hound</h1>

        <div className="mt-5 rounded-md border border-white/10 bg-zinc-950/64 p-3 text-left font-mono text-xs text-cyan-100/78">
          {BOOT_MESSAGES.map((message, index) => (
            <div
              key={message}
              className={`flex items-center gap-2 py-1 transition ${
                index === step % BOOT_MESSAGES.length ? "text-orange-100" : "text-cyan-100/45"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
              <span>{index === step % BOOT_MESSAGES.length ? "> " : "  "}</span>
              <span>{message}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="boot-progress h-full rounded-full bg-gradient-to-r from-cyan-300 via-orange-200 to-emerald-300" />
        </div>
        <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/42">{activeStep}</div>
      </section>
    </div>
  );
}

function TacticalHoverPanel({ item, radius }) {
  if (!item?.__position) return null;

  const profile = item.profile || getLabelProfile(item.label);
  const isAgent = item.type === "agent";
  const size = Math.max(72, Math.min(156, radius * 58));
  const line = item.type === "label" ? 300 : 250;
  const position = item.__position;
	  const side = position[0] > 0 ? "left" : "right";
	  const recurrentCount = isAgent ? item.ips - item.oneShotCount : item.recurrentCount;
	  const appliedRules = item.appliedRules || [];
  const statItems = isAgent
    ? [
        { label: "IPs detectadas", value: formatNumber(item.ips), icon: Globe2 },
        { label: "Requests", value: formatNumber(item.requests), icon: Activity },
        { label: "Rutas", value: formatNumber(item.routes), icon: Route },
        { label: "Ventana", value: formatMs(item.activityWindowMs), icon: Timer },
      ]
    : [
        { label: "IPs asociadas", value: formatNumber(item.ips), icon: Globe2 },
        { label: "Requests", value: formatNumber(item.requests), icon: Activity },
        { label: "Ventana", value: formatMs(item.activityWindowMs), icon: Timer },
        { label: "User agents", value: formatNumber(item.agents.length), icon: Bot },
      ];

  return (
    <Html
      position={[position[0], position[1] + radius * 0.18, position[2]]}
      center
      zIndexRange={[90, 50]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="tactical-connector"
        data-side={side}
        style={{
          "--connector-size": `${size}px`,
          "--connector-line": `${line}px`,
        }}
      >
        <div className="tactical-connector-ring" />
        <div className="tactical-connector-rise" />
        <div className="tactical-connector-line" />
        <div className="tactical-connector-node" />
        <aside className="tactical-panel tactical-connector-card pointer-events-none hidden overflow-hidden rounded-md border border-cyan-200/25 bg-zinc-950/75 p-4 text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-xl md:block">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.07)_1px,transparent_1px)] bg-[size:24px_24px] opacity-45" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-200/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-cyan-200/10 before:absolute before:inset-x-0 before:h-px before:bg-cyan-100/70" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              {isAgent ? "Agent lock" : "Pattern lock"}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{item.name}</h2>
          </div>
          <div className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
            Label {item.label}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-normal text-white/45">
            {isAgent ? "Agente observado" : "Patron observado"}
          </div>
          <div className="mt-1 text-sm font-medium text-white">{isAgent ? profile.pattern : item.profile?.pattern}</div>
          <p className="mt-2 text-sm leading-6 text-white/62">
            {isAgent
              ? "Agrupacion de IPs que comparten este user agent dentro del patron seleccionado."
              : item.profile?.reading}
          </p>
          {isAgent ? (
            <div className="mt-3 max-h-24 overflow-hidden rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs leading-5 text-white/55">
              {item.userAgent}
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {statItems.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-normal text-white/45">
                <Icon size={13} />
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

	        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-emerald-200/15 bg-emerald-200/10 p-3">
            <div className="text-[11px] uppercase tracking-normal text-emerald-100/60">Recurrentes</div>
            <div className="mt-1 font-semibold text-emerald-50">{formatNumber(recurrentCount)}</div>
          </div>
          <div className="rounded-md border border-slate-200/15 bg-slate-200/10 p-3">
            <div className="text-[11px] uppercase tracking-normal text-slate-100/60">One-shot</div>
            <div className="mt-1 font-semibold text-slate-50">{formatNumber(item.oneShotCount)}</div>
          </div>
	        </div>
	        {appliedRules.length > 0 ? (
	          <div className="mt-3 rounded-md border border-emerald-300/22 bg-emerald-300/10 p-3 shadow-[0_0_22px_rgba(52,211,153,.1)]">
	            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/68">
	              Acciones tomadas
	            </div>
	            <div className="mt-2 grid gap-1.5">
	              {appliedRules.slice(0, 3).map((rule) => (
	                <div
	                  key={`${rule.action}-${rule.operator}-${rule.conditionValue}`}
	                  className="flex items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-xs"
	                >
	                  <span className="font-semibold uppercase tracking-[0.08em] text-emerald-100">{rule.action}</span>
	                  <span className="max-w-48 truncate font-mono text-emerald-50/72">
	                    user_agent {rule.operator} {rule.conditionValue}
	                  </span>
	                </div>
	              ))}
	            </div>
	          </div>
	        ) : null}
	      </div>
	    </aside>
      </div>
    </Html>
  );
}

function TargetLockConnector({ item, radius, mitigated }) {
  if (!item?.__position) return null;

  const size = Math.max(58, Math.min(118, radius * 68));
  const line = 180;
  const position = item.__position;
  const side = position[0] > 0 ? "left" : "right";

  return (
    <Html
      position={position}
      center
      zIndexRange={[70, 30]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="tactical-connector"
        data-side={side}
        style={{
          "--connector-size": `${size}px`,
          "--connector-line": `${line}px`,
        }}
      >
        <div className="tactical-connector-ring" />
        <div className="tactical-connector-rise" />
        <div className="tactical-connector-line" />
        <div className="tactical-connector-node" />
        <div className={`tactical-lock-badge ${mitigated ? "tactical-lock-badge--armed" : ""}`}>
          {mitigated ? "Medidas tomadas" : "Seleccionado"}
        </div>
      </div>
    </Html>
  );
}

export default function SpaceClient() {
  const [records, setRecords] = useState([]);
  const [firewallRules, setFirewallRules] = useState([]);
  const [firewallRulesError, setFirewallRulesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("requests");
  const [query, setQuery] = useState("");
  const [activeLabelId, setActiveLabelId] = useState(null);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [mitigatedTargetId, setMitigatedTargetId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [measuresOpen, setMeasuresOpen] = useState(false);
  const [layerTransition, setLayerTransition] = useState(null);
  const [bootStep, setBootStep] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const layerTransitionTimers = useRef([]);

  const refreshFirewallRules = useCallback(async () => {
    try {
      const result = await listLogHoundAgentRules();
      setFirewallRules(Array.isArray(result.rules) ? result.rules : []);
      setFirewallRulesError("");
    } catch (rulesError) {
      setFirewallRules([]);
      setFirewallRulesError(rulesError instanceof Error ? rulesError.message : "No se pudieron leer reglas Log Hound");
    }
  }, []);

	  useEffect(() => {
	    let alive = true;

    async function load() {
      try {
        const response = await fetch(ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error(`Endpoint respondio ${response.status}`);
        const payload = await response.json();
        if (alive) setRecords(normalizeRecords(Array.isArray(payload) ? payload : []));
      } catch (loadError) {
        if (alive) setError(loadError.message || "No se pudo cargar el dataset");
      } finally {
        if (alive) setLoading(false);
      }
    }

	    load();
	    return () => {
	      alive = false;
	      document.body.style.cursor = "default";
	    };
	  }, []);

  useEffect(() => {
    let alive = true;

    listLogHoundAgentRules()
      .then((result) => {
        if (!alive) return;
        setFirewallRules(Array.isArray(result.rules) ? result.rules : []);
        setFirewallRulesError("");
      })
      .catch((rulesError) => {
        if (!alive) return;
        setFirewallRules([]);
        setFirewallRulesError(rulesError instanceof Error ? rulesError.message : "No se pudieron leer reglas Log Hound");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      layerTransitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBootStep((step) => (step + 1) % BOOT_MESSAGES.length);
    }, BOOT_STEP_MS);
    const completeTimer = window.setTimeout(() => {
      setBootComplete(true);
    }, BOOT_MESSAGES.length * BOOT_STEP_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(completeTimer);
    };
  }, []);

  const annotatedRecords = useMemo(
    () =>
      records.map((record) => ({
        ...record,
        appliedRules: getAppliedRulesForUserAgent(firewallRules, record.userAgent),
      })),
    [firewallRules, records],
  );

  const filteredRecords = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return annotatedRecords;
    return annotatedRecords.filter(
      (record) =>
        record.userAgent.toLowerCase().includes(cleanQuery) ||
        record.agentName.toLowerCase().includes(cleanQuery) ||
        record.clientIp.toLowerCase().includes(cleanQuery) ||
        record.ja4Digest.toLowerCase().includes(cleanQuery),
    );
  }, [annotatedRecords, query]);

  const clusters = useMemo(() => buildClusters(filteredRecords), [filteredRecords]);
  const activeLabel = clusters.find((cluster) => cluster.id === activeLabelId) || null;
  const activeAgent = activeLabel?.agents.find((agent) => agent.id === activeAgentId) || null;
  const selectedRecordWithRules = selectedRecord
    ? {
        ...selectedRecord,
        appliedRules: getAppliedRulesForUserAgent(firewallRules, selectedRecord.userAgent),
      }
    : null;
  const totalRequests = filteredRecords.reduce((sum, item) => sum + item.requests, 0);
  const totalRoutes = filteredRecords.reduce((sum, item) => sum + item.routes, 0);
  const recurrentCount = filteredRecords.filter((item) => !item.oneShot).length;

  function clearLayerTransitionTimers() {
    layerTransitionTimers.current.forEach((timer) => window.clearTimeout(timer));
    layerTransitionTimers.current = [];
  }

  function startLayerTransition(item, commit) {
    if (layerTransition) return;

    clearLayerTransitionTimers();
    setHovered(null);
    document.body.style.cursor = "default";
    setLayerTransition({
      color: labelColor(item.label),
      itemId: item.id,
      name: item.name,
      phase: "exit",
    });

    layerTransitionTimers.current = [
      window.setTimeout(() => {
        commit();
        setLayerTransition({
          color: labelColor(item.label),
          itemId: null,
          name: item.name,
          phase: "enter",
        });
      }, LAYER_TRANSITION_COMMIT_MS),
      window.setTimeout(() => {
        setLayerTransition(null);
      }, LAYER_TRANSITION_TOTAL_MS),
    ];
  }

  function openLabel(item) {
    startLayerTransition(item, () => {
      setActiveLabelId(item.id);
      setActiveAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    });
  }

  function openAgent(item) {
    startLayerTransition(item, () => {
      setActiveAgentId(item.id);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    });
  }

  function handleSelect(item) {
    if (item.type === "label") {
      openLabel(item);
      return;
    }

    if (item.type === "agent") {
      openAgent(item);
      return;
    }

    setSelectedRecord(item);
    setMitigatedTargetId(null);
    setMeasuresOpen(false);
  }

  function goBack() {
    if (activeAgent) {
      setActiveAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
      return;
    }

    if (activeLabel) {
      setActiveLabelId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    }
  }

  const modeTitle = activeAgent
    ? `${activeAgent.name}: IPs desplegadas`
    : activeLabel
      ? `${activeLabel.name}: user agents`
      : "Espacio de labels";
  const modeDescription = activeLabel
    ? activeLabel.profile?.reading
    : "Gira el espacio, entra a un patron y abre un user agent para dividirlo por IP. El tamano cambia con la metrica activa.";
  const breadcrumbs = [
    { label: "Sector", value: "Espacio de labels" },
    ...(activeLabel ? [{ label: `Label ${activeLabel.label}`, value: activeLabel.name }] : []),
    ...(activeAgent ? [{ label: "Agent", value: activeAgent.name }] : []),
	    ...(selectedRecordWithRules ? [{ label: "IP", value: selectedRecordWithRules.clientIp }] : []),
  ];
  const tacticalHover =
    hovered?.type === "label" || (hovered?.type === "agent" && activeLabel && !activeAgent)
      ? hovered
      : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 2.6, 12], fov: 48 }}
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <SpaceScene
            clusters={clusters}
            activeLabel={activeLabel}
            activeAgent={activeAgent}
            metric={metric}
            hovered={hovered}
	          selectedRecord={selectedRecordWithRules}
            mitigatedTargetId={mitigatedTargetId}
            layerTransition={layerTransition}
            setHovered={setHovered}
            onSelect={handleSelect}
          />
        </Canvas>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-[6] bg-black transition-opacity duration-150 ${
          tacticalHover ? "opacity-30" : "opacity-0"
        }`}
      />
      <LayerWarpOverlay transition={layerTransition} />
      <SecurityResourcesMenu />

	      {!selectedRecordWithRules ? (
        <>
          <SpaceMenu
            drawerOpen={drawerOpen}
            onOpen={() => setDrawerOpen(true)}
            onClose={() => setDrawerOpen(false)}
            breadcrumbs={breadcrumbs}
            modeTitle={modeTitle}
            modeDescription={modeDescription}
            canGoBack={Boolean(activeLabel)}
            onBack={goBack}
            metrics={METRICS}
            metric={metric}
            onMetricChange={setMetric}
            filteredRecordsCount={filteredRecords.length}
            totalRequests={totalRequests}
            totalRoutes={totalRoutes}
            recurrentCount={recurrentCount}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="pointer-events-auto max-w-md rounded-md border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/30 backdrop-blur-md">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45"
                  size={16}
                />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveLabelId(null);
                    setActiveAgentId(null);
                    setSelectedRecord(null);
                    setMitigatedTargetId(null);
                    setMeasuresOpen(false);
                  }}
                  placeholder="Buscar bot, user agent, IP o JA4"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-cyan-300"
                />
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/55">
                <div className="flex items-center gap-1.5">
                  <CircleDot size={13} />
                  Patron
                </div>
                <div className="flex items-center gap-1.5">
                  <Bot size={13} />
                  Agent
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe2 size={13} />
                  IP
                </div>
              </div>
            </div>

            <SelectionPanel
              loading={loading}
              error={error}
	              selectedRecord={selectedRecordWithRules}
              activeAgent={activeAgent}
              activeLabel={activeLabel}
              measuresOpen={measuresOpen}
              onToggleMeasures={() => setMeasuresOpen((value) => !value)}
              onClearTarget={() => {
                setSelectedRecord(null);
                setMitigatedTargetId(null);
                setMeasuresOpen(false);
              }}
	              onMitigationComplete={() => {
	                setMitigatedTargetId(selectedRecordWithRules?.id || null);
	                refreshFirewallRules();
	              }}
	              onMitigationRemoved={() => setMitigatedTargetId(null)}
	              onFirewallRulesChange={refreshFirewallRules}
	              firewallRulesError={firewallRulesError}
	            />
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/45 backdrop-blur-md md:flex">
            <Crosshair size={13} />
            orbit controls active
          </div>
        </>
      ) : (
        <SelectionPanel
          loading={loading}
          error={error}
	          selectedRecord={selectedRecordWithRules}
          activeAgent={activeAgent}
          activeLabel={activeLabel}
          measuresOpen={measuresOpen}
          onToggleMeasures={() => setMeasuresOpen((value) => !value)}
          onClearTarget={() => {
            setSelectedRecord(null);
            setMitigatedTargetId(null);
            setMeasuresOpen(false);
          }}
	          mitigationComplete={mitigatedTargetId === selectedRecordWithRules?.id || (selectedRecordWithRules?.appliedRules || []).length > 0}
	          onMitigationComplete={() => {
	            setMitigatedTargetId(selectedRecordWithRules?.id || null);
	            refreshFirewallRules();
	          }}
	          onMitigationRemoved={() => setMitigatedTargetId(null)}
	          onFirewallRulesChange={refreshFirewallRules}
	          firewallRulesError={firewallRulesError}
	        />
      )}
      {loading || !bootComplete ? <BootSplash step={bootStep} /> : null}
    </main>
  );
}
