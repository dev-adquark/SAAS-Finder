import type { SeedPair } from "@/lib/content/seed/types";

export const seedPairs: SeedPair[] = [
  {
    a: "wix",
    b: "squarespace",
    summary:
      "Wix and Squarespace are both all-in-one hosted builders, but they take opposite approaches to design. Wix offers free-form editing and a large app market of business add-ons, while Squarespace uses a structured, section-based editor that keeps sites polished and consistent.",
    chooseA:
      "Choose Wix if you want maximum layout freedom and a broad range of business features, such as bookings, events and add-on apps, in one place.",
    chooseB:
      "Choose Squarespace if you value a cohesive, design-led result with minimal effort and are happy to work within its layout guardrails.",
    highlights: [
      "Wix allows free placement of elements, while Squarespace arranges content in pre-designed sections.",
      "Wix has a larger app market for extending functionality; Squarespace keeps a more curated set of integrated features.",
      "Wix offers a free option on a branded address, whereas Squarespace relies on a trial before a paid plan.",
    ],
  },
  {
    a: "wix",
    b: "webflow",
    summary:
      "Wix and Webflow both host your site and offer visual editing, but they target different users. Wix is designed for beginners and small business owners, while Webflow is a visual development tool for designers who want precise control and a structured CMS.",
    chooseA:
      "Choose Wix if you are maintaining the site yourself without design experience and want built-in business tools and a gentle learning curve.",
    chooseB:
      "Choose Webflow if you or your designer want code-level layout control, a flexible CMS and a site that can scale into a sophisticated marketing presence.",
    highlights: [
      "Webflow exposes real web layout concepts, while Wix hides them behind a drag-and-drop editor.",
      "Webflow offers code export on eligible plans, whereas Wix sites cannot be exported as working code.",
      "Wix bundles more small-business functions such as bookings, while Webflow focuses on design and content structure.",
    ],
  },
  {
    a: "squarespace",
    b: "webflow",
    summary:
      "Squarespace and Webflow both appeal to design-conscious users, but they differ in how much control they give. Squarespace provides polished templates with guardrails, while Webflow gives designers granular control over layout, interactions and CMS structure.",
    chooseA:
      "Choose Squarespace if you want a beautiful site quickly without learning web design concepts, with commerce and scheduling available natively.",
    chooseB:
      "Choose Webflow if you want to build a custom design from scratch, manage structured content at scale or deliver bespoke sites for clients.",
    highlights: [
      "Squarespace constrains design choices to maintain consistency, while Webflow leaves every layout decision to the designer.",
      "Webflow's CMS supports custom collections and references, which suits content-heavy sites better than Squarespace's simpler content model.",
      "Squarespace is quicker to learn, while Webflow rewards existing web design knowledge.",
    ],
  },
  {
    a: "canva",
    b: "adobe-express",
    summary:
      "Canva and Adobe Express are both template-led design tools for quick marketing and social content. Canva is a self-contained platform with a very broad template range and team collaboration, while Adobe Express stands out for its connection to Adobe Fonts, Adobe Stock and Creative Cloud libraries.",
    chooseA:
      "Choose Canva if you want the broadest template coverage and a collaboration-first platform for teams of non-designers.",
    chooseB:
      "Choose Adobe Express if your team already works in Creative Cloud and wants quick content creation that reuses Adobe assets and fonts.",
    highlights: [
      "Canva is a standalone ecosystem, while Adobe Express connects directly to other Adobe apps through shared libraries.",
      "Both offer brand kits and generative AI features, but Adobe Express draws on Adobe's Firefly models and stock content.",
      "Canva places more emphasis on team collaboration, while Adobe Express emphasizes quick actions for fast edits.",
    ],
  },
  {
    a: "canva",
    b: "figma",
    summary:
      "Canva and Figma are both collaborative, browser-based design tools, but they serve different jobs. Canva helps non-designers produce marketing content quickly from templates, while Figma is a precision tool for designing interfaces, building design systems and prototyping products.",
    chooseA:
      "Choose Canva if you mainly produce social posts, presentations and marketing materials and want speed and templates over precision.",
    chooseB:
      "Choose Figma if you design websites or apps and need components, auto layout, prototyping and developer handoff.",
    highlights: [
      "Canva is template-first for non-designers, while Figma is built for trained designers working on interfaces.",
      "Figma supports components, variables and prototyping, which Canva does not aim to provide.",
      "Canva includes stock media and ready-made layouts, while Figma relies on community files and UI kits.",
    ],
  },
  {
    a: "hubspot",
    b: "salesforce",
    summary:
      "HubSpot and Salesforce are two of the most prominent CRM platforms, but they suit different organizations. HubSpot emphasizes ease of use and integrated marketing, sales and service hubs, while Salesforce offers enterprise-grade customization and an extensive ecosystem that usually requires dedicated administration.",
    chooseA:
      "Choose HubSpot if you want sales and marketing on one easy platform that a growing team can adopt without a dedicated administrator.",
    chooseB:
      "Choose Salesforce if you have complex sales processes, many teams or regions, and the resources to configure and administer the platform.",
    highlights: [
      "HubSpot offers free CRM tools to start with, while Salesforce is structured around paid editions.",
      "Salesforce provides deeper customization and a larger ecosystem of apps and specialists.",
      "HubSpot is generally faster to set up, while Salesforce implementations are often larger projects.",
    ],
  },
  {
    a: "hubspot",
    b: "pipedrive",
    summary:
      "HubSpot and Pipedrive are both popular with small and mid-sized businesses, but their scope differs. HubSpot is a broad customer platform spanning marketing, sales and service, while Pipedrive is a focused sales CRM built around a visual pipeline.",
    chooseA:
      "Choose HubSpot if you want marketing automation, email and service tools on the same database as your sales pipeline.",
    chooseB:
      "Choose Pipedrive if your priority is a simple, visual deal pipeline that salespeople will adopt quickly.",
    highlights: [
      "HubSpot offers free CRM tools, while Pipedrive is trial-based with paid plans.",
      "Pipedrive is purpose-built for pipeline and activity management; HubSpot covers the full customer lifecycle.",
      "HubSpot's costs can rise significantly with higher-tier hubs, while Pipedrive stays narrower in scope.",
    ],
  },
  {
    a: "hubspot",
    b: "zoho-crm",
    summary:
      "HubSpot and Zoho CRM both offer free entry points and connected suites of business tools. HubSpot focuses on a polished, easy experience with strong inbound marketing, while Zoho CRM offers deep configuration within Zoho's wider application ecosystem.",
    chooseA:
      "Choose HubSpot if ease of use and tightly integrated inbound marketing tools matter most to your team.",
    chooseB:
      "Choose Zoho CRM if you want extensive customization and process automation at a cost-conscious price point, especially if you use other Zoho apps.",
    highlights: [
      "HubSpot prioritizes a friendly interface, while Zoho CRM exposes more configuration options.",
      "Zoho CRM connects natively to Zoho's finance, support and productivity apps; HubSpot connects its own hubs.",
      "Both offer free entry points, but their limits and upgrade paths differ.",
    ],
  },
  {
    a: "pipedrive",
    b: "zoho-crm",
    summary:
      "Pipedrive and Zoho CRM both target small and mid-sized businesses but with different philosophies. Pipedrive keeps things simple and sales-focused, while Zoho CRM offers extensive customization and process tooling within a wider app suite.",
    chooseA:
      "Choose Pipedrive if you want the quickest path to a clean pipeline that reps enjoy using every day.",
    chooseB:
      "Choose Zoho CRM if you need custom modules, guided processes and deeper automation, and are willing to spend time on setup.",
    highlights: [
      "Pipedrive has a simpler interface, while Zoho CRM offers more configurable modules and rules.",
      "Zoho CRM offers a free edition for small teams; Pipedrive is trial-based.",
      "Zoho CRM's Blueprint enforces process steps, whereas Pipedrive guides reps through activity reminders.",
    ],
  },
  {
    a: "salesforce",
    b: "zoho-crm",
    summary:
      "Salesforce and Zoho CRM are both highly configurable, but they differ in scale and complexity. Salesforce is an enterprise platform with an extensive ecosystem, while Zoho CRM delivers substantial customization at a lighter administrative and cost footprint.",
    chooseA:
      "Choose Salesforce if you need enterprise-scale customization, a large partner ecosystem and support for complex organizational structures.",
    chooseB:
      "Choose Zoho CRM if you want configurable processes and automation without the implementation effort typical of enterprise platforms.",
    highlights: [
      "Salesforce offers a broader ecosystem of apps, integrations and certified administrators.",
      "Zoho CRM is part of a wider suite of Zoho business apps with native connections.",
      "Salesforce implementations usually demand more administration, while Zoho CRM is more approachable for smaller teams.",
    ],
  },
  {
    a: "semrush",
    b: "ahrefs",
    summary:
      "Semrush and Ahrefs are the two leading SEO suites and overlap heavily in keyword research, backlink analysis, site audits and rank tracking. Semrush extends further into paid search, content and competitive marketing, while Ahrefs is known for its backlink data and focused SEO workflow.",
    chooseA:
      "Choose Semrush if you want a single platform covering SEO, paid search research, content marketing and competitive analysis.",
    chooseB:
      "Choose Ahrefs if backlink analysis and competitor SEO research are central to your work and you prefer a focused interface.",
    highlights: [
      "Semrush covers more marketing channels, while Ahrefs concentrates on core SEO.",
      "Ahrefs is widely regarded for its backlink index; Semrush offers a large backlink database alongside broader tools.",
      "Ahrefs offers free webmaster tools for verified site owners, while Semrush sells additional toolkits and add-ons.",
    ],
  },
  {
    a: "asana",
    b: "monday",
    summary:
      "Asana and monday.com are both leading work management platforms, but they are structured differently. Asana is organized around tasks, projects, portfolios and goals, while monday.com is built on configurable boards with columns that teams shape to fit any process.",
    chooseA:
      "Choose Asana if you want a structured, opinionated approach to projects with strong goal tracking and portfolio visibility.",
    chooseB:
      "Choose monday.com if you prefer visual, spreadsheet-like boards that you can configure freely for many kinds of workflows.",
    highlights: [
      "Asana is task and project centric, while monday.com is board and column centric.",
      "monday.com's dashboards combine data from multiple boards; Asana offers portfolios and goals for cross-project visibility.",
      "Both offer no-code automation, with monday.com using recipe-style rules and Asana using a rules builder.",
    ],
  },
  {
    a: "asana",
    b: "clickup",
    summary:
      "Asana and ClickUp both handle projects, tasks and automation, but they differ in philosophy. Asana is polished and opinionated, while ClickUp aims to be an all-in-one workspace with docs, whiteboards and extensive customization.",
    chooseA:
      "Choose Asana if you want a clean, easy-to-adopt tool with a clear structure for projects, portfolios and goals.",
    chooseB:
      "Choose ClickUp if you want to consolidate tasks, docs and whiteboards in one highly customizable workspace.",
    highlights: [
      "ClickUp includes docs and whiteboards alongside tasks, while Asana focuses on work management.",
      "Asana is generally easier to learn, while ClickUp offers more configuration options.",
      "ClickUp's hierarchy of spaces, folders and lists differs from Asana's projects and portfolios model.",
    ],
  },
  {
    a: "clickup",
    b: "monday",
    summary:
      "ClickUp and monday.com are both flexible work platforms that can model many workflows. ClickUp packs tasks, docs, whiteboards and goals into one hierarchy, while monday.com emphasizes visual boards, easy automation and cross-board dashboards.",
    chooseA:
      "Choose ClickUp if you want the widest feature set in one workspace and have someone to design and maintain the setup.",
    chooseB:
      "Choose monday.com if you want a highly visual tool that non-technical teams can configure quickly.",
    highlights: [
      "ClickUp has a deeper built-in hierarchy and more native tools, while monday.com is centered on boards.",
      "monday.com is often easier for non-technical users to pick up; ClickUp has a steeper learning curve.",
      "Both offer many views and automation, with limits varying by plan.",
    ],
  },
  {
    a: "trello",
    b: "asana",
    summary:
      "Trello and Asana both help teams track work, but at different levels of complexity. Trello offers simple Kanban boards that anyone can use immediately, while Asana adds structured projects, timelines, dependencies and goals.",
    chooseA:
      "Choose Trello if you want the simplest possible board-based tool for a small team or straightforward workflow.",
    chooseB:
      "Choose Asana if your projects involve dependencies, milestones and cross-project reporting.",
    highlights: [
      "Trello is board-first, while Asana offers list, board, timeline and calendar views as core parts of the product.",
      "Asana supports native task dependencies, which Trello handles only in limited ways.",
      "Trello's Power-Ups extend functionality, while Asana builds more planning features in directly.",
    ],
  },
  {
    a: "trello",
    b: "clickup",
    summary:
      "Trello and ClickUp sit at opposite ends of the project management spectrum. Trello focuses on simple, visual boards, while ClickUp offers an extensive all-in-one workspace with many views, docs and customization options.",
    chooseA:
      "Choose Trello if you want a tool your team can use immediately with minimal setup and training.",
    chooseB:
      "Choose ClickUp if you need many views, custom fields, docs and dependencies built into one platform.",
    highlights: [
      "Trello's learning curve is minimal, while ClickUp's breadth takes time to master.",
      "ClickUp includes docs, whiteboards and goals natively; Trello relies on Power-Ups for extra features.",
      "ClickUp supports native dependencies and many views, while Trello centers on the board view.",
    ],
  },
];
