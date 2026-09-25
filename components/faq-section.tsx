import type { Faq } from "@/lib/content/types";
import { JsonLd } from "@/components/json-ld";
import { faqJsonLd } from "@/lib/seo/jsonld";

/** Renders visible FAQs and, only when at least one is visible, the matching FAQPage schema. */
export function FaqSection({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  const visible = faqs.filter((f) => f.question.trim() && f.answer.trim());
  const schema = faqJsonLd(visible);
  if (!visible.length || !schema) return null;
  return (
    <section className="panel section-gap" id="faq">
      <JsonLd data={schema} />
      <h2>{title}</h2>
      {visible.map((f) => (
        <div className="faq" key={f.question}>
          <h3>{f.question}</h3>
          <p className="muted">{f.answer}</p>
        </div>
      ))}
    </section>
  );
}
