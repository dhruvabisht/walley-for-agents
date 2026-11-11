"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="shrink-0 rounded-xl bg-violet px-3.5 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
