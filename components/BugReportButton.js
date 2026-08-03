"use client";

import { usePathname } from "next/navigation";

const BUG_FORM_URL = "https://app.notion.com/p/3adb0bbef15380229562f7e0ef421961?v=3b1b0bbef15381a5a8aa000c3fb2f642";
const RETENTION_PATHS = ["/club", "/hub/creator-economics"];

export default function BugReportButton() {
  const pathname = usePathname() || "";
  const show = RETENTION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!show) return null;

  return (
    <a
      href={BUG_FORM_URL}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#25F4EE] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#071016] shadow-2xl shadow-black/35 transition hover:scale-[1.02] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#25F4EE] focus:ring-offset-2 focus:ring-offset-[#0A0B12]"
      aria-label="Abrir formulário de report de bugs"
    >
      <span aria-hidden="true">!</span>
      Report de bugs
    </a>
  );
}
