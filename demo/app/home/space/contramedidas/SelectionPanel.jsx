import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Crosshair,
  Eye,
  Globe2,
  LockKeyhole,
  LoaderCircle,
  Network,
  ShieldAlert,
  X,
} from "lucide-react";
import { deployAgentFirewallRule, removeAgentFirewallRule } from "./actions/firewallRuleActions";
import { formatDistance, formatMs, formatNumber, formatTimeWindow } from "../utils/formatters";

const COUNTERMEASURES = [
  {
    id: "agent-deny",
    title: "Deny agent",
    action: "Denegar user agent",
    description: "Preparar regla de denegacion para el user agent completo del target.",
    impact:
      "Se generaria una regla Log Hound con accion deny y condicion user_agent para cortar este patron de trafico.",
    icon: ShieldAlert,
    tone: "border-orange-300/25 bg-orange-300/10 text-orange-100",
    ruleAction: "deny",
  },
  {
    id: "agent-challenge",
    title: "Challenge agent",
    action: "Desafiar user agent",
    description: "Preparar challenge para este user agent sin bloquearlo directamente.",
    impact:
      "Se desplegara una regla Log Hound con condicion user_agent y accion challenge para interponer verificacion antes de llegar a la app.",
    icon: ShieldAlert,
    tone: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    ruleAction: "challenge",
  },
];

function MetricCell({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/42">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function IntelCard({ icon: Icon, label, metrics, footer, className = "", tone = "cyan" }) {
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
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/48">
          <Icon size={13} />
          {label}
        </div>
        <div className={`mt-2 grid gap-3 ${metrics.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {metrics.map((detail) => (
            <MetricCell key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>
        {footer ? (
          <div className="mt-2 border-t border-white/10 pt-2">
            <MetricCell label={footer.label} value={footer.value} />
          </div>
        ) : null}
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
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 128px, rgba(0,0,0,.24) 190px, rgba(0,0,0,.68) 100%)",
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

      <div className="pointer-events-none absolute inset-0">
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
            tone="orange"
            className="absolute left-0 top-0 w-80"
            metrics={[
              { label: "Agente", value: selectedRecord.agentName },
              { label: "Identidad", value: selectedRecord.clientIp },
              { label: "Ventana 10m", value: formatTimeWindow(selectedRecord.timeWindow) },
            ]}
            footer={{ label: "JA4", value: selectedRecord.ja4Digest }}
          />

          <IntelCard
            icon={Network}
            label="Trafico"
            className="absolute right-0 top-[38%] w-80"
            metrics={[
              { label: "Requests", value: formatNumber(selectedRecord.requests) },
              { label: "Rutas", value: formatNumber(selectedRecord.routes) },
              { label: "Apertura", value: formatDistance(selectedRecord.centroidDistance) },
            ]}
            footer={{ label: "Rango actividad", value: formatMs(selectedRecord.activityWindowMs) }}
          />

          <IntelCard
            icon={Crosshair}
            label="Centroide"
            tone="slate"
            className="absolute bottom-0 left-10 w-80"
            metrics={[
              { label: "Distancia", value: formatDistance(selectedRecord.centroidDistance) },
              { label: "Media", value: formatMs(selectedRecord.meanBetweenMs) },
              { label: "Mediana", value: formatMs(selectedRecord.medianBetweenMs) },
            ]}
            footer={{ label: "Tipo", value: selectedRecord.oneShot ? "One-shot" : "Recurrente" }}
          />
        </div>
      </div>
    </div>
  );
}

function EmptySelection({ loading, error, activeAgent, activeLabel }) {
  const emptyText = activeAgent
    ? "Selecciona una IP desplegada por distancia al centroide para fijar un target."
    : activeLabel
      ? `Label ${activeLabel.label}: ${activeLabel.profile?.pattern}. Selecciona un JA4 digest para ver sus IPs por apertura euclidiana.`
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
  onMitigationRemoved,
  onFirewallRulesChange,
  onClearTarget,
  firewallRulesError = "",
}) {
  const targetId = selectedRecord?.id || null;
  const [mitigationDraft, setMitigationDraft] = useState({
    deploymentState: "idle",
    selectedRuleId: null,
    targetId: null,
  });
  const [confirmRuleOpen, setConfirmRuleOpen] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [targetInspectorOpen, setTargetInspectorOpen] = useState(false);
  const [deploymentError, setDeploymentError] = useState("");
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [removingRuleKey, setRemovingRuleKey] = useState("");
  const [conditionDraft, setConditionDraft] = useState({
    operator: "eq",
    targetId: null,
    value: "",
  });
  const transitionTimerRef = useRef(null);
  const selectedRuleId = mitigationDraft.targetId === targetId ? mitigationDraft.selectedRuleId : null;
  const deploymentState = mitigationDraft.targetId === targetId ? mitigationDraft.deploymentState : "idle";
  const pendingRuleId = pendingSelection?.targetId === targetId ? pendingSelection.ruleId : null;
  const activeConditionDraft = conditionDraft.targetId === targetId ? conditionDraft : null;
  const conditionOperator = activeConditionDraft?.operator || "eq";
  const conditionTarget = activeConditionDraft?.value ?? selectedRecord?.userAgent ?? "";
  const normalizedConditionTarget = conditionTarget.trim();
  const conditionPreview = selectedRecord
    ? `user_agent ${conditionOperator} ${normalizedConditionTarget || "<sin target>"}`
    : "";
  const appliedRules = selectedRecord?.appliedRules || [];
  const selectedRule = useMemo(
    () => COUNTERMEASURES.find((rule) => rule.id === selectedRuleId) || null,
    [selectedRuleId],
  );
  const hasDenyRule = appliedRules.some((rule) => rule.action === "deny");
  const selectedRuleAlreadyApplied = selectedRule
    ? appliedRules.some((rule) => rule.action === selectedRule.ruleAction)
    : false;
  const deploymentBlockedReason = hasDenyRule
    ? "Este user agent ya tiene una regla deny aplicada. Remuevela antes de crear otra accion."
    : selectedRuleAlreadyApplied
      ? `Este user agent ya tiene una regla ${selectedRule.ruleAction} aplicada.`
      : "";
  const canConfirmRule =
    Boolean(normalizedConditionTarget) &&
    deploymentState !== "loading" &&
    deploymentState !== "done" &&
    !deploymentBlockedReason;
  const wizardStep = selectedRule ? 2 : 1;

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  if (!activeAgent) return null;

  if (!selectedRecord) {
    return <EmptySelection loading={loading} error={error} activeAgent={activeAgent} activeLabel={activeLabel} />;
  }

  async function deploySelectedRule() {
    if (!selectedRule) return;
    if (!canConfirmRule) {
      setConfirmRuleOpen(false);
      setDeploymentError(deploymentBlockedReason || "No se puede desplegar esta regla.");
      return;
    }

    setConfirmRuleOpen(false);
    setDeploymentError("");
    setDeploymentResult(null);
    setMitigationDraft({
      deploymentState: "loading",
      selectedRuleId: selectedRule.id,
      targetId,
    });

    try {
      const result = await deployAgentFirewallRule({
        ruleAction: selectedRule.ruleAction,
        conditionOperator,
        conditionValue: normalizedConditionTarget,
        agentName: selectedRecord.agentName,
        clientIp: selectedRecord.clientIp,
        ja4Digest: selectedRecord.ja4Digest,
      });

      setMitigationDraft({
        deploymentState: "done",
        selectedRuleId: selectedRule.id,
        targetId,
      });
      setDeploymentResult(result);
      onMitigationComplete?.();
      onFirewallRulesChange?.();
    } catch (error) {
      setMitigationDraft({
        deploymentState: "idle",
        selectedRuleId: selectedRule.id,
        targetId,
      });
      setDeploymentError(error instanceof Error ? error.message : "No se pudo desplegar la regla.");
    }
  }

  async function removeAppliedRule(rule) {
    const ruleKey = `${rule.action}-${rule.operator}-${rule.conditionValue}`;
    setRemovingRuleKey(ruleKey);
    setDeploymentError("");
    setDeploymentResult(null);

    try {
      await removeAgentFirewallRule({
        ruleAction: rule.action,
        conditionOperator: rule.operator,
        conditionValue: rule.conditionValue,
      });
      await onFirewallRulesChange?.();
      onMitigationRemoved?.();
      setMitigationDraft({
        deploymentState: "idle",
        selectedRuleId: null,
        targetId,
      });
    } catch (error) {
      setDeploymentError(error instanceof Error ? error.message : "No se pudo remover la regla.");
    } finally {
      setRemovingRuleKey("");
    }
  }

  function selectRule(ruleId) {
    if (pendingRuleId) return;
    const nextRule = COUNTERMEASURES.find((rule) => rule.id === ruleId);
    if (!nextRule) return;
    if (hasDenyRule || appliedRules.some((rule) => rule.action === nextRule.ruleAction)) return;

    setConfirmRuleOpen(false);
    setTargetInspectorOpen(false);
    setDeploymentError("");
    setDeploymentResult(null);
    setConditionDraft((current) =>
      current.targetId === targetId
        ? current
        : {
            operator: "eq",
            targetId,
            value: selectedRecord.userAgent,
          },
    );
    setPendingSelection({ ruleId, targetId });
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setMitigationDraft({ deploymentState: "idle", selectedRuleId: ruleId, targetId });
      setPendingSelection(null);
      transitionTimerRef.current = null;
    }, 360);
  }

  function updateConditionDraft(patch) {
    setConditionDraft((current) => {
      const base =
        current.targetId === targetId
          ? current
          : {
              operator: "eq",
              targetId,
              value: selectedRecord.userAgent,
            };

      return {
        ...base,
        ...patch,
        targetId,
      };
    });
  }

  return (
    <section className="pointer-events-auto fixed inset-0 z-[92] overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 bg-black/36 backdrop-blur-[1px] lg:hidden" />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-black/72 backdrop-blur-md lg:block" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.08)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px)] bg-[size:32px_32px] opacity-28" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-orange-200/35 to-transparent" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
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
                  Modulo de respuesta
                </div>
                <h3 className="mt-1 text-3xl font-semibold tracking-normal">Tomar medidas</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  Simula cómo este target se convertiría en una regla de firewall, sin modificar infraestructura real.
                </p>
              </div>
              <div className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                Simulación local
              </div>
            </div>

            <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div
                className={`rounded-md border p-3 ${
                  wizardStep === 1
                    ? "border-cyan-200/45 bg-cyan-200/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,.16)]"
                    : "border-emerald-300/35 bg-emerald-300/10 text-emerald-50"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">Step 01</div>
                <div className="mt-1 text-sm font-semibold">Elegir contramedida</div>
              </div>
              <div className="h-px w-10 bg-gradient-to-r from-cyan-200/30 via-orange-200/80 to-cyan-200/30" />
              <div
                className={`rounded-md border p-3 ${
                  wizardStep === 2
                    ? "border-orange-200/45 bg-orange-300/12 text-orange-50 shadow-[0_0_28px_rgba(251,146,60,.18)]"
                    : "border-white/10 bg-white/[0.04] text-white/45"
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">Step 02</div>
                <div className="mt-1 text-sm font-semibold">Regla operativa</div>
              </div>
            </div>

            {!selectedRule && appliedRules.length > 0 ? (
              <div className="mb-4 rounded-md border border-emerald-300/24 bg-emerald-300/10 p-3 shadow-[0_0_24px_rgba(52,211,153,.1)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/64">
                      Aplicada
                    </div>
                    <div className="mt-1 text-sm font-semibold text-emerald-50">Acciones tomadas sobre este agente</div>
                  </div>
                  <div className="rounded-md border border-emerald-200/24 bg-emerald-300/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-100">
                    {appliedRules.length}
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {appliedRules.map((rule) => {
                    const ruleKey = `${rule.action}-${rule.operator}-${rule.conditionValue}`;
                    return (
                      <div
                        key={ruleKey}
                        className="grid gap-2 rounded-md border border-white/10 bg-black/24 p-2 text-xs sm:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold uppercase tracking-[0.1em] text-emerald-100">{rule.action}</div>
                          <div className="mt-1 truncate font-mono text-emerald-50/72">
                            user_agent {rule.operator} {rule.conditionValue}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(removingRuleKey)}
                          onClick={() => removeAppliedRule(rule)}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-red-300/28 bg-red-300/10 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-red-100 transition hover:bg-red-300/18 disabled:cursor-wait disabled:opacity-55"
                        >
                          {removingRuleKey === ruleKey ? "Removiendo" : "Remover"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

	            {!selectedRule ? (
              <div className="wizard-step-screen grid gap-3 transition-all duration-300">
                {COUNTERMEASURES.map(({ id, title, action, description, icon: Icon, tone, ruleAction }, index) => {
                  const alreadyApplied = appliedRules.some((rule) => rule.action === ruleAction);
                  const ruleBlocked = hasDenyRule || alreadyApplied;
                  const disabled = Boolean(pendingRuleId) || ruleBlocked;

                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectRule(id)}
                      style={{ animationDelay: `${index * 55}ms` }}
                      className={`wizard-action-card rounded-md border p-4 text-left transition hover:scale-[1.01] disabled:cursor-default ${
                        pendingRuleId === id
                          ? "wizard-action-selected border-orange-200/55 bg-orange-300/14 text-orange-50 shadow-[0_0_28px_rgba(251,146,60,.18)]"
                          : `${tone} ${disabled ? "opacity-[0.48] saturate-50" : ""}`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md border border-white/10 bg-black/20 p-2">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold">{title}</h4>
                            <span
                              className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                                ruleBlocked
                                  ? "border-emerald-300/24 bg-emerald-300/12 text-emerald-100"
                                  : "border-white/10 bg-black/20"
                              }`}
                            >
                              {ruleBlocked ? (alreadyApplied ? "Aplicada" : "Bloqueado") : ruleAction}
                            </span>
                          </div>
                          <div className="mt-1 text-sm font-medium text-white">{action}</div>
                          <p className="mt-1 text-sm leading-6 text-white/62">
                            {hasDenyRule
                              ? "Este user agent ya tiene deny aplicado; remueve la accion para desplegar otra."
                              : alreadyApplied
                                ? "Esta accion ya fue aplicada para este user agent."
                                : description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="wizard-rule-panel overflow-visible rounded-md border border-orange-200/30 bg-zinc-950/72 p-4 shadow-2xl shadow-orange-950/25 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.08)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-200/80 to-transparent" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="wizard-rule-core rounded-md border border-orange-200/25 bg-black/24 p-2 text-orange-100">
                        <Eye size={17} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-200/65">
                          Compilador de regla
                        </div>
                        <div className="mt-1 text-lg font-semibold text-orange-50">{selectedRule.title}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRuleOpen(false);
                        setPendingSelection(null);
                        setTargetInspectorOpen(false);
                        setDeploymentError("");
                        setDeploymentResult(null);
                        setMitigationDraft({ deploymentState: "idle", selectedRuleId: null, targetId });
                      }}
                      className="inline-flex h-8 items-center rounded-md border border-white/12 bg-white/[0.06] px-2.5 text-xs font-medium text-white/64 transition hover:bg-white/10 hover:text-white"
                    >
                      Cambiar
                    </button>
                  </div>

	                  <div className="mt-4 rounded-md border border-white/10 bg-black/24 p-4">
	                    <div className="text-sm font-semibold text-orange-100">
	                      Vas a desplegar esta regla para el agente seleccionado.
	                    </div>
	                    <p className="mt-2 text-sm leading-6 text-white/62">
	                      Target: <span className="font-semibold text-white">{selectedRecord.agentName}</span>.{" "}
	                      {selectedRule.impact}
	                    </p>
	                  </div>

                  {appliedRules.length > 0 ? (
                    <div className="mt-3 rounded-md border border-emerald-300/24 bg-emerald-300/10 p-3 shadow-[0_0_24px_rgba(52,211,153,.1)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100/64">
                            Aplicada
                          </div>
                          <div className="mt-1 text-sm font-semibold text-emerald-50">Acciones tomadas sobre este agente</div>
                        </div>
                        <div className="rounded-md border border-emerald-200/24 bg-emerald-300/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-100">
                          {appliedRules.length}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {appliedRules.map((rule) => {
                          const ruleKey = `${rule.action}-${rule.operator}-${rule.conditionValue}`;
                          return (
                            <div
                              key={ruleKey}
                              className="grid gap-2 rounded-md border border-white/10 bg-black/24 p-2 text-xs sm:grid-cols-[1fr_auto]"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold uppercase tracking-[0.1em] text-emerald-100">{rule.action}</div>
                                <div className="mt-1 truncate font-mono text-emerald-50/72">
                                  user_agent {rule.operator} {rule.conditionValue}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={Boolean(removingRuleKey)}
                                onClick={() => removeAppliedRule(rule)}
                                className="inline-flex h-8 items-center justify-center rounded-md border border-red-300/28 bg-red-300/10 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-red-100 transition hover:bg-red-300/18 disabled:cursor-wait disabled:opacity-55"
                              >
                                {removingRuleKey === ruleKey ? "Removiendo" : "Remover"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {firewallRulesError ? (
                    <div className="mt-3 rounded-md border border-yellow-300/24 bg-yellow-300/10 p-3 text-sm leading-6 text-yellow-100">
                      No pude leer reglas Log Hound: {firewallRulesError}
                    </div>
                  ) : null}

	                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTargetInspectorOpen((open) => !open)}
                        className={`group w-full rounded-md border p-3 text-left transition ${
                          targetInspectorOpen
                            ? "border-cyan-200/45 bg-cyan-200/14 shadow-[0_0_24px_rgba(34,211,238,.16)]"
                            : "border-cyan-200/16 bg-cyan-200/8 hover:border-cyan-200/35 hover:bg-cyan-200/12"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-100/58">
                            Target
                          </div>
                          <div className="rounded border border-cyan-200/18 bg-black/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-100/70">
                            editar
                          </div>
                        </div>
                        <div className="mt-2 truncate font-mono text-xs text-white">
                          {normalizedConditionTarget || "Configurar target"}
                        </div>
                      </button>

                      {targetInspectorOpen ? (
                        <div className="tactical-panel absolute right-full top-0 z-30 mr-3 w-80 overflow-hidden rounded-md border border-cyan-200/30 bg-zinc-950/92 p-3 text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-xl">
                          <div className="relative">
                            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-2">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/64">
                                  Target identity
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">User agent editable</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setTargetInspectorOpen(false)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-white/58 transition hover:bg-white/10 hover:text-white"
                                aria-label="Cerrar target"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            <label className="mt-3 block">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/44">
                                Valor inyectado
                              </div>
                              <textarea
                                value={conditionTarget}
                                onChange={(event) => updateConditionDraft({ value: event.target.value })}
                                rows={5}
                                className="h-28 w-full resize-none rounded-md border border-cyan-200/18 bg-black/32 p-2 font-mono text-[11px] leading-5 text-cyan-50/88 outline-none transition placeholder:text-white/28 focus:border-cyan-200/48 focus:bg-black/42"
                                placeholder="Pega o edita el user agent que se usara en la condicion"
                              />
                            </label>

                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => updateConditionDraft({ value: selectedRecord.userAgent })}
                                className="rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/58 transition hover:bg-white/10 hover:text-white"
                              >
                                Restaurar original
                              </button>
                            </div>

                            <div className="mt-3">
                              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/44">
                                Operador de condicion
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {["eq", "contains"].map((operator) => (
                                  <button
                                    key={operator}
                                    type="button"
                                    onClick={() => updateConditionDraft({ operator })}
                                    className={`h-9 rounded-md border px-3 font-mono text-xs font-semibold transition ${
                                      conditionOperator === operator
                                        ? "border-orange-200/55 bg-orange-300/16 text-orange-50 shadow-[0_0_18px_rgba(251,146,60,.16)]"
                                        : "border-white/10 bg-white/[0.05] text-white/56 hover:bg-white/[0.08] hover:text-white"
                                    }`}
                                  >
                                    {operator}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 rounded-md border border-orange-200/18 bg-orange-300/10 p-2 font-mono text-[11px] leading-5 text-orange-50/80">
                              user_agent {conditionOperator} {normalizedConditionTarget || "<sin target>"}
                            </div>

                            <button
                              type="button"
                              onClick={() => setTargetInspectorOpen(false)}
                              className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:border-cyan-200/55 hover:bg-cyan-200/16"
                            >
                              Listo
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-orange-200/18 bg-orange-300/10 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-100/62">Decision</div>
                      <div className="mt-2 font-mono text-xs text-orange-50">{selectedRule.ruleAction}</div>
                    </div>
                    <div className="rounded-md border border-emerald-200/16 bg-emerald-300/8 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100/62">Ruleset</div>
                      <div className="mt-2 font-mono text-xs text-emerald-50">default</div>
                    </div>
                  </div>

                  <div className="rule-preview-panel relative mt-6 grid gap-2 rounded-md border border-cyan-200/28 bg-cyan-200/10 p-4 pt-6 font-mono text-xs leading-5 text-cyan-50/78 shadow-[0_0_28px_rgba(34,211,238,.11),inset_0_0_18px_rgba(34,211,238,.045)]">
                    <div className="absolute -top-3.5 left-4 rounded-md border border-cyan-200/32 bg-zinc-950 px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,.14)]">
                      Regla a implementar
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.045)_1px,transparent_1px)] bg-[size:18px_18px] opacity-45" />
                    <div className="flex items-center justify-between gap-3">
                      <span>operation</span>
                      <span className="text-orange-100">rules.insert/update</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>condition</span>
                      <span className="max-w-[18rem] truncate text-white">{conditionPreview}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>mitigate.action</span>
                      <span className="text-orange-100">{selectedRule.ruleAction}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>metadata</span>
                      <span className="text-emerald-100">managed-by=log-hound</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canConfirmRule}
                    onClick={() => setConfirmRuleOpen(true)}
                    className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
                      deploymentState === "done"
                        ? "border-emerald-300/45 bg-emerald-300/16 text-emerald-100"
                        : normalizedConditionTarget && !deploymentBlockedReason
                          ? "border-orange-300/45 bg-orange-300/16 text-orange-100 hover:bg-orange-300/22"
                          : "cursor-not-allowed border-white/10 bg-white/[0.05] text-white/36"
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
                        Regla aplicada
                      </>
                    ) : (
                      <>
                        <ShieldAlert size={16} />
                        Confirmar despliegue
                      </>
                    )}
                  </button>

                  {deploymentResult ? (
                    <div className="mt-3 rounded-md border border-emerald-300/24 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      {deploymentResult.mode === "exists"
                        ? "La condicion ya existia en"
                        : `Condicion ${deploymentResult.mode === "updated" ? "agregada a" : "creada en"}`}{" "}
                      {deploymentResult.ruleName}.
                    </div>
                  ) : null}

	                  {deploymentError ? (
	                    <div className="mt-3 rounded-md border border-red-300/24 bg-red-300/10 p-3 text-sm leading-6 text-red-100">
	                      {deploymentError}
	                    </div>
	                  ) : null}

                  {deploymentBlockedReason ? (
                    <div className="mt-3 rounded-md border border-emerald-300/24 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-100">
                      {deploymentBlockedReason}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmRuleOpen && selectedRule ? (
        <div className="fixed inset-0 z-[104] flex items-center justify-center bg-black/64 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl overflow-hidden rounded-md border border-orange-200/30 bg-zinc-950/94 p-5 text-white shadow-2xl shadow-orange-950/30">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(251,146,60,.08)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px)] bg-[size:24px_24px] opacity-35" />
            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-orange-200/20 bg-orange-300/12 p-2 text-orange-100">
                  <ShieldAlert size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-200/70">
                    Confirmacion requerida
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-normal">{selectedRule.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/64">
                    Esta accion desplegara una regla administrada por Log Hound para el user agent seleccionado.
                    Modificara la configuracion del firewall default usando una condicion{" "}
                    <span className="font-semibold text-white">user_agent {conditionOperator}</span> y accion{" "}
                    <span className="font-semibold text-white">{selectedRule.ruleAction}</span>.
                  </p>

                  <div className="mt-4 rounded-md border border-white/10 bg-black/26 p-3 font-mono text-xs leading-5 text-cyan-50/70">
                    <div>name: Log-Hound-Rules | {selectedRule.ruleAction.toUpperCase()}</div>
                    <div>condition: {conditionPreview}</div>
                    <div>mitigate.action: {selectedRule.ruleAction}</div>
                    <div>description: managed-by=log-hound; mode=or-condition-groups</div>
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRuleOpen(false)}
                      className="inline-flex h-10 items-center rounded-md border border-white/12 bg-white/[0.06] px-3 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={deploySelectedRule}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-orange-300/50 bg-orange-300/16 px-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-300/24"
                    >
                      <ShieldAlert size={16} />
                      Si, desplegar regla
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
