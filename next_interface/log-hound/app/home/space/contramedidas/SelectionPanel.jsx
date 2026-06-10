import { useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Eye,
  Gauge,
  Globe2,
  LockKeyhole,
  LoaderCircle,
  Network,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { formatMs, formatNumber } from "../utils/formatters";

const COUNTERMEASURES = [
  {
    id: "ip-block",
    title: "IP blocking",
    action: "Bloquear IP",
    description: "Crear bloqueo puntual para la IP seleccionada.",
    impact: "Vercel Firewall evaluaria esta identidad como bloqueo por IP antes de las reglas custom.",
    icon: Ban,
    tone: "border-red-300/25 bg-red-300/10 text-red-100",
  },
  {
    id: "rate-limit",
    title: "Rate limiting",
    action: "Limitar cadencia",
    description: "Aplicar umbral temporal por IP, JA4 o user agent.",
    impact: "Se prepararia una regla de rate limiting para reducir cadencia sin apagar todo el trafico.",
    icon: Gauge,
    tone: "border-orange-300/25 bg-orange-300/10 text-orange-100",
  },
  {
    id: "challenge",
    title: "Attack challenge",
    action: "Enviar challenge",
    description: "Interponer verificacion antes de dejar continuar el trafico.",
    impact: "Attack Challenge Mode interpondria una verificacion contra solicitudes sospechosas del target.",
    icon: ShieldAlert,
    tone: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  },
  {
    id: "custom-rule",
    title: "WAF custom rule",
    action: "Crear regla",
    description: "Preparar condiciones por IP, headers, user agent o fingerprint.",
    impact: "Se armaria una WAF custom rule combinando identidad, user agent y fingerprint observado.",
    icon: ShieldCheck,
    tone: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  },
];

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function IntelCard({ icon: Icon, label, title, details, className = "", tone = "cyan" }) {
  const toneClass =
    tone === "orange"
      ? "border-orange-200/30 bg-orange-300/10 shadow-orange-950/30"
      : tone === "slate"
        ? "border-white/15 bg-zinc-950/52 shadow-black/30"
        : "border-cyan-200/25 bg-cyan-200/10 shadow-cyan-950/25";

  return (
    <article
      className={`pointer-events-none overflow-hidden rounded-md border p-3 text-white shadow-2xl backdrop-blur-xl ${toneClass} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:18px_18px] opacity-35" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/48">
          <Icon size={13} />
          {label}
        </div>
        <div className="mt-1 truncate text-lg font-semibold tracking-normal text-white">{title}</div>
        <div className="mt-3 grid gap-2">
          {details.map((detail) => (
            <DetailRow key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>
      </div>
    </article>
  );
}

function TargetAnalysisFold({ selectedRecord, mitigationComplete, onClearTarget }) {
  const ringTone = mitigationComplete
    ? "border-emerald-300/75 bg-emerald-300/[0.035] shadow-[0_0_96px_rgba(52,211,153,.22)]"
    : "border-orange-300/75 bg-orange-300/[0.025] shadow-[0_0_96px_rgba(251,146,60,.22)]";
  const centerTone = mitigationComplete
    ? "border-emerald-100 bg-emerald-200 shadow-[0_0_26px_rgba(52,211,153,.95)]"
    : "border-orange-100 bg-orange-200 shadow-[0_0_26px_rgba(251,146,60,.95)]";

  return (
    <div className="relative min-h-screen overflow-hidden p-5 pt-28 lg:p-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 54%, rgba(0,0,0,0) 0 128px, rgba(0,0,0,.24) 190px, rgba(0,0,0,.68) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.06)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,146,60,.08),transparent_35%)]" />

      <div className="relative z-10">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200/70">
            Target acquisition
          </div>
          <h2 className="mt-1 text-4xl font-semibold tracking-normal text-white">Target lock</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/58">
            Analisis granular del objeto fijado. El planeta real queda bajo la reticula central.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-5 bottom-8 top-48 lg:inset-x-8 lg:bottom-10 lg:top-44">
        <div className="absolute left-1/2 top-1/2 h-[min(72vw,680px)] w-[min(72vw,680px)] -translate-x-1/2 -translate-y-1/2">
          <div className={`absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border ${ringTone}`}>
            <div className="absolute -inset-8 rounded-full border border-cyan-200/20" />
            <div className="absolute -inset-14 rounded-full border border-orange-200/12 border-dashed" />
            <div className="absolute inset-5 rounded-full border border-cyan-200/25" />
            <div className="absolute inset-12 rounded-full border border-white/18 border-dashed" />
            <div className="absolute left-1/2 top-[-3.5rem] h-14 w-px -translate-x-1/2 bg-gradient-to-b from-transparent to-orange-200/75" />
            <div className="absolute bottom-[-3.5rem] left-1/2 h-14 w-px -translate-x-1/2 bg-gradient-to-b from-orange-200/75 to-transparent" />
            <div className="absolute left-[-3.5rem] top-1/2 h-px w-14 -translate-y-1/2 bg-gradient-to-r from-transparent to-orange-200/75" />
            <div className="absolute right-[-3.5rem] top-1/2 h-px w-14 -translate-y-1/2 bg-gradient-to-r from-orange-200/75 to-transparent" />
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-orange-200/65 to-transparent" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-orange-200/65 to-transparent" />
            <div className={`absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${centerTone}`} />
            <div
              className={`absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] shadow-[0_0_24px_rgba(251,146,60,.24)] backdrop-blur-md ${
                mitigationComplete
                  ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100"
                  : "border-orange-300/45 bg-orange-300/15 text-orange-100"
              }`}
            >
              {mitigationComplete ? "Medidas tomadas" : "Seleccionado"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClearTarget}
            className="pointer-events-auto absolute left-1/2 top-1/2 z-20 inline-flex h-9 -translate-x-1/2 translate-y-[8.8rem] items-center gap-2 rounded-md border border-orange-300/38 bg-zinc-950/72 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100 shadow-2xl shadow-orange-950/30 backdrop-blur-xl transition hover:border-orange-200/70 hover:bg-orange-300/14"
          >
            <X size={14} />
            Liberar target
          </button>

          <div className="absolute left-[12%] top-[20%] h-px w-[30%] bg-gradient-to-r from-cyan-200/0 via-cyan-200/65 to-orange-200/80" />
          <div className="absolute right-[13%] top-[48%] h-px w-[29%] bg-gradient-to-r from-orange-200/80 via-cyan-200/65 to-cyan-200/0" />
          <div className="absolute bottom-[20%] left-[17%] h-px w-[27%] bg-gradient-to-r from-cyan-200/0 via-cyan-200/65 to-orange-200/80" />

          <IntelCard
            icon={Globe2}
            label="Identidad"
            title={selectedRecord.clientIp}
            tone="orange"
            className="absolute left-0 top-0 w-72"
            details={[
              { label: "Agente", value: selectedRecord.agentName },
              { label: "JA4", value: selectedRecord.ja4Digest },
            ]}
          />

          <IntelCard
            icon={Network}
            label="Trafico"
            title={`${formatNumber(selectedRecord.requests)} requests`}
            className="absolute right-0 top-[38%] w-64"
            details={[
              { label: "Ventana", value: formatMs(selectedRecord.activityWindowMs) },
              { label: "Rutas", value: formatNumber(selectedRecord.routes) },
            ]}
          />

          <IntelCard
            icon={Timer}
            label="Cadencia"
            title={formatMs(selectedRecord.meanBetweenMs)}
            tone="slate"
            className="absolute bottom-0 left-10 w-72"
            details={[
              { label: "Mediana", value: formatMs(selectedRecord.medianBetweenMs) },
              { label: "Tipo", value: selectedRecord.oneShot ? "One-shot" : "Recurrente" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function EmptySelection({ loading, error, activeAgent, activeLabel }) {
  const emptyText = activeAgent
    ? "Selecciona una IP orbitando el user agent para fijar un target."
    : activeLabel
      ? `Label ${activeLabel.label}: ${activeLabel.profile?.pattern}. Selecciona una esfera de user agent para desplegar sus IPs.`
      : "Selecciona un patron para entrar al cluster. Usa arrastre para girar y scroll para acercarte.";

  return (
    <aside className="pointer-events-auto relative w-full overflow-hidden rounded-md border border-orange-200/20 bg-zinc-950/72 p-4 text-white shadow-2xl shadow-orange-950/20 backdrop-blur-xl lg:w-[380px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.08)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LockKeyhole size={16} className="text-white/45" />
              Target lock
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/42">
              Sin target fijado
            </div>
          </div>
        </div>
        {loading ? (
          <div className="mt-4 text-sm text-white/60">Cargando dataset...</div>
        ) : error ? (
          <div className="mt-4 text-sm text-red-200">{error}</div>
        ) : (
          <div className="mt-4 text-sm leading-6 text-white/60">{emptyText}</div>
        )}
      </div>
    </aside>
  );
}

export default function SelectionPanel({
  loading,
  error,
  selectedRecord,
  activeAgent,
  activeLabel,
  mitigationComplete = false,
  onMitigationComplete,
  onClearTarget,
}) {
  const targetId = selectedRecord?.id || null;
  const [mitigationDraft, setMitigationDraft] = useState({
    deploymentState: "idle",
    selectedRuleId: null,
    targetId: null,
  });
  const selectedRuleId = mitigationDraft.targetId === targetId ? mitigationDraft.selectedRuleId : null;
  const deploymentState = mitigationDraft.targetId === targetId ? mitigationDraft.deploymentState : "idle";
  const selectedRule = useMemo(
    () => COUNTERMEASURES.find((rule) => rule.id === selectedRuleId) || null,
    [selectedRuleId],
  );

  if (!activeAgent) return null;

  if (!selectedRecord) {
    return <EmptySelection loading={loading} error={error} activeAgent={activeAgent} activeLabel={activeLabel} />;
  }

  return (
    <section className="pointer-events-auto fixed inset-0 z-[92] overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 bg-black/36 backdrop-blur-[1px] lg:hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-black/72 backdrop-blur-md lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.08)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px)] bg-[size:32px_32px] opacity-28" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-orange-200/35 to-transparent" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.78fr)]">
        <TargetAnalysisFold
          selectedRecord={selectedRecord}
          mitigationComplete={mitigationComplete || deploymentState === "done"}
          onClearTarget={onClearTarget}
        />

        <div className="relative flex min-h-screen items-center border-l border-cyan-200/15 bg-zinc-950/88 p-5 py-20 shadow-2xl shadow-cyan-950/30 lg:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-40" />
          <div className="relative w-full">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
                  Countermeasure drawer
                </div>
                <h3 className="mt-1 text-3xl font-semibold tracking-normal">Tomar medidas</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Opciones preparadas para convertir este target en reglas de Vercel Firewall.
                </p>
              </div>
              <div className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                Simulacion
              </div>
            </div>

            <div className="grid gap-3">
              {COUNTERMEASURES.map(({ id, title, action, description, icon: Icon, tone }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMitigationDraft({ deploymentState: "idle", selectedRuleId: id, targetId });
                  }}
                  className={`rounded-md border p-4 text-left transition hover:scale-[1.01] ${
                    selectedRuleId === id
                      ? "border-orange-200/55 bg-orange-300/14 text-orange-50 shadow-[0_0_28px_rgba(251,146,60,.18)]"
                      : tone
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-md border border-white/10 bg-black/20 p-2">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold">{title}</h4>
                        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
                          Draft
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-white">{action}</div>
                      <p className="mt-1 text-sm leading-6 text-white/62">{description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedRule ? (
              <div className="mt-5 overflow-hidden rounded-md border border-orange-200/25 bg-orange-200/10 p-4 shadow-2xl shadow-orange-950/20">
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-orange-200/20 bg-black/20 p-2 text-orange-100">
                    <Eye size={17} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-orange-100">
                      Vas a desplegar {selectedRule.title} en esta identidad
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/62">
                      Target: <span className="font-semibold text-white">{selectedRecord.clientIp}</span>.{" "}
                      {selectedRule.impact} Esto puede bloquear solicitudes, desafiar trafico sospechoso o reducir
                      cadencia antes de que llegue a la aplicacion. Esta accion es dummy y no modifica Vercel.
                    </p>
                    <button
                      type="button"
                      disabled={deploymentState === "loading" || deploymentState === "done"}
                      onClick={() => {
                        setMitigationDraft({
                          deploymentState: "loading",
                          selectedRuleId: selectedRule.id,
                          targetId,
                        });
                        window.setTimeout(() => {
                          setMitigationDraft({
                            deploymentState: "done",
                            selectedRuleId: selectedRule.id,
                            targetId,
                          });
                          onMitigationComplete?.();
                        }, 850);
                      }}
                      className={`mt-4 inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                        deploymentState === "done"
                          ? "border-emerald-300/45 bg-emerald-300/16 text-emerald-100"
                          : "border-orange-300/45 bg-orange-300/16 text-orange-100 hover:bg-orange-300/22"
                      }`}
                    >
                      {deploymentState === "loading" ? (
                        <>
                          <LoaderCircle size={16} className="animate-spin" />
                          Desplegando...
                        </>
                      ) : deploymentState === "done" ? (
                        <>
                          <CheckCircle2 size={16} />
                          Medida hecha
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={16} />
                          Si, desplegar contramedida
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
