"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  FileJson,
  LoaderCircle,
  Network,
  Orbit,
  Play,
  RadioTower,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

type DrawerStatus = "briefing" | "running" | "success" | "error";

type ApiResult = {
  status: "ok" | "error";
  message?: string;
  records?: number;
  output?: string;
  detail?: string;
};

const PIPELINE_STEPS = [
  {
    id: "extract",
    label: "01",
    title: "Extract signals",
    description: "Leer ventanas de tráfico desde el dataset incluido.",
    icon: Database,
    tone: "cyan",
  },
  {
    id: "features",
    label: "02",
    title: "Align features",
    description: "Alinear columnas con el artefacto entrenado.",
    icon: Network,
    tone: "slate",
  },
  {
    id: "artifact",
    label: "03",
    title: "Load artifact",
    description: "Cargar modelo KMeans y metadata del entrenamiento.",
    icon: Cpu,
    tone: "purple",
  },
  {
    id: "labeling",
    label: "04",
    title: "Labeling",
    description: "Asignar labels a firmas de tráfico detectadas.",
    icon: Bot,
    tone: "orange",
  },
  {
    id: "export",
    label: "05",
    title: "Export dataset",
    description: "Guardar el dataset operativo para el mapa 3D.",
    icon: FileJson,
    tone: "emerald",
  },
];

const CONSOLE_MESSAGES = [
  "opening bundled synthetic dataset",
  "starting deterministic demo scenario",
  "loading simulated KMeans metadata",
  "reading synthetic traffic windows",
  "aligning feature columns",
  "running label assignment",
  "serializing tactical dataset",
  "reading /public/data/demo-predictions.json",
  "validating static demo payload",
];

function getToneClasses(tone: string) {
  if (tone === "orange") {
    return {
      border: "border-orange-300/35",
      bg: "bg-orange-300/10",
      text: "text-orange-100",
      glow: "shadow-[0_0_30px_rgba(251,146,60,.16)]",
      dot: "bg-orange-200",
    };
  }

  if (tone === "emerald") {
    return {
      border: "border-emerald-300/35",
      bg: "bg-emerald-300/10",
      text: "text-emerald-100",
      glow: "shadow-[0_0_30px_rgba(52,211,153,.14)]",
      dot: "bg-emerald-200",
    };
  }

  if (tone === "purple") {
    return {
      border: "border-violet-300/30",
      bg: "bg-violet-300/10",
      text: "text-violet-100",
      glow: "shadow-[0_0_30px_rgba(167,139,250,.14)]",
      dot: "bg-violet-200",
    };
  }

  if (tone === "slate") {
    return {
      border: "border-white/15",
      bg: "bg-white/[0.06]",
      text: "text-white",
      glow: "shadow-[0_0_30px_rgba(255,255,255,.06)]",
      dot: "bg-white",
    };
  }

  return {
    border: "border-cyan-300/35",
    bg: "bg-cyan-300/10",
    text: "text-cyan-100",
    glow: "shadow-[0_0_30px_rgba(34,211,238,.16)]",
    dot: "bg-cyan-200",
  };
}

function PipelineStepNode({
  step,
  index,
}: {
  step: (typeof PIPELINE_STEPS)[number];
  index: number;
}) {
  const Icon = step.icon;
  const tone = getToneClasses(step.tone);

  return (
    <div className="relative">
      {index < PIPELINE_STEPS.length - 1 ? (
        <div className="absolute left-5 top-12 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-cyan-200/35 via-white/10 to-orange-200/20" />
      ) : null}

      <div
        className={`relative overflow-hidden rounded-md border ${tone.border} ${tone.bg} ${tone.glow} p-4 backdrop-blur-xl`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.065)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:18px_18px] opacity-35" />

        <div className="relative flex gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${tone.border} bg-black/30 ${tone.text}`}
          >
            <Icon size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} shadow-[0_0_12px_currentColor]`} />
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">
                Step {step.label}
              </div>
            </div>

            <h3 className={`mt-1 text-base font-semibold ${tone.text}`}>
              {step.title}
            </h3>

            <p className="mt-1 text-sm leading-6 text-white/58">
              {step.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TacticalBriefing({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.92fr_1fr]">
      <section className="overflow-hidden rounded-md border border-cyan-200/20 bg-cyan-200/10 p-5 shadow-2xl shadow-cyan-950/20">
        <div className="pointer-events-none absolute inset-0" />

        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">
          Mission briefing
        </div>

        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-white">
          Preparar dataset táctico
        </h2>

        <p className="mt-3 text-sm leading-7 text-white/60">
          Reproduce un pipeline de inferencia con el dataset sintético incluido y prepara la experiencia que alimenta el espacio 3D de Log Hound.
        </p>

        <div className="mt-5 grid gap-3 rounded-md border border-white/10 bg-black/24 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <RadioTower size={16} className="text-cyan-200" />
              Bundled demo engine
            </div>

            <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
              Standby
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-white/58">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="text-white/38">Trigger</div>
              <div className="mt-1 font-mono text-cyan-100">Local simulation</div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
              <div className="text-white/38">Output</div>
              <div className="mt-1 font-mono text-emerald-100">/data/demo-predictions.json</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-orange-300/45 bg-orange-300/16 px-4 text-sm font-bold uppercase tracking-[0.14em] text-orange-100 shadow-[0_0_28px_rgba(251,146,60,.14)] transition hover:border-orange-200/70 hover:bg-orange-300/24"
        >
          <Play size={16} />
          Ejecutar demo
        </button>

        <p className="mt-3 text-xs leading-5 text-white/38">
          Esta animación es demostrativa: usa datos estáticos y no realiza solicitudes, escrituras ni cambios en servicios externos.
        </p>
      </section>

      <section className="grid gap-3">
        {PIPELINE_STEPS.map((step, index) => (
          <PipelineStepNode key={step.id} step={step} index={index} />
        ))}
      </section>
    </div>
  );
}

function ConsoleLine({
  children,
  tone = "normal",
}: {
  children: React.ReactNode;
  tone?: "normal" | "ok" | "warn" | "error";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-100"
      : tone === "warn"
        ? "text-orange-100"
        : tone === "error"
          ? "text-red-200"
          : "text-cyan-100/72";

  return (
    <div className={`flex gap-2 py-1.5 ${color}`}>
      <span className="text-white/28">&gt;</span>
      <span>{children}</span>
    </div>
  );
}

function TacticalConsole({
  consoleLines,
  activeMessage,
}: {
  consoleLines: string[];
  activeMessage: string;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-cyan-200/20 bg-black/48 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-orange-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/58">
          <LoaderCircle size={13} className="animate-spin" />
          Labeling Console
        </div>
      </div>

      <div className="relative min-h-[420px] p-4 font-mono text-xs">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.06)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.04)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40" />

        <div className="relative">
          <ConsoleLine tone="ok">LOG HOUND DATA LINK ONLINE</ConsoleLine>
          <ConsoleLine>session: self-contained-demo</ConsoleLine>
          <ConsoleLine>mode: simulated inference / static export</ConsoleLine>

          <div className="my-3 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />

          {consoleLines.map((line, index) => (
            <ConsoleLine key={`${line}-${index}`}>{line}</ConsoleLine>
          ))}

          <ConsoleLine tone="warn">
            {activeMessage}
            <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-orange-100/80" />
          </ConsoleLine>
        </div>
      </div>
    </section>
  );
}

function SuccessPanel({ result, onReset }: { result: ApiResult | null; onReset: () => void }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1fr]">
      <div className="overflow-hidden rounded-md border border-emerald-300/30 bg-emerald-300/10 p-5 shadow-2xl shadow-emerald-950/20">
        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-emerald-300/35 bg-emerald-300/12 text-emerald-100 shadow-[0_0_38px_rgba(52,211,153,.18)]">
          <CheckCircle2 size={28} />
        </div>

        <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-200/70">
          Dataset online
        </div>

        <h2 className="mt-2 text-3xl font-semibold text-white">
          Data lista para el espacio
        </h2>

        <p className="mt-3 text-sm leading-7 text-white/60">
          El escenario simulado terminó correctamente. El dataset ya estaba incluido en el despliegue y no se modificó ningún sistema externo.
        </p>

        <div className="mt-5 grid gap-2 rounded-md border border-white/10 bg-black/24 p-4 font-mono text-xs text-white/64">
          <div className="flex justify-between gap-3">
            <span>records</span>
            <span className="text-emerald-100">{result?.records ?? "N/A"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>output</span>
            <span className="text-cyan-100">{result?.output ?? "/data/demo-predictions.json"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>status</span>
            <span className="text-emerald-100">online</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/home/space"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
          >
            Abrir space
            <ChevronRight size={16} />
          </Link>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Generar otra vez
          </button>
        </div>
      </div>

      <div className="relative min-h-[360px] overflow-hidden rounded-md border border-cyan-200/18 bg-zinc-950 shadow-2xl shadow-cyan-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(52,211,153,.18),transparent_32%),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.045)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
        <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/30 bg-emerald-300/5 shadow-[0_0_90px_rgba(52,211,153,.2)]" />
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/25 border-dashed" />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200 shadow-[0_0_24px_rgba(52,211,153,.95)]" />

        <div className="absolute inset-x-5 bottom-5 rounded-md border border-white/10 bg-black/40 p-4 text-white backdrop-blur-md">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/70">
            Tactical map ready
          </div>
          <div className="mt-1 text-lg font-semibold">
            {result?.records ?? "N/A"} signatures indexed
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-red-300/25 bg-red-300/10 p-5 shadow-2xl shadow-red-950/20">
      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-red-300/30 bg-red-300/10 text-red-100">
        <Zap size={28} />
      </div>

      <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-red-200/70">
        Pipeline link failed
      </div>

      <h2 className="mt-2 text-3xl font-semibold text-white">
        No se pudo obtener la data
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
        {message}
      </p>

      <div className="mt-5 rounded-md border border-white/10 bg-black/30 p-4 font-mono text-xs text-white/58">
        <ConsoleLine tone="error">request failed</ConsoleLine>
        <ConsoleLine>check: bundled JSON available</ConsoleLine>
        <ConsoleLine>check: browser supports local simulation</ConsoleLine>
        <ConsoleLine>check: reload the static showcase</ConsoleLine>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border border-orange-300/45 bg-orange-300/16 px-4 text-sm font-bold uppercase tracking-[0.14em] text-orange-100 transition hover:bg-orange-300/24"
      >
        <Play size={16} />
        Reintentar
      </button>
    </section>
  );
}

export default function GenerateDataDrawer() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DrawerStatus>("briefing");
  const [consoleLines, setConsoleLines] = useState<string[]>([]);
  const [activeConsoleIndex, setActiveConsoleIndex] = useState(0);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const intervalRef = useRef<number | null>(null);

  const activeMessage = useMemo(
    () => CONSOLE_MESSAGES[activeConsoleIndex % CONSOLE_MESSAGES.length],
    [activeConsoleIndex],
  );

  function clearConsoleTimer() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function openDrawer() {
    setOpen(true);
    setStatus("briefing");
    setConsoleLines([]);
    setActiveConsoleIndex(0);
    setResult(null);
    setErrorMessage("");
  }

  function closeDrawer() {
    if (status === "running") return;
    setOpen(false);
  }

  function resetToBriefing() {
    clearConsoleTimer();
    setStatus("briefing");
    setConsoleLines([]);
    setActiveConsoleIndex(0);
    setResult(null);
    setErrorMessage("");
  }

  async function startGeneration() {
    setStatus("running");
    setConsoleLines([]);
    setActiveConsoleIndex(0);
    setResult(null);
    setErrorMessage("");

    clearConsoleTimer();

    let messageIndex = 0;

    setConsoleLines([CONSOLE_MESSAGES[0]]);
    setActiveConsoleIndex(1);

    intervalRef.current = window.setInterval(() => {
      messageIndex += 1;

      setConsoleLines((lines) => {
        const nextMessage = CONSOLE_MESSAGES[messageIndex % CONSOLE_MESSAGES.length];

        if (lines.includes(nextMessage) && messageIndex >= CONSOLE_MESSAGES.length) {
          return [...lines, "awaiting pipeline response"];
        }

        return [...lines, nextMessage];
      });

      setActiveConsoleIndex(messageIndex + 1);
    }, 520);

    await new Promise((resolve) => window.setTimeout(resolve, 3900));
    const payload: ApiResult = {
      status: "ok",
      records: 216,
      output: "/data/demo-predictions.json",
      message: "Escenario sintético cargado.",
    };

    clearConsoleTimer();
    setConsoleLines((lines) => [
      ...lines,
      "static payload validated",
      `records indexed: ${payload.records}`,
      `dataset loaded: ${payload.output}`,
      "demo online — no external requests",
    ]);

    window.setTimeout(() => {
      setResult(payload);
      setStatus("success");
    }, 650);
  }

  useEffect(() => {
    return () => {
      clearConsoleTimer();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="inline-flex h-11 items-center gap-2 rounded-md border border-cyan-200/28 bg-black/32 px-4 text-sm font-semibold text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.13)] backdrop-blur-md transition hover:border-cyan-200/50 hover:bg-cyan-200/12"
      >
        <Sparkles size={16} className="text-orange-200" />
        Generar data
      </button>

      {open ? (
        <section className="fixed inset-0 z-[120] overflow-hidden text-white">
          <button
            type="button"
            aria-label="Cerrar overlay"
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-cyan-200/20 bg-zinc-950/96 shadow-2xl shadow-cyan-950/30">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(34,211,238,.16),transparent_28%),radial-gradient(circle_at_20%_80%,rgba(251,146,60,.11),transparent_30%),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.045)_1px,transparent_1px)] bg-[size:auto,auto,32px_32px,32px_32px] opacity-90" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0_22%,rgba(0,0,0,.52)_72%,rgba(0,0,0,.78)_100%)]" />

            <header className="relative z-10 flex items-start justify-between gap-5 border-b border-white/10 p-5 lg:p-6">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200/70">
                  <Orbit size={14} />
                  Tactical Data Link
                </div>

                <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white lg:text-4xl">
                  Generate data
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                  Ejecuta el pipeline ML local, etiqueta firmas de tráfico y prepara el dataset operativo para el mapa espacial.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`hidden rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] sm:block ${
                    status === "running"
                      ? "border-orange-300/40 bg-orange-300/12 text-orange-100"
                      : status === "success"
                        ? "border-emerald-300/40 bg-emerald-300/12 text-emerald-100"
                        : status === "error"
                          ? "border-red-300/40 bg-red-300/12 text-red-100"
                          : "border-cyan-300/35 bg-cyan-300/10 text-cyan-100"
                  }`}
                >
                  {status === "briefing"
                    ? "Standby"
                    : status === "running"
                      ? "Labeling"
                      : status === "success"
                        ? "Online"
                        : "Failed"}
                </div>

                <button
                  type="button"
                  onClick={closeDrawer}
                  disabled={status === "running"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="relative z-10 flex-1 overflow-y-auto p-5 lg:p-6">
              {status === "briefing" ? (
                <TacticalBriefing onStart={startGeneration} />
              ) : null}

              {status === "running" ? (
                <TacticalConsole consoleLines={consoleLines} activeMessage={activeMessage} />
              ) : null}

              {status === "success" ? (
                <SuccessPanel result={result} onReset={resetToBriefing} />
              ) : null}

              {status === "error" ? (
                <ErrorPanel message={errorMessage} onRetry={startGeneration} />
              ) : null}
            </div>
          </aside>
        </section>
      ) : null}
    </>
  );
}
