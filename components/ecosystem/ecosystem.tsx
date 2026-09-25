import Link from "next/link";
import { CategoryIcon } from "@/components/icons";
import { catStyle } from "@/components/identity";
import { EcosystemEnhancer } from "@/components/ecosystem/enhancer";
import { CATEGORY_HEX, type EcoNode } from "@/components/ecosystem/types";
import type { CSSProperties } from "react";

/**
 * The SaaS ecosystem visual. The server renders a complete, crawlable orbit of real category
 * links (a CSS animation on small screens / reduced motion). On capable desktops the client
 * enhancer lazily loads a Three.js scene that animates these same link elements in 3D.
 */
export function Ecosystem({ nodes, total }: { nodes: Omit<EcoNode, "color">[]; total: number }) {
  const withColor: EcoNode[] = nodes.map((n) => ({ ...n, color: CATEGORY_HEX[n.slug] ?? "#7c6cff" }));
  return (
    <div className="eco" data-eco>
      <div className="eco-rings" aria-hidden="true" />
      <div className="eco-core" aria-hidden="true">
        <span>SaaS<br />Finder<br /><small className="tiny muted">{total} tools</small></span>
      </div>
      <div className="eco-orbit">
        <ul className="eco-nodes" aria-label="Software categories">
          {withColor.map((n, i) => (
            <li key={n.slug} className="eco-node" data-eco-node={i} style={{ ["--a" as string]: `${(360 / withColor.length) * i - 90}deg`, ["--r" as string]: "min(40cqw, 225px)" } as CSSProperties}>
              <Link href={n.href} style={catStyle(n.slug)}>
                <span className="ic"><CategoryIcon slug={n.slug} size={15} /></span>
                {n.name} <span className="cnt">{n.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <EcosystemEnhancer nodes={withColor} />
    </div>
  );
}
