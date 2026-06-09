"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  ChevronLeft,
  CircleDot,
  Crosshair,
  Database,
  Globe2,
  MousePointer2,
  Network,
  Radar,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import * as THREE from "three";

const ENDPOINT = process.env.NEXT_PUBLIC_ML_TRAFFIC_ENDPOINT || "/data/data.json";
const LABEL_COLORS = ["#38bdf8", "#fb7185", "#34d399", "#a78bfa", "#fbbf24", "#22d3ee"];
const METRICS = [
  { id: "requests", label: "Requests" },
  { id: "routes", label: "Rutas" },
  { id: "window", label: "Ventana" },
];

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
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
        name: `Label ${record.label}`,
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
      };
    })
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-MX").format(Math.round(value || 0));
}

function formatMs(value) {
  if (!value) return "0 ms";
  if (value < 1000) return `${Math.round(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
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

  const base = mode === "label" ? 0.9 : mode === "agent" ? 0.48 : 0.28;
  const boost = Math.log2(value + 1) * (mode === "label" ? 0.34 : mode === "agent" ? 0.18 : 0.12);
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

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-normal text-white/55">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function CameraDirector({ viewMode, activeLabel, activeAgent }) {
  const { camera, size } = useThree();
  const framesLeft = useRef(0);
  const viewKey = `${viewMode}-${activeLabel?.id || "none"}-${activeAgent?.id || "none"}`;
  const isCompact = size.width < 720;
  const target = useMemo(() => {
    if (viewMode === "agent" && activeAgent) return new THREE.Vector3(0, isCompact ? 1.2 : 0.6, isCompact ? 11 : 6.8);
    if (viewMode === "label" && activeLabel) return new THREE.Vector3(0, isCompact ? 1.8 : 1.2, isCompact ? 13 : 9);
    return new THREE.Vector3(0, isCompact ? 3.4 : 2.6, isCompact ? 18 : 12);
  }, [activeAgent, activeLabel, isCompact, viewMode]);

  useEffect(() => {
    framesLeft.current = 70;
  }, [viewKey, isCompact]);

  useFrame(() => {
    if (framesLeft.current <= 0) return;
    framesLeft.current -= 1;
    camera.position.lerp(target, 0.045);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SpaceSphere({ item, position, radius, color, mode, selected, onSelect, onHover }) {
  const groupRef = useRef(null);
  const materialColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const seed = (hashString(item.id) % 100) / 100;
    groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.9 + seed * 8) * 0.08;
    groupRef.current.rotation.y += 0.004 + seed * 0.002;
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
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={materialColor}
          emissive={materialColor}
          emissiveIntensity={selected ? 0.55 : 0.22}
          roughness={0.36}
          metalness={0.18}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.2 : 0.08} wireframe />
      </mesh>
      {radius > 0.55 ? (
        <Html position={[0, radius + 0.34, 0]} center>
          <div className="pointer-events-none max-w-36 truncate rounded-full border border-white/10 bg-black/35 px-2 py-1 text-center text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
            {item.name}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function HoverTooltip({ item }) {
  if (!item) return null;

  const position = item.__position || [0, 0, 0];
  const requests = item.requests ?? 0;
  const secondary = item.type === "ip" ? item.clientIp : item.type === "agent" ? `${item.ips} IPs` : `${item.agents.length} agents`;

  return (
    <Html position={[position[0], position[1] + 0.9, position[2]]} center>
      <div className="pointer-events-none min-w-44 rounded-md border border-white/15 bg-zinc-950/90 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
        <div className="font-semibold">{item.name}</div>
        <div className="mt-1 text-white/60">{secondary}</div>
        <div className="mt-1 text-cyan-200">{formatNumber(requests)} requests</div>
      </div>
    </Html>
  );
}

function BotSpaceScene({ clusters, activeLabel, activeAgent, metric, hovered, setHovered, onSelect }) {
  const viewMode = activeAgent ? "agent" : activeLabel ? "label" : "universe";
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

  return (
    <>
      <color attach="background" args={["#030712"]} />
      <fog attach="fog" args={["#030712", 12, 28]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[3, 6, 5]} intensity={2.2} color="#e0f2fe" />
      <pointLight position={[-6, -2, -4]} intensity={1.6} color="#fda4af" />
      <Stars radius={80} depth={38} count={1400} factor={4} saturation={0} fade speed={0.4} />
      <CameraDirector viewMode={viewMode} activeLabel={activeLabel} activeAgent={activeAgent} />

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
              color={labelColor(item.label)}
              lineWidth={1}
              transparent
              opacity={0.34}
            />
          ))
        : null}

      {items.map((item) => (
        <SpaceSphere
          key={item.id}
          item={item}
          mode={item.type}
          position={item.__position}
          radius={sphereRadius(item, metric, item.type, maxVisibleMetric)}
          color={item.type === "ip" ? (item.oneShot ? "#94a3b8" : labelColor(item.label)) : labelColor(item.label)}
          selected={activeAgent?.id === item.id || hovered?.id === item.id}
          onSelect={onSelect}
          onHover={setHovered}
        />
      ))}

      {hovered ? <HoverTooltip item={hovered} /> : null}
      <OrbitControls enableDamping dampingFactor={0.07} minDistance={4.5} maxDistance={18} />
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-white/10 py-3 last:border-b-0">
      <div className="text-[11px] uppercase tracking-normal text-white/45">{label}</div>
      <div className="mt-1 break-words text-sm text-white">{value}</div>
    </div>
  );
}

export default function BotSpaceClient() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("requests");
  const [query, setQuery] = useState("");
  const [activeLabelId, setActiveLabelId] = useState(null);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [hovered, setHovered] = useState(null);

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

  const filteredRecords = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return records;
    return records.filter(
      (record) =>
        record.userAgent.toLowerCase().includes(cleanQuery) ||
        record.agentName.toLowerCase().includes(cleanQuery) ||
        record.clientIp.toLowerCase().includes(cleanQuery) ||
        record.ja4Digest.toLowerCase().includes(cleanQuery),
    );
  }, [query, records]);

  const clusters = useMemo(() => buildClusters(filteredRecords), [filteredRecords]);
  const activeLabel = clusters.find((cluster) => cluster.id === activeLabelId) || null;
  const activeAgent = activeLabel?.agents.find((agent) => agent.id === activeAgentId) || null;
  const totalRequests = filteredRecords.reduce((sum, item) => sum + item.requests, 0);
  const totalRoutes = filteredRecords.reduce((sum, item) => sum + item.routes, 0);
  const recurrentCount = filteredRecords.filter((item) => !item.oneShot).length;

  useEffect(() => {
    if (activeLabelId && !activeLabel) {
      setActiveLabelId(null);
      setActiveAgentId(null);
      setSelectedRecord(null);
    }
  }, [activeLabel, activeLabelId]);

  useEffect(() => {
    if (activeAgentId && !activeAgent) {
      setActiveAgentId(null);
      setSelectedRecord(null);
    }
  }, [activeAgent, activeAgentId]);

  function handleSelect(item) {
    if (item.type === "label") {
      setActiveLabelId(item.id);
      setActiveAgentId(null);
      setSelectedRecord(null);
      return;
    }

    if (item.type === "agent") {
      setActiveAgentId(item.id);
      setSelectedRecord([...item.records].sort((a, b) => b.requests - a.requests)[0] || null);
      return;
    }

    setSelectedRecord(item);
  }

  function goBack() {
    if (activeAgent) {
      setActiveAgentId(null);
      setSelectedRecord(null);
      return;
    }

    if (activeLabel) {
      setActiveLabelId(null);
      setSelectedRecord(null);
    }
  }

  const modeTitle = activeAgent
    ? `${activeAgent.name}: IPs desplegadas`
    : activeLabel
      ? `${activeLabel.name}: user agents`
      : "Espacio de labels";

  return (
    <main className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 2.6, 12], fov: 48 }}
          dpr={[1, 1.8]}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <BotSpaceScene
            clusters={clusters}
            activeLabel={activeLabel}
            activeAgent={activeAgent}
            metric={metric}
            hovered={hovered}
            setHovered={setHovered}
            onSelect={handleSelect}
          />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 via-black/25 to-transparent p-4 sm:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="pointer-events-auto max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
              <Sparkles size={17} />
              Edunautica bot space
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">{modeTitle}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
              Gira el espacio, entra a un label y abre un user agent para dividirlo por IP. El tamano cambia con la metrica activa.
            </p>
          </div>

          <div className="pointer-events-auto flex flex-wrap gap-2">
            {activeLabel ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/15"
              >
                <ChevronLeft size={17} />
                Volver
              </button>
            ) : null}
            {METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMetric(item.id)}
                className={`h-10 rounded-md border px-3 text-sm font-medium backdrop-blur-md transition ${
                  metric === item.id
                    ? "border-cyan-300 bg-cyan-300 text-zinc-950"
                    : "border-white/15 bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-4 grid max-w-7xl gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatPill icon={Database} label="Registros" value={formatNumber(filteredRecords.length)} />
          <StatPill icon={Activity} label="Requests" value={formatNumber(totalRequests)} />
          <StatPill icon={Route} label="Rutas" value={formatNumber(totalRoutes)} />
          <StatPill icon={ShieldAlert} label="Recurrentes" value={formatNumber(recurrentCount)} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="pointer-events-auto max-w-md rounded-md border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/30 backdrop-blur-md">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar bot, user agent, IP o JA4"
              className="h-10 w-full rounded-md border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-cyan-300"
            />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/55">
            <div className="flex items-center gap-1.5">
              <CircleDot size={13} />
              Label
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

        <aside className="pointer-events-auto w-full rounded-md border border-white/10 bg-black/45 p-4 shadow-2xl shadow-black/35 backdrop-blur-md lg:w-[360px]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MousePointer2 size={16} />
            Seleccion
          </div>
          {loading ? (
            <div className="mt-4 text-sm text-white/60">Cargando dataset ML...</div>
          ) : error ? (
            <div className="mt-4 text-sm text-red-200">{error}</div>
          ) : selectedRecord ? (
            <div className="mt-2">
              <DetailRow label="IP" value={selectedRecord.clientIp} />
              <DetailRow label="Agente" value={selectedRecord.agentName} />
              <DetailRow label="User agent" value={selectedRecord.userAgent} />
              <DetailRow label="JA4 digest" value={selectedRecord.ja4Digest} />
              <div className="grid grid-cols-2 gap-2 py-3">
                <div className="rounded-md bg-cyan-300/15 p-3">
                  <div className="flex items-center gap-2 text-xs text-cyan-100">
                    <Network size={14} />
                    Requests
                  </div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(selectedRecord.requests)}</div>
                </div>
                <div className="rounded-md bg-rose-300/15 p-3">
                  <div className="flex items-center gap-2 text-xs text-rose-100">
                    <Timer size={14} />
                    Ventana
                  </div>
                  <div className="mt-1 text-lg font-semibold">{formatMs(selectedRecord.activityWindowMs)}</div>
                </div>
              </div>
              <DetailRow label="Rutas visitadas" value={formatNumber(selectedRecord.routes)} />
              <DetailRow label="Media entre requests" value={formatMs(selectedRecord.meanBetweenMs)} />
              <DetailRow label="Tipo" value={selectedRecord.oneShot ? "One-shot" : "Recurrente"} />
            </div>
          ) : activeAgent ? (
            <div className="mt-4 text-sm leading-6 text-white/60">
              Selecciona una IP orbitando el user agent para ver el detalle.
            </div>
          ) : activeLabel ? (
            <div className="mt-4 text-sm leading-6 text-white/60">
              Selecciona una esfera de user agent para desplegar sus IPs.
            </div>
          ) : (
            <div className="mt-4 text-sm leading-6 text-white/60">
              Selecciona un label para entrar al cluster. Usa arrastre para girar y scroll para acercarte.
            </div>
          )}
        </aside>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/45 backdrop-blur-md md:flex">
        <Crosshair size={13} />
        orbit controls active
      </div>
    </main>
  );
}
