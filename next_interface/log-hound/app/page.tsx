import Link from "next/link";
import GenerateDataDrawer from "./generateData/GenerateDataDrawer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-zinc-950/10 pb-4">
          <div className="text-sm font-semibold uppercase tracking-normal">Log Hound</div>
          <Link
            href="/home/space"
            className="inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Abrir space
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,1fr)]">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-cyan-700">Traffic intelligence</p>
            <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal sm:text-7xl">
              Explora el trafico como un espacio vivo.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-700">
              Entra al mapa 3D de labels, user agents e IPs para inspeccionar patrones de bots y actividad recurrente.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/home/space"
                className="inline-flex h-11 items-center rounded-md bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                Ir a home/space
              </Link>
               <GenerateDataDrawer />
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-md border border-zinc-950/10 bg-zinc-950 shadow-2xl shadow-zinc-950/20">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/45 bg-cyan-300/10 shadow-[0_0_80px_rgba(34,211,238,.28)]" />
            <div className="absolute left-[18%] top-[22%] h-20 w-20 rounded-full border border-rose-300/35 bg-rose-300/10 shadow-[0_0_50px_rgba(251,113,133,.22)]" />
            <div className="absolute bottom-[18%] right-[16%] h-24 w-24 rounded-full border border-emerald-300/35 bg-emerald-300/10 shadow-[0_0_50px_rgba(52,211,153,.2)]" />
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
