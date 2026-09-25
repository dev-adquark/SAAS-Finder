import type { MetadataRoute } from "next";
import { absolute } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/go/", "/sponsor/"] },
    sitemap: absolute("/sitemap.xml"),
  };
}
