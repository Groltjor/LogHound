import { Activity, ChevronLeft, ChevronRight, Database, Menu, Route, ShieldAlert, Sparkles, X } from "lucide-react";
import { formatNumber } from "../../utils/formatters";

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

function BreadcrumbTrail({ items }) {
  return (
    <nav className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Ruta activa">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${item.value}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? <ChevronRight size={13} className="shrink-0 text-cyan-100/35" /> : null}
            <div
              className={`min-w-0 rounded-md border px-2.5 py-1.5 ${
                isLast
                  ? "border-orange-200/35 bg-orange-300/12 text-orange-50 shadow-[0_0_18px_rgba(251,146,60,.16)]"
                  : "border-cyan-200/15 bg-cyan-200/8 text-cyan-50/74"
              }`}
              title={`${item.label}: ${item.value}`}
            >
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-55">{item.label}</div>
              <div className="max-w-[13rem] truncate text-xs font-semibold sm:max-w-[17rem]">{item.value}</div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export default function SpaceMenu({
  drawerOpen,
  onOpen,
  onClose,
  breadcrumbs,
  modeTitle,
  modeDescription,
  canGoBack,
  onBack,
  metrics,
  metric,
  onMetricChange,
  filteredRecordsCount,
  totalRequests,
  totalRoutes,
  recurrentCount,
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[85] bg-gradient-to-b from-black/62 via-black/20 to-transparent p-4 sm:p-6">
        <div className="pointer-events-auto flex max-w-4xl items-start gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-200/20 bg-zinc-950/60 text-cyan-100 shadow-2xl shadow-black/30 backdrop-blur-xl transition hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 rounded-md border border-cyan-200/15 bg-zinc-950/42 px-4 py-3 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold uppercase tracking-normal text-white">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-200" />
                Log Hound
              </span>
              <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-emerald-200/75">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" />
                Services online
              </span>
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-normal text-white/45">Vista activa</div>
            <BreadcrumbTrail items={breadcrumbs} />
            <h1 className="mt-1 max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">{modeTitle}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{modeDescription}</p>
            {canGoBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                <ChevronLeft size={17} />
                Volver
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-[95] cursor-default bg-transparent"
          onClick={onClose}
          aria-label="Cerrar menu"
        />
      ) : null}

      <aside
        className={`absolute bottom-4 left-4 top-4 z-[100] w-[360px] overflow-hidden rounded-md border border-cyan-200/20 bg-zinc-950/82 text-white shadow-2xl shadow-cyan-950/30 backdrop-blur-xl transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-[calc(100%+32px)]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(rgba(34,211,238,.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-45" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-200/15 to-transparent" />
        <div className="relative flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-normal">
                <Sparkles size={16} className="text-cyan-200" />
                Systems menu
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200/70">
                Services online
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar menu"
            >
              <X size={17} />
            </button>
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-normal text-white/45">Metrica visual</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {metrics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMetricChange(item.id)}
                  className={`h-10 rounded-md border px-3 text-sm font-medium transition ${
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

          <div className="mt-5 grid grid-cols-2 gap-2">
            <StatPill icon={Database} label="Registros" value={formatNumber(filteredRecordsCount)} />
            <StatPill icon={Activity} label="Requests" value={formatNumber(totalRequests)} />
            <StatPill icon={Route} label="Rutas" value={formatNumber(totalRoutes)} />
            <StatPill icon={ShieldAlert} label="Recurrentes" value={formatNumber(recurrentCount)} />
          </div>
        </div>
      </aside>
    </>
  );
}
