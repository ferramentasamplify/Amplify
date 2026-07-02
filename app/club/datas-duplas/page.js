import Link from "next/link";

export const metadata = {
  title: "Datas Duplas — Amplify Club",
};

const LIGA_77_URL = "https://liga77-retencao.netlify.app";

export default function DatasDuplasPage() {
  return (
    <div className="min-h-screen bg-[#0A0B12] text-white font-sans">
      <nav className="border-b border-white/10 sticky top-0 z-20 bg-[#0A0B12]/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 flex items-center gap-2 h-14">
          <Link href="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            ← Hub
          </Link>
          <Link href="/club" className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            Club
          </Link>
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white">
            Datas Duplas
          </span>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-4 py-8 space-y-6">
        <section>
          <p className="text-xs font-mono uppercase tracking-widest text-[#25F4EE] mb-1">Retenção · Club</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Datas Duplas</h1>
          <p className="text-white/40 text-sm mt-2 max-w-2xl">
            Acessos rápidos para campanhas com acompanhamento especial de creators.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <a
            href={LIGA_77_URL}
            target="_blank"
            rel="noreferrer"
            className="group bg-[#14161F] border border-white/10 rounded-2xl p-5 hover:border-[#25F4EE]/60 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">Campanha</p>
                <h2 className="text-2xl font-extrabold tracking-tight">Liga 7.7</h2>
              </div>
              <span className="text-white/30 group-hover:text-[#25F4EE] transition-colors">↗</span>
            </div>
            <p className="text-sm text-white/40 mt-4">
              Metas por creator, progresso diário, gestão macro, fases e investimento em GMV Max.
            </p>
            <div className="mt-5 inline-flex px-3 py-1.5 rounded-lg bg-[#25F4EE]/10 text-[#25F4EE] text-xs font-bold">
              Abrir dashboard
            </div>
          </a>
        </section>
      </main>
    </div>
  );
}
