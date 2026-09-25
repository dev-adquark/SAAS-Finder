import type { Metadata } from "next";
import { absolute, SITE_NAME } from "@/lib/site";
import { normalizePath } from "@/lib/seo/routes";

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  noindex?: boolean;
  modifiedTime?: string;
};

export const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`);

export function buildMetadata({ title, description, path, type = "website", noindex = false, modifiedTime }: PageMeta): Metadata {
  const url = absolute(normalizePath(path));
  const desc = clip(description, 160);
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      type,
      locale: "en_US",
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: { card: "summary", title, description: desc },
  };
}
