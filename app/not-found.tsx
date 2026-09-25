import Link from "next/link";
import { routes } from "@/lib/seo/routes";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container">
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p className="section-intro">This page doesn&apos;t exist or is no longer published.</p>
        <div className="actions">
          <Link className="btn primary" href={routes.products()}>Browse all reviews</Link>
          <Link className="btn secondary" href={routes.categories()}>Categories</Link>
        </div>
      </div>
    </section>
  );
}
