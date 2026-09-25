"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section">
      <div className="container">
        <span className="eyebrow">Something went wrong</span>
        <h1 style={{ marginTop: 12 }}>We couldn&apos;t load this page</h1>
        <p className="lead">This is usually temporary. Try again, or keep browsing.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={reset}>Try again</button>
          <Link className="btn secondary" href="/products">Browse all reviews</Link>
        </div>
      </div>
    </section>
  );
}
