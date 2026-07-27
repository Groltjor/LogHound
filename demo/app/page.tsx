import Link from "next/link";
import { Activity, ArrowRight, Crosshair, Orbit, Radio, ShieldCheck, Sparkles } from "lucide-react";
import GenerateDataDrawer from "./generateData/GenerateDataDrawer";
import ResetDemoButton from "./demo/ResetDemoButton";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_64%_42%,rgba(34,211,238,.16),transparent_26%),radial-gradient(circle_at_24%_72%,rgba(251,146,60,.12),transparent_28%),linear-gradient(90deg,rgba(34,211,238,.055)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:auto,auto,34px_34px,34px_34px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0_18%,rgba(0,0,0,.34)_52%,rgba(0,0,0,.78)_100%)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-cyan-200/14 pb-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-normal">
            <Sparkles size={16} className="text-cyan-200" />
            Log Hound
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] tracking-[0.14em] text-emerald-100">
              Demo autónoma
            </span>
          </div>
          <Link
            href="/home/space"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-cyan-200/24 bg-cyan-200/10 px-4 text-sm font-medium text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,.1)] transition hover:border-cyan-200/45 hover:bg-cyan-200/16"
          >
            Abrir space
            <ArrowRight size={16} />
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,1fr)]">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-normal text-cyan-200/75">
              <Radio size={15} />
              Traffic intelligence
            </p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-7xl">
              Log.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/62">
              Entra al mapa 3D de labels, user agents e IPs para inspeccionar patrones de bots y actividad recurrente.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100/70">
              Showcase interactivo con 216 registros sintéticos. No utiliza cuentas, credenciales ni servicios externos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/home/space"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-orange-200/36 bg-orange-300/14 px-5 text-sm font-semibold text-orange-100 shadow-[0_0_26px_rgba(251,146,60,.16)] transition hover:border-orange-200/60 hover:bg-orange-300/20"
              >
                Ir a home/space
                <Crosshair size={16} />
              </Link>
              <GenerateDataDrawer />
              <ResetDemoButton />
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-2 text-xs text-white/56">
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <Activity size={15} className="text-cyan-200" />
                <div className="mt-2 font-semibold text-white">Clusters</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <Orbit size={15} className="text-orange-200" />
                <div className="mt-2 font-semibold text-white">Agents</div>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                <ShieldCheck size={15} className="text-emerald-200" />
                <div className="mt-2 font-semibold text-white">Firewall</div>
              </div>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-md border border-cyan-200/18 bg-black/48 shadow-2xl shadow-cyan-950/25 backdrop-blur-xl">
            <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(34,211,238,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px)] [background-size:34px_34px]" />
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_86px_rgba(34,211,238,.24)]">
              <div className="absolute inset-6 rounded-full border border-white/16 border-dashed" />
              <div className="absolute left-1/2 top-[-3.5rem] h-14 w-px -translate-x-1/2 bg-gradient-to-b from-transparent to-cyan-200/60" />
              <div className="absolute left-[-3.5rem] top-1/2 h-px w-14 -translate-y-1/2 bg-gradient-to-r from-transparent to-cyan-200/60" />
            </div>
            <div className="absolute left-[17%] top-[20%] h-20 w-20 rounded-full border border-rose-300/38 bg-rose-300/10 shadow-[0_0_48px_rgba(251,113,133,.18)]" />
            <div className="absolute bottom-[18%] right-[15%] h-24 w-24 rounded-full border border-amber-300/38 bg-amber-300/10 shadow-[0_0_48px_rgba(251,191,36,.16)]" />
            <div className="absolute right-[18%] top-[18%] h-px w-36 rotate-[-18deg] bg-gradient-to-r from-transparent via-orange-200/55 to-transparent" />
            <div className="absolute bottom-[32%] left-[18%] h-px w-40 rotate-[16deg] bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />
            <div className="absolute inset-x-5 bottom-5 rounded-md border border-white/10 bg-black/35 p-4 text-white backdrop-blur-md">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-white/45">Vista</div>
                  <div className="mt-1 font-semibold">Labels</div>
                </div>
                <div>
                  <div className="text-white/45">Detalle</div>
                  <div className="mt-1 font-semibold">Agents</div>
                </div>
                <div>
                  <div className="text-white/45">Nivel</div>
                  <div className="mt-1 font-semibold">IPs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
