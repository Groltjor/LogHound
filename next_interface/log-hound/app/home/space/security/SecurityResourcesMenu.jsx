"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, Layers3, LoaderCircle, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { activateAttackChallengeMode, readLogHoundRuleset } from "./actions/firewallActions";

const LOG_HOUND_RULESET_STORAGE_KEY = "log-hound-ruleset-prepared";

export default function SecurityResourcesMenu() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState("menu");
  const [status, setStatus] = useState("idle");
  const [rulesetStatus, setRulesetStatus] = useState("idle");
  const [rulesetSummary, setRulesetSummary] = useState(null);
  const [rulesetPrepared, setRulesetPrepared] = useState(
    () =>
      typeof window !== "undefined" && window.localStorage.getItem(LOG_HOUND_RULESET_STORAGE_KEY) === "true",
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const rulesetExists = Boolean(rulesetSummary?.exists || rulesetSummary?.rules?.length > 0);
  const rulesetReady = rulesetExists || rulesetPrepared;

  const rulesetEmptyCopy = useMemo(() => {
    if (rulesetReady) {
      return {
        title: "RuleSet Log Hound preparado.",
        body:
          "No se creara otro set. La primera regla real se agregara desde Target Lock usando el user agent seleccionado.",
      };
    }

    return {
      title: "No hay reglas administradas por Log Hound.",
      body:
        "Para crear reglas haz lock-in a un agente desde la vista granular. El RuleSet usa el firewall default y se materializa con la primera regla real.",
    };
  }, [rulesetReady]);

  function deployAttackChallengeMode() {
    setConfirmOpen(false);
    setError("");
    setStatus("deploying");

    startTransition(async () => {
      try {
        await activateAttackChallengeMode();
        setStatus("done");
      } catch (deployError) {
        setStatus("error");
        setError(deployError instanceof Error ? deployError.message : "No se pudo activar la medida.");
      }
    });
  }

  function openRulesetConfig() {
    setMode("ruleset");
    setError("");
    setRulesetStatus("loading");

    startTransition(async () => {
      try {
        const result = await readLogHoundRuleset();
        setRulesetSummary(result);
        if (result.exists || result.rules?.length > 0) {
          window.localStorage.setItem(LOG_HOUND_RULESET_STORAGE_KEY, "true");
        }
        setRulesetStatus("done");
      } catch (readError) {
        setRulesetStatus("error");
        setError(readError instanceof Error ? readError.message : "No se pudo leer el RuleSet de Log Hound.");
      }
    });
  }

  function backToMenu() {
    setMode("menu");
    setError("");
  }

  function prepareRuleset() {
    if (rulesetReady) return;
    window.localStorage.setItem(LOG_HOUND_RULESET_STORAGE_KEY, "true");
    setRulesetPrepared(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed right-4 top-4 z-[126] inline-flex h-11 items-center gap-2 rounded-md border border-cyan-200/22 bg-zinc-950/66 px-3 text-sm font-semibold text-cyan-50 shadow-2xl shadow-cyan-950/25 backdrop-blur-xl transition hover:border-cyan-100/45 hover:bg-white/10"
      >
        <ShieldCheck size={17} className="text-cyan-200" />
        Medidas de seguridad
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[127] cursor-default bg-black/20"
          aria-label="Cerrar medidas de seguridad"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed bottom-0 right-0 top-0 z-[128] w-full max-w-[560px] border-l border-cyan-200/20 bg-zinc-950/88 text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-xl transition-transform duration-300 sm:w-[50vw] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(rgba(251,146,60,.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-45" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-200/14 to-transparent" />

        <div className="relative flex h-full flex-col p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                <ShieldCheck size={15} />
                Recursos globales
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal">Medidas de seguridad</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/58">
                Acciones del proyecto completo. Estas medidas no pertenecen a una IP especifica.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/[0.06] text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar medidas de seguridad"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex flex-1 items-center">
            {mode === "ruleset" ? (
              <section className="w-full overflow-hidden rounded-md border border-cyan-200/24 bg-cyan-200/10 p-4 shadow-2xl shadow-cyan-950/20">
                <button
                  type="button"
                  onClick={backToMenu}
                  className="mb-4 inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.06] px-3 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft size={16} />
                  Volver
                </button>

                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-cyan-200/20 bg-black/20 p-2 text-cyan-100">
                    <Layers3 size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">Log Hound RuleSet</h3>
                      <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                        Default firewall
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/62">
                      Consulta las reglas administradas por Log Hound dentro de la configuracion activa del firewall.
                    </p>

                    {rulesetStatus === "loading" ? (
                      <div className="mt-5 flex items-center gap-2 rounded-md border border-white/10 bg-black/24 p-3 text-sm text-cyan-100">
                        <LoaderCircle size={16} className="animate-spin" />
                        Consultando RuleSet...
                      </div>
                    ) : null}

                    {rulesetStatus === "error" && error ? (
                      <div className="mt-5 rounded-md border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">
                        {error}
                      </div>
                    ) : null}

                    {rulesetStatus === "done" && rulesetSummary ? (
                      <div className="mt-5 grid gap-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-md border border-white/10 bg-black/24 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                              Firewall
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {rulesetSummary.firewallEnabled === false ? "Inactivo" : "Activo"}
                            </div>
                          </div>
                          <div className="rounded-md border border-white/10 bg-black/24 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                              Reglas LH
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">{rulesetSummary.rules.length}</div>
                          </div>
                          <div className="rounded-md border border-white/10 bg-black/24 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                              Total
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">{rulesetSummary.totalRules}</div>
                          </div>
                        </div>

                        {rulesetSummary.rules.length > 0 ? (
                          <div className="max-h-[34vh] overflow-auto rounded-md border border-white/10 bg-black/30">
                            {rulesetSummary.rules.map((rule) => (
                              <article key={rule.id} className="border-b border-white/10 p-3 last:border-b-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-white">{rule.name}</div>
                                    <div className="mt-1 text-xs leading-5 text-white/48">
                                      {rule.description || "Sin descripcion"}
                                    </div>
                                  </div>
                                  <span className="rounded-md border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                                    {rule.action}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/45">
                                  <span>{rule.active === false ? "Inactiva" : "Activa"}</span>
                                  <span>Condition groups: {rule.conditionGroups}</span>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-orange-200/22 bg-orange-300/10 p-4">
                            <div className="text-sm font-semibold text-orange-100">{rulesetEmptyCopy.title}</div>
                            <p className="mt-2 text-sm leading-6 text-white/58">{rulesetEmptyCopy.body}</p>
                            <button
                              type="button"
                              disabled={rulesetReady}
                              onClick={prepareRuleset}
                              className={`mt-4 inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                                rulesetReady
                                  ? "cursor-not-allowed border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                                  : "border-cyan-300/35 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/18"
                              }`}
                            >
                              {rulesetReady ? <CheckCircle2 size={16} /> : <Layers3 size={16} />}
                              {rulesetReady ? "RuleSet preparado" : "Preparar RuleSet Log Hound"}
                            </button>
                            {rulesetReady ? (
                              <div className="mt-3 rounded-md border border-emerald-300/24 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                                Blindado: no se creara otro RuleSet. Reutilizaremos el default con metadata Log Hound.
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <div className="grid w-full gap-3">
                <button
                  type="button"
                  onClick={openRulesetConfig}
                  className="w-full rounded-md border border-cyan-200/24 bg-cyan-200/10 p-4 text-left text-white shadow-2xl shadow-cyan-950/20 transition hover:scale-[1.01] hover:border-cyan-100/45"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-cyan-200/20 bg-black/20 p-2 text-cyan-100">
                      <Layers3 size={19} />
                    </div>
                    <div>
                      <div className="text-lg font-semibold">Consultar RuleSet</div>
                      <p className="mt-2 text-sm leading-6 text-white/62">
                        Revisa si existe el set de reglas Log Hound y lista las reglas activas administradas por la interfaz.
                      </p>
                    </div>
                  </div>
                </button>

                <section className="w-full overflow-hidden rounded-md border border-orange-200/24 bg-orange-300/10 p-4 shadow-2xl shadow-orange-950/20">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border border-orange-200/20 bg-black/20 p-2 text-orange-100">
                      <ShieldAlert size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold">Attack Challenge Mode</h3>
                        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-100">
                          Proyecto
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-white/64">
                        Activa una defensa global de Vercel Firewall. Vercel puede desafiar trafico sospechoso antes de
                        que llegue a la aplicacion. Aplica a todo el proyecto configurado en{" "}
                        <span className="font-semibold text-white">PROJECT_ID</span>.
                      </p>

                      <div className="mt-4 rounded-md border border-white/10 bg-black/22 p-3 text-xs leading-5 text-white/55">
                        Esta accion usa <span className="font-semibold text-white">WAF_DEFENDER</span> en servidor via
                        server action. No se ejecuta hasta confirmar el boton.
                      </div>

                      {error ? (
                        <div className="mt-4 rounded-md border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">
                          {error}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        disabled={pending || status === "done"}
                        onClick={() => setConfirmOpen(true)}
                        className={`mt-5 inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${
                          status === "done"
                            ? "border-emerald-300/45 bg-emerald-300/16 text-emerald-100"
                            : "border-orange-300/45 bg-orange-300/16 text-orange-100 hover:bg-orange-300/22"
                        } disabled:cursor-not-allowed disabled:opacity-75`}
                      >
                        {pending || status === "deploying" ? (
                          <>
                            <LoaderCircle size={16} className="animate-spin" />
                            Activando modo defensa...
                          </>
                        ) : status === "done" ? (
                          <>
                            <CheckCircle2 size={16} />
                            Modo defensa solicitado
                          </>
                        ) : (
                          <>
                            <ShieldAlert size={16} />
                            Activar modo defensa
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </aside>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[132] flex items-center justify-center bg-black/64 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-md border border-orange-200/30 bg-zinc-950/94 p-5 text-white shadow-2xl shadow-orange-950/30">
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
                  <h3 className="mt-2 text-2xl font-semibold tracking-normal">Activar modo defensa</h3>
                  <p className="mt-3 text-sm leading-6 text-white/64">
                    Esta accion activara Attack Challenge Mode a nivel proyecto. De acuerdo con Vercel Firewall, WAF
                    permite estrategias como Custom Rules, IP Blocking, Managed Rulesets y Attack Challenge Mode; esta
                    opcion puede desafiar trafico sospechoso antes de que llegue a la aplicacion.
                  </p>

                  <div className="mt-4 rounded-md border border-white/10 bg-black/26 p-3 text-xs leading-5 text-white/54">
                    No se creara una regla granular por IP. Se solicitara cambiar la postura global del proyecto
                    configurado en <span className="font-semibold text-white">PROJECT_ID</span>.
                  </div>

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="inline-flex h-10 items-center rounded-md border border-white/12 bg-white/[0.06] px-3 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={deployAttackChallengeMode}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-orange-300/50 bg-orange-300/16 px-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-300/24 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pending ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                      Si, activar modo defensa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
