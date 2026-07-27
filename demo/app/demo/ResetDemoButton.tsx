"use client";

import { RotateCcw } from "lucide-react";

const DEMO_KEYS = [
  "log-hound-demo-firewall-rules",
  "log-hound-demo-attack-mode",
  "log-hound-ruleset-prepared",
];

export default function ResetDemoButton() {
  function resetDemo() {
    DEMO_KEYS.forEach((key) => window.localStorage.removeItem(key));
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={resetDemo}
      className="inline-flex h-11 items-center gap-2 rounded-md border border-white/14 bg-white/[0.05] px-4 text-sm font-medium text-white/68 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
    >
      <RotateCcw size={15} />
      Restablecer demo
    </button>
  );
}
