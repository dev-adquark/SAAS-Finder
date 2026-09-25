import Link from "next/link";
import type { ReactNode } from "react";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <div className="flash err" role="alert">{error}</div>;
  if (ok) return <div className="flash ok" role="status">{ok}</div>;
  return null;
}

type FieldProps = { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; full?: boolean; hint?: string; maxLength?: number; placeholder?: string };

export function Field({ label, name, defaultValue, type = "text", required, full, hint, maxLength, placeholder }: FieldProps) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      {label}
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} maxLength={maxLength} placeholder={placeholder} step={type === "number" ? "any" : undefined} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Area({ label, name, defaultValue, required, hint, rows = 4, maxLength }: { label: string; name: string; defaultValue?: string | null; required?: boolean; hint?: string; rows?: number; maxLength?: number }) {
  return (
    <label className="field full">
      {label}
      <textarea name={name} defaultValue={defaultValue ?? ""} required={required} rows={rows} maxLength={maxLength} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Select({ label, name, options, defaultValue, full, allowEmpty }: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string | null; full?: boolean; allowEmpty?: string }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      {label}
      <select name={name} defaultValue={defaultValue ?? ""}>
        {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="field">
      <span><input type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}</span>
    </label>
  );
}

export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

/** Destructive actions require an explicit confirmation checkbox. */
export function DangerForm({ action, children, label = "Delete" }: { action: (fd: FormData) => Promise<void>; children?: ReactNode; label?: string }) {
  return (
    <form action={action} className="inline-form">
      {children}
      <label className="small muted"><input type="checkbox" name="confirm" required /> confirm </label>
      <button className="btn danger" type="submit">{label}</button>
    </form>
  );
}

export function Pill({ tone = "", children }: { tone?: "good" | "warn" | "bad" | ""; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function AdminPage({ title, children, back }: { title: string; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <section className="section">
      <div className="container">
        {back && <p className="small"><Link href={back.href}>← {back.label}</Link></p>}
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

export const lines = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "");
export const kv = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${String(x)}`).join("\n") : "");
export const dateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const statusTone = (s: string) => (s === "PUBLISHED" || s === "VERIFIED" || s === "REVIEWED" ? "good" : s === "ARCHIVED" || s === "REJECTED" ? "bad" : "warn");
