import type { Faq } from "@/lib/content/types";
import { JsonLd } from "@/components/json-ld";
import { faqJsonLd } from "@/lib/seo/jsonld";

/**
 * Visible FAQ accordion (native <details>: keyboard/screen-reader accessible, content present in
 * the HTML) plus FAQPage schema only when at least one FAQ is visible.
 */
export function FaqSection({ faqs, title = "Frequently asked questions", openFirst = true }: { faqs: Faq[]; title?: string; openFirst?: boolean }) {
  const visible = faqs.filter((f) => f.question.trim() && f.answer.trim());
  const schema = faqJsonLd(visible);
  if (!visible.length || !schema) return null;
  return (
    <section className="section-gap reveal" id="faq" aria-labelledby="faq-title">
      <JsonLd data={schema} />
      <h2 id="faq-title">{title}</h2>
      <div className="faq-list">
        {visible.map((f, i) => (
          <details className="acc" key={f.question} open={openFirst && i === 0}>
            <summary>{f.question}</summary>
            <div className="acc-body"><p>{f.answer}</p></div>
          </details>
        ))}
      </div>
    </section>
  );
}
