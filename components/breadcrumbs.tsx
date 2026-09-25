import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";

export type Crumb = { name: string; path: string };

/** Visible breadcrumb trail plus BreadcrumbList schema. The last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(all)} />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        {all.map((c, i) => (
          <span key={c.path}>
            {i > 0 && " / "}
            {i === all.length - 1 ? <span aria-current="page">{c.name}</span> : <Link href={c.path}>{c.name}</Link>}
          </span>
        ))}
      </nav>
    </>
  );
}
