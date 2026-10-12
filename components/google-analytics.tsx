import Script from "next/script";

/**
 * GA4 (NEXT_PUBLIC_GA_MEASUREMENT_ID) or GTM (NEXT_PUBLIC_GTM_ID), independent of and in addition to
 * this site's own first-party analytics (lib/analytics.ts, components/page-view.tsx). Renders nothing
 * when neither is set — this is optional, not a dependency of any existing feature.
 *
 * strategy="lazyOnload": gtag.js alone is ~180KB, by far the largest script this site loads — under
 * "afterInteractive" it was fetched early enough to compete with the app's own chunks for bandwidth on
 * a throttled mobile connection, measurably moving LCP. lazyOnload defers it to the browser's idle
 * period after the window load event, so it no longer competes with anything on the critical path;
 * analytics collection isn't time-critical the way rendering is.
 */
export function GoogleAnalytics() {
  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const gtm = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  if (gtm) {
    return (
      <Script id="gtm" strategy="lazyOnload">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
      </Script>
    );
  }
  if (ga) {
    return (
      <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="lazyOnload" />
        <Script id="ga4" strategy="lazyOnload">
          {`window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', '${ga}');`}
        </Script>
      </>
    );
  }
  return null;
}
