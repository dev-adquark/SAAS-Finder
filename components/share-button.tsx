"use client";
import { useState } from "react";
import { IconLink } from "@/components/icons";

/** Copies the canonical URL with toast feedback. */
export function ShareButton({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast("Couldn't copy — use the address bar");
    }
    window.setTimeout(() => setToast(null), 2200);
  };
  return (
    <>
      <button type="button" className="btn ghost" onClick={copy}><IconLink size={16} /> {label}</button>
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
