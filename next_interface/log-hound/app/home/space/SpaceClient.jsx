"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CircleDot,
  Crosshair,
  Fingerprint,
  Globe2,
  Search,
} from "lucide-react";
import * as THREE from "three";
import { listLogHoundAgentRules } from "./contramedidas/actions/firewallRuleActions";
import SelectionPanel from "./contramedidas/SelectionPanel";
import SpaceMenu from "./dashboards/menu/SpaceMenu";
import SecurityResourcesMenu from "./security/SecurityResourcesMenu";
import { formatDistance, formatNumber, formatTimeWindow } from "./utils/formatters";

const ENDPOINT = "/data/predictions.json";
const ACTION_TAKEN_COLOR = "#34d399";
const LABEL_COLORS = ["#38bdf8", "#fb7185", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6"];
const LABEL_PROFILES = {
  0: {
    name: "Exploracion moderada L0",
    pattern: "Cobertura media sostenida",
    reading: "Sesiones recurrentes con varias rutas visitadas durante una ventana amplia, sin llegar a volumen agresivo.",
  },
  1: {
    name: "One-shot aislado L1",
    pattern: "Request unico",
    reading: "Eventos aislados con una sola ruta y ventana casi nula; comportamiento puntual sin recurrencia observable.",
  },
  2: {
    name: "Bajo volumen espaciado L2",
    pattern: "Pocas rutas con pausa larga",
    reading: "Actividad recurrente pequena, con pocas rutas y separaciones largas entre requests.",
  },
  3: {
    name: "Alto volumen expansivo L3",
    pattern: "Crawler de alta cobertura",
    reading: "Grupo de mayor cobertura: muchas rutas unicas, ventana amplia y cadencia sostenida; candidato principal a crawler agresivo.",
  },
};
const METRICS = [
  { id: "requests", label: "Requests" },
  { id: "routes", label: "Rutas" },
  { id: "window", label: "Ventana" },
  { id: "distance", label: "Distancia" },
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

function compactJa4Digest(ja4Digest) {
  if (!ja4Digest || ja4Digest === "unknown") return "JA4 unknown";
  if (ja4Digest.length <= 24) return ja4Digest;
  return `${ja4Digest.slice(0, 12)}...${ja4Digest.slice(-8)}`;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getDistanceStats(records) {
  const distances = records.map((item) => safeNumber(item.centroidDistance, Number.NaN)).filter(Number.isFinite);
  if (!distances.length) {
    return {
      avgCentroidDistance: 0,
      minCentroidDistance: 0,
      maxCentroidDistance: 0,
    };
  }

  return {
    avgCentroidDistance: distances.reduce((sum, value) => sum + value, 0) / distances.length,
    minCentroidDistance: Math.min(...distances),
    maxCentroidDistance: Math.max(...distances),
  };
}

function uniqueCount(records, key) {
  return new Set(records.map((item) => item[key]).filter(Boolean)).size;
}

function getRepresentativeUserAgent(records) {
  const counts = new Map();
  for (const record of records) {
    counts.set(record.userAgent, (counts.get(record.userAgent) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown agent";
}

function buildIpNodes(records, label) {
  const ipMap = new Map();

  for (const record of records) {
    if (!ipMap.has(record.clientIp)) {
      ipMap.set(record.clientIp, []);
    }
    ipMap.get(record.clientIp).push(record);
  }

  return Array.from(ipMap.entries()).map(([clientIp, ipRecords]) => {
    const representative = ipRecords[0];
    const userAgent = getRepresentativeUserAgent(ipRecords);
    const distanceStats = getDistanceStats(ipRecords);

    return {
      ...representative,
      id: `ip-${label}-${representative.ja4Digest}-${clientIp}`,
      type: "ip",
      name: compactUserAgent(userAgent),
      label,
      clientIp,
      userAgent,
      agentName: compactUserAgent(userAgent),
      requests: ipRecords.reduce((sum, item) => sum + item.requests, 0),
      routes: ipRecords.reduce((sum, item) => sum + item.routes, 0),
      activityWindowMs: ipRecords.reduce((sum, item) => sum + item.activityWindowMs, 0),
      meanBetweenMs: ipRecords.reduce((sum, item) => sum + item.meanBetweenMs, 0) / Math.max(1, ipRecords.length),
      medianBetweenMs: ipRecords.reduce((sum, item) => sum + item.medianBetweenMs, 0) / Math.max(1, ipRecords.length),
      centroidDistance: distanceStats.avgCentroidDistance,
      oneShot: ipRecords.every((item) => item.oneShot),
      timeWindowCount: uniqueCount(ipRecords, "timeWindow"),
      userAgentCount: uniqueCount(ipRecords, "userAgent"),
      appliedRules: dedupeRules(ipRecords.flatMap((item) => item.appliedRules || [])),
      records: ipRecords,
    };
  });
}

function buildUserAgentNodes(records, label, ja4Digest) {
  const userAgentMap = new Map();

  for (const record of records) {
    if (!userAgentMap.has(record.userAgent)) {
      userAgentMap.set(record.userAgent, []);
    }
    userAgentMap.get(record.userAgent).push(record);
  }

  return Array.from(userAgentMap.entries()).map(([userAgent, userAgentRecords]) => {
    const distanceStats = getDistanceStats(userAgentRecords);
    const ips = uniqueCount(userAgentRecords, "clientIp");

    return {
      id: `user-agent-${label}-${hashString(`${ja4Digest}-${userAgent}`)}`,
      type: "userAgent",
      label,
      name: compactUserAgent(userAgent),
      userAgent,
      agentName: compactUserAgent(userAgent),
      ja4Digest,
      records: userAgentRecords,
      requests: userAgentRecords.reduce((sum, item) => sum + item.requests, 0),
      routes: userAgentRecords.reduce((sum, item) => sum + item.routes, 0),
      activityWindowMs: userAgentRecords.reduce((sum, item) => sum + item.activityWindowMs, 0),
      ips,
      oneShotCount: buildIpNodes(userAgentRecords, label).filter((item) => item.oneShot).length,
      timeWindowCount: uniqueCount(userAgentRecords, "timeWindow"),
      centroidDistance: distanceStats.avgCentroidDistance,
      avgCentroidDistance: distanceStats.avgCentroidDistance,
      minCentroidDistance: distanceStats.minCentroidDistance,
      maxCentroidDistance: distanceStats.maxCentroidDistance,
      appliedRules: dedupeRules(userAgentRecords.flatMap((item) => item.appliedRules || [])),
    };
  });
}

function normalizeRecords(records) {
  return records.map((record, index) => {
    const userAgent = record["proxy.userAgent"] || "Unknown agent";
    const clientIp = record["proxy.clientIp"] || "0.0.0.0";
    const timeWindow = record.time_window ?? record.timeWindow ?? record.window ?? "";
    const ja4Digest = record.ja4Digest || "unknown";
    const routes = safeNumber(record.routes_visited ?? record.unique_routes ?? 0);
    const requests = safeNumber(record.conteo_requests ?? record.request_amount ?? record.times_timestamp ?? routes);

    return {
      id: `${record.label}-${clientIp}-${ja4Digest}-${timeWindow}-${index}`,
      label: String(record.label ?? "unknown"),
      ja4Digest,
      timeWindow,
      userAgent,
      agentName: compactUserAgent(userAgent),
      clientIp,
      requests,
      timestamps: safeNumber(record.times_timestamp ?? requests),
      routes,
      uniqueRoutes: safeNumber(record.unique_routes ?? routes),
      activityWindowMs: safeNumber(record.activity_window_ms ?? 0),
      meanBetweenMs: safeNumber(record.mean_time_between_requests_ms ?? 0),
      medianBetweenMs: safeNumber(record.median_time_between_requests_ms ?? 0),
      centroidDistance: safeNumber(
        record.distancias ?? record.centroidDistance ?? record.centroid_distance ?? record.distance_to_centroid ?? 0,
      ),
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

    const agentKey = record.ja4Digest;
    if (!labelGroup.agentMap.has(agentKey)) {
      labelGroup.agentMap.set(agentKey, {
        id: `ja4-${record.label}-${hashString(agentKey)}`,
        type: "agent",
        label: record.label,
        name: compactJa4Digest(record.ja4Digest),
        ja4Digest: record.ja4Digest,
        userAgent: record.userAgent,
        records: [],
      });
    }

    labelGroup.agentMap.get(agentKey).records.push(record);
  }

  return Array.from(labelMap.values())
    .map((labelGroup) => {
      const agents = Array.from(labelGroup.agentMap.values()).map((agentGroup) => {
        const ipNodes = buildIpNodes(agentGroup.records, agentGroup.label);
        const userAgents = buildUserAgentNodes(agentGroup.records, agentGroup.label, agentGroup.ja4Digest);
        const userAgent = getRepresentativeUserAgent(agentGroup.records);

        return {
          ...agentGroup,
          userAgent,
          agentName: compactUserAgent(userAgent),
          userAgentCount: uniqueCount(agentGroup.records, "userAgent"),
          userAgents,
          requests: agentGroup.records.reduce((sum, item) => sum + item.requests, 0),
          routes: agentGroup.records.reduce((sum, item) => sum + item.routes, 0),
          activityWindowMs: agentGroup.records.reduce((sum, item) => sum + item.activityWindowMs, 0),
          ips: ipNodes.length,
          oneShotCount: ipNodes.filter((item) => item.oneShot).length,
          appliedRules: dedupeRules(agentGroup.records.flatMap((item) => item.appliedRules || [])),
          ...getDistanceStats(agentGroup.records),
        };
      });

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
        ...getDistanceStats(labelGroup.records),
      };
    })
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function metricValue(item, metric) {
  if (item.type === "agent") {
    const userAgentWeight = (item.userAgentCount || 1) * 60;
    const requestBoost = Math.log2((item.requests || 0) + 1) * 10;
    if (metric === "distance") return Math.max(0.001, item.avgCentroidDistance ?? 0);
    return userAgentWeight + requestBoost;
  }

  if (item.type === "userAgent") {
    const ipWeight = (item.ips || 1) * 48;
    const requestBoost = Math.log2((item.requests || 0) + 1) * 9;
    if (metric === "distance") return Math.max(0.001, item.avgCentroidDistance ?? item.centroidDistance ?? 0);
    return ipWeight + requestBoost;
  }

  if (metric === "routes") return item.routes || 1;
  if (metric === "window") return Math.max(1, (item.activityWindowMs || 0) / 1000);
  if (metric === "distance") return Math.max(0.001, item.avgCentroidDistance ?? item.centroidDistance ?? 0);
  return item.requests || 1;
}

function sphereRadius(item, metric, mode, maxValue = 1) {
  const value = metricValue(item, metric);
  if (mode === "label") {
    const ratio = Math.max(0.08, value / Math.max(1, maxValue));
    return 0.72 + Math.pow(ratio, 1.55) * 1.72;
  }

  const base = mode === "agent" ? 0.48 : mode === "userAgent" ? 0.42 : 0.28;
  const boost = Math.log2(value + 1) * (mode === "agent" ? 0.18 : mode === "userAgent" ? 0.16 : 0.12);
  return Math.max(base, base + boost);
}

function getImportanceOpacity(item) {
  if (item.type !== "agent") return 1;
  const count = Math.max(1, item.userAgentCount || 1);
  return clamp((count - 1) / 5, 0, 1);
}

function getAgentSuspicionTone(item) {
  if (item.type !== "agent") {
    return {
      coreOpacity: 1,
      shellOpacity: 1,
      glowScale: 1,
      emissiveBoost: 1,
      color: null,
    };
  }

  const importance = getImportanceOpacity(item);
  return {
    coreOpacity: clamp(0.18 + importance * 0.95, 0.18, 1),
    shellOpacity: clamp(0.1 + importance * 1.35, 0.1, 1.25),
    glowScale: 0.75 + importance * 1.15,
    emissiveBoost: 0.35 + importance * 2.2,
    color: importance > 0.72 ? "#fb923c" : importance > 0.38 ? "#fbbf24" : "#64748b",
  };
}

function labelColor(label) {
  const index = Number.isNaN(Number(label)) ? hashString(String(label)) : Number(label);
  return LABEL_COLORS[index % LABEL_COLORS.length];
}

function getRankedUniversePosition(item, index, total) {
  if (total <= 1) return [0, 0, 0];
  const center = (total - 1) / 2;
  const x = (index - center) * 6.2;
  return [x, 0, 0];
}

function getOrbitDirection(item, index, total) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - ((index + 0.5) / Math.max(1, total)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = golden * index + (hashString(item.id) % 100) / 100;
  return new THREE.Vector3(Math.cos(theta) * radius, y * 0.62, Math.sin(theta) * radius).normalize();
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(ratio, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function getDistanceRange(values) {
  const cleanValues = values.map((value) => safeNumber(value, Number.NaN)).filter(Number.isFinite);
  if (!cleanValues.length) return { min: 0, max: 0 };
  const min = percentile(cleanValues, 0.08);
  const max = percentile(cleanValues, 0.94);
  return max > min ? { min, max } : { min: Math.min(...cleanValues), max: Math.max(...cleanValues) };
}

function getDistanceOrbitPosition(
  item,
  index,
  total,
  distanceRange,
  minScale = 1.35,
  maxScale = 6.4,
  spreadBoost = 1,
) {
  const distance = safeNumber(item.centroidDistance ?? item.avgCentroidDistance ?? 0);
  const range = distanceRange.max - distanceRange.min;
  const ratio = range > 0 ? clamp((distance - distanceRange.min) / range, 0, 1) : distanceRange.max > 0 ? 0.45 : 0;
  const coreSpread = (total > 12 ? 0.9 : 0.55) * spreadBoost;
  const radialJitter = ((hashString(`${item.id}-radial`) % 100) / 100 - 0.5) * coreSpread * (1 - ratio);
  const scale = minScale + Math.pow(ratio, 1.18) * (maxScale - minScale) + radialJitter;
  const direction = getOrbitDirection(item, index, total);
  const tangentSeed = hashString(`${item.id}-swarm`);
  const tangentAngle = ((tangentSeed % 360) / 180) * Math.PI;
  const tangentRadius = (total > 10 ? 0.72 : 0.42) * spreadBoost * (1 - ratio);
  const tangent = new THREE.Vector3(Math.cos(tangentAngle), 0, Math.sin(tangentAngle)).multiplyScalar(tangentRadius);
  return direction.multiplyScalar(Math.max(0.95, scale)).add(tangent).toArray();
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

function CameraDirector({ viewMode, activeLabel, activeAgent, activeUserAgent, selectedRecord, selectedRadius }) {
  const { camera, size } = useThree();
  const framesLeft = useRef(0);
  const viewKey = `${viewMode}-${activeLabel?.id || "none"}-${activeAgent?.id || "none"}-${
    selectedRecord?.id || "none"
  }`;
  const isCompact = size.width < 720;
  const lockPoint = useMemo(() => {
    if (viewMode !== "userAgent" || !activeUserAgent) return null;
    return getLockPoint(selectedRecord);
  }, [activeUserAgent, selectedRecord, viewMode]);
  const target = useMemo(() => {
    if (lockPoint) {
      return getLockCameraPosition(lockPoint, isCompact, selectedRadius);
    }

    if (viewMode === "userAgent" && activeUserAgent) {
      return new THREE.Vector3(0, isCompact ? 2.8 : 1.8, isCompact ? 26 : 22);
    }
    if (viewMode === "agent" && activeAgent) {
      return new THREE.Vector3(0, isCompact ? 2.8 : 1.8, isCompact ? 26 : 22);
    }
    if (viewMode === "label" && activeLabel) {
      return new THREE.Vector3(0, isCompact ? 5.6 : 4.8, isCompact ? 40 : 34);
    }
    return new THREE.Vector3(0, isCompact ? 3.8 : 3, isCompact ? 22 : 16);
  }, [activeAgent, activeLabel, activeUserAgent, isCompact, lockPoint, selectedRadius, viewMode]);
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
      maxDistance={selectedRecord ? 80 : 72}
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
  actionVisual,
  onSelect,
  onHover,
}) {
  const groupRef = useRef(null);
  const appliedRules = item.appliedRules || [];
  const actioned = actionVisual && (mitigated || appliedRules.length > 0);
  const displayColor = actioned ? ACTION_TAKEN_COLOR : locked ? "#fb923c" : color;
  const softColor = useMemo(() => new THREE.Color(displayColor).lerp(new THREE.Color("#ffffff"), 0.22), [displayColor]);
  const highlighted = selected || focused || locked;
  const muted = (focusActive && !focused && !locked) || (lockActive && !locked);
  const suspicionTone = getAgentSuspicionTone(item);
  const toneColor = suspicionTone.color || displayColor;
  const toneMaterialColor = useMemo(() => new THREE.Color(toneColor), [toneColor]);

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
      <mesh scale={0.72 * suspicionTone.glowScale}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color={toneMaterialColor}
          transparent
          opacity={(muted ? 0.035 : highlighted ? 0.26 : 0.12) * suspicionTone.shellOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color={softColor}
          emissive={toneMaterialColor}
          emissiveIntensity={(muted ? 0.04 : highlighted ? 0.48 : 0.18) * suspicionTone.emissiveBoost}
          roughness={0.18}
          metalness={0}
          transparent
          opacity={(muted ? 0.08 : highlighted ? 0.4 : 0.22) * suspicionTone.coreOpacity}
          clearcoat={1}
          clearcoatRoughness={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={toneColor}
          transparent
          opacity={(muted ? 0.08 : highlighted ? 0.52 : 0.2) * suspicionTone.coreOpacity}
          wireframe
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.42 * suspicionTone.glowScale}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={toneColor}
          transparent
          opacity={(muted ? 0.025 : highlighted ? 0.16 : 0.07) * suspicionTone.shellOpacity}
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
  const distance = item.centroidDistance ?? item.avgCentroidDistance;
  const title = item.type === "ip" ? item.agentName || compactUserAgent(item.userAgent) : item.name;
  const secondary =
    item.type === "ip"
      ? `${item.clientIp}${item.userAgentCount > 1 ? ` - ${formatNumber(item.userAgentCount)} user agents` : ""}`
      : item.type === "agent"
        ? `${item.ips} IPs - ${item.userAgentCount} user agents`
        : item.type === "userAgent"
          ? `${formatNumber(item.ips)} IPs - JA4 ${compactJa4Digest(item.ja4Digest)}`
        : `Label ${item.label} - ${item.profile?.pattern || "Patron"}`;

  return (
    <Html
      position={[position[0], position[1] + 0.9, position[2]]}
      center
      zIndexRange={[30, 10]}
      style={{ pointerEvents: "none" }}
    >
      <div className="pointer-events-none min-w-44 rounded-md border border-white/15 bg-zinc-950/90 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-white/60">{secondary}</div>
        {item.type === "label" && item.profile?.reading ? (
          <div className="mt-1 max-w-56 text-white/50">{item.profile.reading}</div>
        ) : null}
        <div className="mt-1 text-cyan-200">{formatNumber(requests)} requests</div>
        {distance !== undefined ? (
          <div className="mt-1 text-orange-200">Distancia centroide: {formatDistance(distance)}</div>
        ) : null}
        {item.type === "ip" && item.timeWindowCount > 1 ? (
          <div className="mt-1 text-white/45">Ventanas: {formatNumber(item.timeWindowCount)}</div>
        ) : item.type === "ip" && item.timeWindow ? (
          <div className="mt-1 text-white/45">Ventana: {formatTimeWindow(item.timeWindow)}</div>
        ) : null}
      </div>
    </Html>
  );
}

function UserAgentCore({ userAgentGroup, color }) {
  const coreRef = useRef(null);
  const haloRef = useRef(null);
  const trailRef = useRef(null);
  const softColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.18), [color]);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 4.4) + 1) / 2;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + pulse * 0.18);
      coreRef.current.material.opacity = 0.55 + pulse * 0.34;
      coreRef.current.material.emissiveIntensity = 0.75 + pulse * 1.35;
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1.9 + pulse * 0.72);
      haloRef.current.material.opacity = 0.08 + pulse * 0.12;
    }
    if (trailRef.current) {
      trailRef.current.rotation.y += 0.006;
      trailRef.current.rotation.z += 0.002;
      trailRef.current.material.opacity = 0.18 + pulse * 0.16;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.82, 48, 48]} />
        <meshBasicMaterial color={softColor} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={trailRef}>
        <torusGeometry args={[1.15, 0.018, 16, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.36, 48, 48]} />
        <meshPhysicalMaterial
          color={softColor}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.18}
          transparent
          opacity={0.8}
          clearcoat={1}
          depthWrite={false}
        />
      </mesh>
      <Html position={[0, 1.55, 0]} center zIndexRange={[50, 20]} style={{ pointerEvents: "none" }}>
        <div className="pointer-events-none max-w-60 truncate rounded-md border border-orange-200/32 bg-black/45 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-orange-100 shadow-[0_0_24px_rgba(251,146,60,.24)] backdrop-blur-md">
          {userAgentGroup.name}
        </div>
      </Html>
    </group>
  );
}

function SpaceScene({
  clusters,
  activeLabel,
  activeAgent,
  activeUserAgent,
  metric,
  hovered,
  selectedRecord,
  mitigatedTargetId,
  layerTransition,
  setHovered,
  onSelect,
}) {
  const viewMode = activeUserAgent ? "userAgent" : activeAgent ? "agent" : activeLabel ? "label" : "universe";
  const focusActive =
    (hovered?.type === "label" && viewMode === "universe") ||
    (hovered?.type === "agent" && viewMode === "label");
  const lockActive = Boolean(activeUserAgent && selectedRecord);
  const items = useMemo(() => {
    if (activeUserAgent) {
      const ipNodes = buildIpNodes(activeUserAgent.records, activeUserAgent.label);
      const recordDistanceRange = getDistanceRange(ipNodes.map((record) => record.centroidDistance || 0));
      return ipNodes.map((record, index) => ({
        ...record,
        __position: getDistanceOrbitPosition(
          record,
          index,
          ipNodes.length,
          recordDistanceRange,
          1.7,
          12.8,
        ),
      }));
    }

    if (activeAgent) {
      const userAgentDistanceRange = getDistanceRange(activeAgent.userAgents.map((agent) => agent.avgCentroidDistance || 0));
      return activeAgent.userAgents.map((userAgentGroup, index) => ({
        ...userAgentGroup,
        __position: getDistanceOrbitPosition(
          userAgentGroup,
          index,
          activeAgent.userAgents.length,
          userAgentDistanceRange,
          2.4,
          13.4,
          1.65,
        ),
      }));
    }

    if (activeLabel) {
      const agentDistanceRange = getDistanceRange(activeLabel.agents.map((agent) => agent.avgCentroidDistance || 0));
      return activeLabel.agents.map((agent, index) => ({
        ...agent,
        profile: activeLabel.profile,
        __position: getDistanceOrbitPosition(
          agent,
          index,
          activeLabel.agents.length,
          agentDistanceRange,
          4.2,
          17.5,
          2.4,
        ),
      }));
    }

    const rankedClusters = [...clusters].sort((a, b) => metricValue(a, metric) - metricValue(b, metric));
    return rankedClusters.map((cluster, index) => ({
      ...cluster,
      __position: getRankedUniversePosition(cluster, index, rankedClusters.length),
    }));
  }, [activeAgent, activeLabel, activeUserAgent, clusters, metric]);

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
      <fog attach="fog" args={["#030712", 28, 78]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[3, 6, 5]} intensity={2.2} color="#e0f2fe" />
      <pointLight position={[-6, -2, -4]} intensity={1.6} color="#fda4af" />
      <Stars radius={80} depth={38} count={1400} factor={4} saturation={0} fade speed={0.4} />
      <CameraDirector
        viewMode={viewMode}
        activeLabel={activeLabel}
        activeAgent={activeAgent}
        activeUserAgent={activeUserAgent}
        selectedRecord={selectedRecord}
        selectedRadius={selectedRadius}
      />

      {activeUserAgent ? (
        <UserAgentCore userAgentGroup={activeUserAgent} color={labelColor(activeUserAgent.label)} />
      ) : activeLabel ? (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <meshStandardMaterial color={centerColor} emissive={centerColor} emissiveIntensity={0.8} />
        </mesh>
      ) : null}

      {activeUserAgent
        ? items.map((item) => (
            <Line
              key={`line-${item.id}`}
              points={[[0, 0, 0], item.__position]}
              color={(item.appliedRules || []).length > 0 ? ACTION_TAKEN_COLOR : labelColor(item.label)}
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
          actionVisual={viewMode !== "universe"}
          onSelect={onSelect}
          onHover={setHovered}
        />
      ))}

      {focusActive && hovered ? (
        <TacticalHoverPanel item={hovered} radius={sphereRadius(hovered, metric, hovered.type, maxVisibleMetric)} />
      ) : null}

      {activeUserAgent && selectedRecord ? (
        <TargetLockConnector
          item={selectedRecord}
          radius={selectedRadius}
          mitigated={mitigatedTargetId === selectedRecord.id || (selectedRecord.appliedRules || []).length > 0}
        />
      ) : null}

      {hovered && (hovered.type === "ip" || hovered.type === "userAgent") ? <HoverTooltip item={hovered} /> : null}
      <SceneOrbitControls activeAgent={activeUserAgent} selectedRecord={selectedRecord} selectedRadius={selectedRadius} />
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

function InitialLabelLegend({ clusters }) {
  if (!clusters.length) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden w-[min(92vw,860px)] -translate-x-1/2 md:block">
      <div className="pointer-events-auto rounded-md border border-white/10 bg-black/38 px-3 py-2 text-white shadow-2xl shadow-black/25 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {clusters.map((cluster) => (
            <div key={cluster.id} className="flex min-w-0 items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/35 shadow-[0_0_12px_currentColor]"
                style={{ backgroundColor: labelColor(cluster.label), color: labelColor(cluster.label) }}
              />
              <span className="max-w-44 truncate font-semibold text-white/78">{cluster.name}</span>
              <span className="font-mono text-white/38">{formatNumber(cluster.records.length)}</span>
            </div>
          ))}
        </div>
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
  const appliedRules = isAgent ? item.appliedRules || [] : [];
  const statItems = isAgent
    ? [
        { label: "IPs detectadas", value: formatNumber(item.ips), icon: Globe2 },
        { label: "Requests", value: formatNumber(item.requests), icon: Activity },
        { label: "Distancia", value: formatDistance(item.avgCentroidDistance), icon: Crosshair },
        { label: "User agents", value: formatNumber(item.userAgentCount), icon: Bot },
      ]
    : [
        { label: "IPs asociadas", value: formatNumber(item.ips), icon: Globe2 },
        { label: "Requests", value: formatNumber(item.requests), icon: Activity },
        { label: "Distancia", value: formatDistance(item.avgCentroidDistance), icon: Crosshair },
        { label: "JA4 digests", value: formatNumber(item.agents.length), icon: Fingerprint },
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
              {isAgent ? "JA4 lock" : "Pattern lock"}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{item.name}</h2>
          </div>
          <div className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
            Label {item.label}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
          <div className="text-[11px] uppercase tracking-normal text-white/45">
            {isAgent ? "JA4 observado" : "Patron observado"}
          </div>
          <div className="mt-1 text-sm font-medium text-white">{isAgent ? profile.pattern : item.profile?.pattern}</div>
          <p className="mt-2 text-sm leading-6 text-white/62">
            {isAgent
              ? "Agrupacion de IPs que comparten este JA4 digest dentro del patron seleccionado."
              : item.profile?.reading}
          </p>
          {isAgent ? (
            <div className="mt-3 max-h-24 overflow-hidden rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs leading-5 text-white/55">
              <div className="font-mono text-cyan-100/80">{item.ja4Digest}</div>
              <div className="mt-2 text-white/45">{formatNumber(item.userAgentCount)} user agents asociados</div>
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
  const [activeUserAgentId, setActiveUserAgentId] = useState(null);
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
  const activeUserAgent = activeAgent?.userAgents.find((userAgent) => userAgent.id === activeUserAgentId) || null;
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
      setActiveUserAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    });
  }

  function openAgent(item) {
    startLayerTransition(item, () => {
      setActiveAgentId(item.id);
      setActiveUserAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    });
  }

  function openUserAgent(item) {
    startLayerTransition(item, () => {
      setActiveUserAgentId(item.id);
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

    if (item.type === "userAgent") {
      openUserAgent(item);
      return;
    }

    setSelectedRecord(item);
    setMitigatedTargetId(null);
    setMeasuresOpen(false);
  }

  function goBack() {
    if (activeUserAgent) {
      setActiveUserAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
      return;
    }

    if (activeAgent) {
      setActiveAgentId(null);
      setActiveUserAgentId(null);
      setSelectedRecord(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
      return;
    }

    if (activeLabel) {
      setActiveLabelId(null);
      setSelectedRecord(null);
      setActiveUserAgentId(null);
      setMitigatedTargetId(null);
      setMeasuresOpen(false);
    }
  }

  const modeTitle = activeUserAgent
    ? `${activeUserAgent.name}: IPs asociadas`
    : activeAgent
      ? `${activeAgent.name}: user agents`
    : activeLabel
      ? `${activeLabel.name}: JA4 digests`
      : "Espacio de labels";
  const modeDescription = activeLabel
    ? activeUserAgent
      ? "Nucleo activo del user agent seleccionado. Abre una IP para fijar el target y tomar medidas."
      : activeAgent
        ? "User agents agrupados dentro del JA4 seleccionado, sin importar la IP."
        : activeLabel.profile?.reading
    : "Gira el espacio, entra a un patron y abre un JA4 digest para dividirlo por IP. El tamano cambia con la metrica activa.";
  const breadcrumbs = [
    { label: "Sector", value: "Espacio de labels" },
    ...(activeLabel ? [{ label: `Label ${activeLabel.label}`, value: activeLabel.name }] : []),
    ...(activeAgent ? [{ label: "JA4", value: activeAgent.name }] : []),
    ...(activeUserAgent ? [{ label: "User agent", value: activeUserAgent.name }] : []),
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
          camera={{ position: [0, 3, 16], fov: 48 }}
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <SpaceScene
            clusters={clusters}
            activeLabel={activeLabel}
            activeAgent={activeAgent}
            activeUserAgent={activeUserAgent}
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
      {!activeLabel && !selectedRecordWithRules ? <InitialLabelLegend clusters={clusters} /> : null}

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
                    setActiveUserAgentId(null);
                    setSelectedRecord(null);
                    setMitigatedTargetId(null);
                    setMeasuresOpen(false);
                  }}
                  placeholder="Buscar JA4, user agent o IP"
                  className="h-10 w-full rounded-md border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-cyan-300"
                />
              </label>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-white/55">
                <div className="flex items-center gap-1.5">
                  <CircleDot size={13} />
                  Patron
                </div>
                <div className="flex items-center gap-1.5">
                  <Fingerprint size={13} />
                  JA4
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
              activeAgent={activeUserAgent}
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
          activeAgent={activeUserAgent}
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
