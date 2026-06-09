"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import {
  Activity,
  Bot,
  ChevronLeft,
  Filter,
  Globe2,
  MousePointer2,
  Network,
  Radar,
  RefreshCcw,
  Search,
  ShieldAlert,
  Timer,
  Wifi,
} from "lucide-react";

const ENDPOINT = process.env.NEXT_PUBLIC_ML_TRAFFIC_ENDPOINT || "/data/data.json";

const LABEL_COLORS = ["#2563eb", "#dc2626", "#059669", "#7c3aed", "#d97706", "#0891b2"];
const METRIC_OPTIONS = [
  { id: "requests", label: "Requests" },
  { id: "routes", label: "Rutas" },
  { id: "window", label: "Ventana" },
];

function getRecordValue(record, key, fallback = "") {
  return record[key] ?? fallback;
}

function compactUserAgent(userAgent) {
  if (!userAgent) return "Unknown agent";

  const lower = userAgent.toLowerCase();
  const knownAgents = [
    ["OAI-SearchBot", "OAI SearchBot"],
    ["ChatGPT-User", "ChatGPT User"],
    ["GPTBot", "GPTBot"],
    ["Googlebot", "Googlebot"],
    ["bingbot", "Bingbot"],
    ["ClaudeBot", "ClaudeBot"],
    ["CriteoBot", "CriteoBot"],
    ["Lanai", "Lanai"],
    ["ias-va", "IAS crawler"],
  ];

  const match = knownAgents.find(([token]) => lower.includes(token.toLowerCase()));
  if (match) return match[1];

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
  return userAgent.length > 46 ? `${userAgent.slice(0, 43)}...` : userAgent;
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

function getMetricValue(item, metric) {
  if (metric === "routes") return item.routes || 1;
  if (metric === "window") return Math.max(1, item.activityWindowMs / 1000);
  return item.requests || 1;
}

function normalizeRecords(records) {
  return records.map((record, index) => {
    const userAgent = getRecordValue(record, "proxy.userAgent", "Unknown agent");
    const clientIp = getRecordValue(record, "proxy.clientIp", "0.0.0.0");

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
  const labels = new Map();

  for (const record of records) {
    if (!labels.has(record.label)) {
      labels.set(record.label, {
        id: `label-${record.label}`,
        label: record.label,
        name: `Label ${record.label}`,
        records: [],
        agents: new Map(),
      });
    }

    const labelGroup = labels.get(record.label);
    labelGroup.records.push(record);

    const agentKey = `${record.agentName}|${record.userAgent}`;
    if (!labelGroup.agents.has(agentKey)) {
      labelGroup.agents.set(agentKey, {
        id: `agent-${record.label}-${agentKey}`,
        label: record.label,
        name: record.agentName,
        userAgent: record.userAgent,
        records: [],
      });
    }

    labelGroup.agents.get(agentKey).records.push(record);
  }

  return Array.from(labels.values())
    .map((labelGroup) => {
      const agents = Array.from(labelGroup.agents.values()).map((agentGroup) => ({
        ...agentGroup,
        requests: agentGroup.records.reduce((sum, item) => sum + item.requests, 0),
        routes: agentGroup.records.reduce((sum, item) => sum + item.routes, 0),
        activityWindowMs: agentGroup.records.reduce((sum, item) => sum + item.activityWindowMs, 0),
        oneShotCount: agentGroup.records.filter((item) => item.oneShot).length,
        ips: new Set(agentGroup.records.map((item) => item.clientIp)).size,
      }));

      const totalRequests = labelGroup.records.reduce((sum, item) => sum + item.requests, 0);
      const oneShotCount = labelGroup.records.filter((item) => item.oneShot).length;
      const recurrentCount = labelGroup.records.length - oneShotCount;

      return {
        ...labelGroup,
        agents,
        requests: totalRequests,
        routes: labelGroup.records.reduce((sum, item) => sum + item.routes, 0),
        activityWindowMs: labelGroup.records.reduce((sum, item) => sum + item.activityWindowMs, 0),
        oneShotCount,
        recurrentCount,
        uniqueAgents: agents.length,
        uniqueIps: new Set(labelGroup.records.map((item) => item.clientIp)).size,
        behavior:
          oneShotCount / Math.max(1, labelGroup.records.length) > 0.8
            ? "One-shot / exploracion"
            : totalRequests / Math.max(1, labelGroup.records.length) >= 3
              ? "Recurrente / alta intencion"
              : "Mixto",
      };
    })
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 820, height: 620 });

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(420, entry.contentRect.height),
      });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function StatCard({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral: "border-zinc-200 bg-white text-zinc-950",
    blue: "border-blue-100 bg-blue-50 text-blue-950",
    red: "border-red-100 bg-red-50 text-red-950",
    green: "border-emerald-100 bg-emerald-50 text-emerald-950",
  };

  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-zinc-500">
        <Icon size={15} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-zinc-100 py-3 last:border-b-0">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-950">{value}</div>
    </div>
  );
}

export default function MlTrafficAtlas() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [metric, setMetric] = useState("requests");
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [chartRef, chartSize] = useElementSize();

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
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

    loadData();
    return () => {
      alive = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesMode =
        filterMode === "all" ||
        (filterMode === "one-shot" && record.oneShot) ||
        (filterMode === "recurrent" && !record.oneShot);
      const matchesQuery =
        !cleanQuery ||
        record.userAgent.toLowerCase().includes(cleanQuery) ||
        record.agentName.toLowerCase().includes(cleanQuery) ||
        record.clientIp.toLowerCase().includes(cleanQuery) ||
        record.ja4Digest.toLowerCase().includes(cleanQuery);

      return matchesMode && matchesQuery;
    });
  }, [filterMode, query, records]);

  const clusters = useMemo(() => buildClusters(filteredRecords), [filteredRecords]);
  const activeCluster = clusters.find((cluster) => cluster.label === selectedLabel) || null;
  const totalRequests = filteredRecords.reduce((sum, item) => sum + item.requests, 0);
  const totalRoutes = filteredRecords.reduce((sum, item) => sum + item.routes, 0);
  const recurrentRecords = filteredRecords.filter((item) => !item.oneShot).length;
  const color = useMemo(() => scaleOrdinal().domain(clusters.map((item) => item.label)).range(LABEL_COLORS), [clusters]);
  const topAgents = useMemo(() => {
    const source = activeCluster ? activeCluster.agents : clusters.flatMap((cluster) => cluster.agents);
    return [...source].sort((a, b) => b.requests - a.requests).slice(0, 6);
  }, [activeCluster, clusters]);

  useEffect(() => {
    if (selectedLabel && !activeCluster) {
      setSelectedLabel(null);
      setSelectedAgent(null);
      setSelectedRecord(null);
    }
  }, [activeCluster, selectedLabel]);

  const bubbles = useMemo(() => {
    const width = chartSize.width;
    const height = chartSize.height;
    const items = activeCluster
      ? activeCluster.agents.map((agent) => ({
          ...agent,
          type: "agent",
          value: getMetricValue(agent, metric),
        }))
      : clusters.map((cluster) => ({
          ...cluster,
          type: "label",
          value: getMetricValue(cluster, metric),
        }));

    const root = hierarchy({ children: items })
      .sum((item) => Math.max(1, item.value || 1))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    return pack().size([width, height]).padding(activeCluster ? 16 : 22)(root).leaves();
  }, [activeCluster, chartSize, clusters, metric]);

  const maxRequests = useMemo(() => {
    const source = activeCluster ? activeCluster.agents : clusters;
    return Math.max(...source.map((item) => item.requests || 1), 1);
  }, [activeCluster, clusters]);
  const opacityScale = useMemo(() => scaleLinear().domain([1, maxRequests]).range([0.66, 0.95]), [maxRequests]);

  function selectBubble(node) {
    const item = node.data;
    if (item.type === "label") {
      setSelectedLabel(item.label);
      setSelectedAgent(null);
      setSelectedRecord(null);
      return;
    }

    const sorted = [...item.records].sort((a, b) => b.requests - a.requests);
    setSelectedAgent(item);
    setSelectedRecord(sorted[0] || null);
  }

  function selectAgent(agent) {
    const sorted = [...agent.records].sort((a, b) => b.requests - a.requests);
    setSelectedAgent(agent);
    setSelectedRecord(sorted[0] || null);
    if (!selectedLabel) setSelectedLabel(agent.label);
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Radar size={17} />
                Edunautica.mx traffic ML showcase
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Atlas de comportamiento por labels
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
                Explorador alpha para revisar como el pipeline agrupa agentes, IPs, ventanas de actividad y senales JA4 en
                intervalos de diez minutos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {METRIC_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMetric(option.id)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    metric === option.id
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Network} label="Registros" value={formatNumber(filteredRecords.length)} />
            <StatCard icon={Activity} label="Requests" value={formatNumber(totalRequests)} tone="blue" />
            <StatCard icon={Globe2} label="Rutas" value={formatNumber(totalRoutes)} tone="green" />
            <StatCard icon={ShieldAlert} label="Recurrentes" value={formatNumber(recurrentRecords)} tone="red" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 rounded-md border border-zinc-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {activeCluster ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLabel(null);
                    setSelectedAgent(null);
                    setSelectedRecord(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:border-zinc-400"
                  title="Volver a labels"
                >
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <div>
                <div className="text-sm font-semibold text-zinc-950">
                  {activeCluster ? `${activeCluster.name}: user agents agrupados` : "Labels detectados"}
                </div>
                <div className="text-xs text-zinc-500">
                  Click en una esfera para expandir o inspeccionar. Tamano actual: {METRIC_OPTIONS.find((item) => item.id === metric)?.label}.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar agente, IP o JA4"
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 sm:w-64"
                />
              </label>
              <select
                value={filterMode}
                onChange={(event) => setFilterMode(event.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-zinc-500"
              >
                <option value="all">Todos</option>
                <option value="one-shot">One-shot</option>
                <option value="recurrent">Recurrentes</option>
              </select>
            </div>
          </div>

          <div ref={chartRef} className="relative h-[620px] overflow-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                <RefreshCcw className="mr-2 animate-spin" size={16} />
                Cargando dataset ML...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">{error}</div>
            ) : bubbles.length ? (
              <svg className="h-full w-full" role="img" aria-label="Bubble chart de labels ML">
                <rect width="100%" height="100%" fill="#ffffff" />
                {bubbles.map((node) => {
                  const item = node.data;
                  const fill = color(item.label);
                  const title = item.type === "label" ? item.name : item.name;
                  const subtitle =
                    item.type === "label"
                      ? `${item.records.length} registros`
                      : `${item.ips} IP${item.ips === 1 ? "" : "s"}`;

                  return (
                    <g
                      key={item.id}
                      transform={`translate(${node.x},${node.y})`}
                      className="cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                      onClick={() => selectBubble(node)}
                    >
                      <circle
                        r={node.r}
                        fill={fill}
                        fillOpacity={opacityScale(item.requests || 1)}
                        stroke={activeCluster ? "#ffffff" : "#e5e7eb"}
                        strokeWidth={activeCluster ? 2 : 3}
                      />
                      <circle r={Math.max(0, node.r - 8)} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
                      {node.r > 48 ? (
                        <>
                          <text
                            textAnchor="middle"
                            y={-8}
                            className="pointer-events-none fill-white text-[13px] font-semibold"
                          >
                            {title.length > 18 ? `${title.slice(0, 16)}...` : title}
                          </text>
                          <text textAnchor="middle" y={12} className="pointer-events-none fill-white text-[11px] opacity-90">
                            {subtitle}
                          </text>
                          <text textAnchor="middle" y={31} className="pointer-events-none fill-white text-[11px] opacity-85">
                            {formatNumber(item.requests)} req
                          </text>
                        </>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                No hay registros para los filtros actuales.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Filter size={16} />
              Lectura del cluster
            </div>
            {activeCluster ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-zinc-200 p-3">
                  <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{activeCluster.name}</div>
                  <div className="mt-1 text-lg font-semibold">{activeCluster.behavior}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Agentes</div>
                    <div className="font-semibold">{activeCluster.uniqueAgents}</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">IPs</div>
                    <div className="font-semibold">{activeCluster.uniqueIps}</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">One-shot</div>
                    <div className="font-semibold">{activeCluster.oneShotCount}</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Recurrentes</div>
                    <div className="font-semibold">{activeCluster.recurrentCount}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Selecciona un label para abrir sus user agents. Los labels se dimensionan por la metrica activa.
              </p>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <MousePointer2 size={16} />
              Entidad seleccionada
            </div>
            {selectedAgent ? (
              <div className="mt-3">
                <div className="rounded-md border border-zinc-200 p-3">
                  <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">User agent group</div>
                  <div className="mt-1 break-words text-sm font-semibold text-zinc-950">{selectedAgent.name}</div>
                  <div className="mt-2 text-xs leading-5 text-zinc-500">{selectedAgent.userAgent}</div>
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                  {[...selectedAgent.records]
                    .sort((a, b) => b.requests - a.requests)
                    .map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className={`w-full rounded-md border p-3 text-left transition ${
                          selectedRecord?.id === record.id
                            ? "border-zinc-950 bg-zinc-950 text-white"
                            : "border-zinc-100 bg-white text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-sm font-medium">
                          <span className="truncate">{record.clientIp}</span>
                          <span>{formatNumber(record.requests)} req</span>
                        </div>
                        <div className={selectedRecord?.id === record.id ? "mt-1 text-xs text-zinc-300" : "mt-1 text-xs text-zinc-500"}>
                          {record.oneShot ? "One-shot" : "Recurrente"} · {formatMs(record.activityWindowMs)}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            {selectedRecord ? (
              <div className="mt-3">
                <DetailRow label="IP" value={selectedRecord.clientIp} />
                <DetailRow label="Agente" value={selectedRecord.agentName} />
                <DetailRow label="User agent completo" value={selectedRecord.userAgent} />
                <DetailRow label="JA4 digest" value={selectedRecord.ja4Digest} />
                <div className="grid grid-cols-2 gap-2 py-3">
                  <div className="rounded-md bg-blue-50 p-3 text-blue-950">
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <Wifi size={14} />
                      Requests
                    </div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(selectedRecord.requests)}</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-3 text-emerald-950">
                    <div className="flex items-center gap-2 text-xs text-emerald-700">
                      <Bot size={14} />
                      Rutas
                    </div>
                    <div className="mt-1 text-lg font-semibold">{formatNumber(selectedRecord.routes)}</div>
                  </div>
                </div>
                <DetailRow label="Ventana de actividad" value={formatMs(selectedRecord.activityWindowMs)} />
                <DetailRow label="Media entre requests" value={formatMs(selectedRecord.meanBetweenMs)} />
                <DetailRow label="Mediana entre requests" value={formatMs(selectedRecord.medianBetweenMs)} />
                <DetailRow label="Tipo" value={selectedRecord.oneShot ? "One-shot" : "Recurrente"} />
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                {activeCluster
                  ? "Selecciona una burbuja de user agent para inspeccionar sus IPs."
                  : "Primero abre un label para ver agentes e IPs."}
              </div>
            )}
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Timer size={16} />
              Top agentes
            </div>
            <div className="mt-3 space-y-2">
              {topAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => selectAgent(agent)}
                    className="w-full rounded-md border border-zinc-100 p-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <div className="truncate text-sm font-medium text-zinc-950">{agent.name}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                      <span>{agent.ips} IPs</span>
                      <span>{formatNumber(agent.requests)} req</span>
                    </div>
                  </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
