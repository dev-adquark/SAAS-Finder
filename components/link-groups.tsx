import Link from "next/link";
import type { LinkGroup } from "@/lib/linking";

/** Crawlable, server-rendered internal links produced by the linking engine. */
export function LinkGroups({ groups, title = "Keep researching" }: { groups: LinkGroup[]; title?: string }) {
  if (!groups.length) return null;
  return (
    <nav className="panel section-gap link-groups" aria-label={title}>
      <h2>{title}</h2>
      <div className="link-grid">
        {groups.map((g) => (
          <div key={g.title}>
            <h3>{g.title}</h3>
            <ul className="list">
              {g.links.map((l) => (
                <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
