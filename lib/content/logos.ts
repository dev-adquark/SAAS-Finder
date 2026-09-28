// Official brand icons, each as declared by the vendor itself (homepage <link rel="icon">,
// apple-touch-icon or web-app manifest) and downloaded from the vendor-controlled URL below on 2026-09-28.
// Used only to identify the product being reviewed. `px` is the native size of the file: the Logo
// component never upscales an icon beyond it and falls back to the monogram instead.
export type BrandLogo = { src: string; px: number; sourcePage: string; fileUrl: string };

export const LOGOS: Record<string, BrandLogo> = {
  "adobe-express": {
    "src": "/logos/adobe-express.png",
    "px": 256,
    "sourcePage": "https://new.express.adobe.com/static/assets/manifest.json",
    "fileUrl": "https://new.express.adobe.com/static/assets/pwaIcons/256x256_v2.3cbdfc570b.png"
  },
  "ahrefs": {
    "src": "/logos/ahrefs.png",
    "px": 512,
    "sourcePage": "https://static.ahrefs.com/site.webmanifest?v=2",
    "fileUrl": "https://static.ahrefs.com/android-chrome-512x512.png"
  },
  "asana": {
    "src": "/logos/asana.ico",
    "px": 100,
    "sourcePage": "https://asana.com/",
    "fileUrl": "https://asana.com/assets/img/brand/asana-logo-favicon.ico"
  },
  "canva": {
    "src": "/logos/canva.ico",
    "px": 32,
    "sourcePage": "https://www.canva.com/",
    "fileUrl": "https://static.canva.com/static/images/favicon.ico"
  },
  "clickup": {
    "src": "/logos/clickup.png",
    "px": 192,
    "sourcePage": "https://clickup.com/",
    "fileUrl": "https://clickup.com/favicons/apple-touch-icon.png"
  },
  "figma": {
    "src": "/logos/figma.png",
    "px": 512,
    "sourcePage": "https://www.figma.com/manifest.json?v=1",
    "fileUrl": "https://static.figma.com/app/icon/2/icon-512-maskable.png"
  },
  "hubspot": {
    "src": "/logos/hubspot.png",
    "px": 288,
    "sourcePage": "https://www.hubspot.com/",
    "fileUrl": "https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png"
  },
  "monday": {
    "src": "/logos/monday.png",
    "px": 256,
    "sourcePage": "https://monday.com/",
    "fileUrl": "https://cdn.prod.website-files.com/656da6fea306219773d04208/65af6bd6e742d497b5f23f69_645898132bbaac20f1963919_256x256.png"
  },
  "pipedrive": {
    "src": "/logos/pipedrive.png",
    "px": 196,
    "sourcePage": "https://www.pipedrive.com/",
    "fileUrl": "https://cdn.dub-1.pipedriveassets.com/www-main-renderer/_next/static/media/favicon-196x196.98c71512.png"
  },
  "salesforce": {
    "src": "/logos/salesforce.ico",
    "px": 32,
    "sourcePage": "https://www.salesforce.com/in/?ir=1",
    "fileUrl": "https://www.salesforce.com/c2/public/app/favicon.ico"
  },
  "semrush": {
    "src": "/logos/semrush.png",
    "px": 512,
    "sourcePage": "https://www.semrush.com/__static__/manifest.c126ad9aade5.json",
    "fileUrl": "https://www.semrush.com/__static__/app-icon-512x512.png"
  },
  "squarespace": {
    "src": "/logos/squarespace.png",
    "px": 1024,
    "sourcePage": "https://www.squarespace.com/",
    "fileUrl": "https://media-www.sqspcdn.com/logos/apple-touch-icon-1024.png"
  },
  "trello": {
    "src": "/logos/trello.ico",
    "px": 256,
    "sourcePage": "https://trello.com/",
    "fileUrl": "https://trello.com/favicon.ico"
  },
  "webflow": {
    "src": "/logos/webflow.png",
    "px": 256,
    "sourcePage": "https://webflow.com/",
    "fileUrl": "https://cdn.prod.website-files.com/686294e263eb7e215bd232f7/686d53d0446d4237b2f38c5f_webclip.png"
  },
  "wix": {
    "src": "/logos/wix.png",
    "px": 192,
    "sourcePage": "https://www.wix.com/",
    "fileUrl": "https://www.wix.com/favicon.ico"
  },
  "zoho-crm": {
    "src": "/logos/zoho-crm.ico",
    "px": 48,
    "sourcePage": "https://www.zoho.com/en-in/crm/",
    "fileUrl": "https://www.zohowebstatic.com/sites/zweb/images/favicon.ico"
  }
};
