import type { SeedCategory } from "@/lib/content/seed/types";

export const seedCategories: SeedCategory[] = [
  {
    slug: "website-builders",
    name: "Website Builders",
    description: "Hosted platforms for designing, publishing and maintaining a website without managing servers yourself.",
    intro:
      "Choosing a website builder is mostly a decision about how much control you want to trade for convenience. All-in-one builders bundle hosting, security updates, templates and a visual editor, so you can launch without touching code, but they also decide how far you can bend layouts, what integrations are available and how easily you can leave later. Visual development platforms sit further along the spectrum, exposing layout and styling concepts that reward people who already think like web designers.\n\nBefore comparing feature lists, be clear about what the site actually has to do. A brochure site for a local service business, a portfolio for a photographer, an online store and a content-heavy marketing site each stress different parts of a platform: booking and forms, image presentation, checkout and inventory, or CMS structure and SEO control. Also consider who will edit the site after launch, whether you need to migrate content out in the future, and whether the plan you need for commerce, custom domains or removal of platform branding is the one you are actually budgeting for.",
    seoTitle: "Best Website Builders Compared: Wix, Squarespace, Webflow",
    seoDescription:
      "Compare leading website builders on templates, hosting, SEO controls, customization and ease of use to find the right platform for your site and team.",
    sortOrder: 1,
    faqs: [
      {
        question: "Can I move my site to another platform later?",
        answer:
          "Portability varies a lot between builders. Most hosted builders let you take your domain and copy your content, but very few let you export a working site with its design intact. If long-term portability matters, check each platform's export options before you invest heavily in building.",
      },
      {
        question: "Do website builders handle SEO well enough?",
        answer:
          "Mainstream builders cover the fundamentals such as editable titles and meta descriptions, clean URLs, sitemaps and redirects. Rankings depend far more on your content, site structure and reputation than on the builder itself, though platforms with finer control over markup and CMS structure give experienced SEOs more room to work.",
      },
      {
        question: "Should I pick a builder based on its templates?",
        answer:
          "Templates are a good starting point but a poor deciding factor on their own. Look at how easily you can change a template's structure, how it behaves on mobile, and whether switching templates later means rebuilding your pages.",
      },
      {
        question: "Is a website builder a good fit for an online store?",
        answer:
          "Many builders include commerce features, which suit small catalogs and straightforward checkout. Stores with complex inventory, many variants, or heavy integration needs should compare the builder's commerce features against dedicated ecommerce platforms before committing.",
      },
    ],
  },
  {
    slug: "design",
    name: "Design",
    description: "Tools for creating graphics, marketing assets, presentations and product interfaces, from template-led editors to professional design software.",
    intro:
      "Design tools split into two broad groups. Template-led editors make it quick for non-designers to produce on-brand social posts, presentations, flyers and short videos, with brand kits and approval workflows to keep a team consistent. Professional interface and vector tools prioritize precision, reusable components and developer handoff, and they assume the person using them has design training or is willing to learn.\n\nThe right choice depends on who is producing the work and what it becomes. A marketing team pushing out a steady stream of campaign assets needs speed, templates and guardrails that stop off-brand edits. A product team designing an app needs components, auto layout, prototyping and a clean way to hand specifications to engineers. Many organizations use one tool of each kind, so consider how assets, fonts and brand libraries move between them, and how licensing for stock media and fonts works on the plans you are considering.",
    seoTitle: "Best Design Tools Compared: Canva, Adobe Express, Figma",
    seoDescription:
      "Compare design tools on templates, collaboration, brand controls, precision and learning curve, from quick marketing graphics to product interface design.",
    sortOrder: 2,
    faqs: [
      {
        question: "What is the difference between a template editor and a professional design tool?",
        answer:
          "Template editors are built so anyone can adapt a ready-made layout quickly, with guardrails such as brand kits. Professional tools give precise control over vectors, layout systems and components, which suits trained designers building interfaces or original artwork but takes longer to learn.",
      },
      {
        question: "Can non-designers keep content on brand?",
        answer:
          "Yes, if the tool supports shared brand assets such as logos, colors, fonts and locked templates. These controls are usually part of paid team plans, so confirm which tier includes them before rolling a tool out to a wider team.",
      },
      {
        question: "Do I need a separate tool for product and UI design?",
        answer:
          "Usually. Template-led editors are not designed for building interface systems, prototypes or developer handoff. Teams designing apps or websites at a detailed level typically use a dedicated interface design tool alongside, or instead of, a marketing graphics editor.",
      },
      {
        question: "Can I use stock images and templates commercially?",
        answer:
          "Each vendor sets its own content licensing terms, and they can differ between free and paid assets. Read the license for the specific assets you use, particularly for merchandise, resale or trademark use.",
      },
    ],
  },
  {
    slug: "crm",
    name: "CRM",
    description: "Customer relationship management software for tracking contacts, deals and sales activity in one shared system.",
    intro:
      "A CRM becomes the system of record for your customer relationships, so the decision is less about individual features and more about fit with how your team sells. Pipeline-first tools keep the focus on moving deals forward with a visual board and activity reminders, while broader customer platforms connect sales records to marketing automation, service tickets and reporting across the whole customer lifecycle. Enterprise platforms go further still, offering deep data modeling and customization that usually requires an administrator to run well.\n\nWhen comparing options, start with your sales process: how many pipelines you run, who needs access, what data you must capture and which tools the CRM must sync with, such as email, calendar, accounting or your marketing platform. Then look at setup effort and ongoing ownership. A CRM that is powerful but nobody updates is worse than a simple one the team actually uses, and costs often rise as you add seats, advanced automation or reporting, so model the plan you will need a year from now rather than the one you start on.",
    seoTitle: "Best CRM Software Compared: HubSpot, Salesforce, Pipedrive",
    seoDescription:
      "Compare CRM platforms on pipeline management, automation, reporting, customization and setup effort to find the right fit for your sales process and team.",
    sortOrder: 3,
    faqs: [
      {
        question: "Is a free CRM enough for a small business?",
        answer:
          "A free CRM edition can cover contact management and a basic pipeline for a small team. Limits on automation, reporting, users or support typically appear as you grow, so check what the free edition excludes before building your process around it.",
      },
      {
        question: "How long does it take to set up a CRM?",
        answer:
          "Simple pipeline tools can be usable quickly once contacts are imported. Platforms with custom objects, multiple teams and integrations take considerably longer and may benefit from an administrator or implementation partner.",
      },
      {
        question: "Should sales and marketing use the same CRM?",
        answer:
          "Sharing one system avoids duplicate records and makes it easier to see which campaigns lead to revenue. Some teams still prefer a focused sales CRM connected to a separate marketing tool, which works as long as the integration keeps data in sync reliably.",
      },
      {
        question: "What should I check before migrating CRMs?",
        answer:
          "Map your fields, pipelines and custom data first, decide how much history to bring across, and confirm how emails, notes and attachments will migrate. Plan for rebuilding automations and reports, since these rarely transfer directly between vendors.",
      },
    ],
  },
  {
    slug: "marketing",
    name: "Marketing",
    description: "SEO and search marketing platforms for keyword research, backlink analysis, site audits and rank tracking.",
    intro:
      "SEO platforms sell access to large datasets: keyword databases, backlink indexes and crawled pages, plus tools that turn that data into research, audits and reports. The leading suites overlap heavily, so the practical differences come down to the depth and freshness of the data you rely on most, how the interface fits your workflow, and how far the toolkit extends beyond organic search into areas such as paid search, content planning or local listings.\n\nThink about the work you will do every week. An in-house marketer may mostly need keyword research, a site audit and a handful of tracked rankings. An agency needs to manage many client projects, share reports and research competitors across markets. Usage limits on projects, tracked keywords, reports and seats are where costs tend to grow, so compare the limits of the tier that matches your real workload, not just the headline feature list.",
    seoTitle: "Best SEO Tools Compared: Semrush vs Ahrefs",
    seoDescription:
      "Compare SEO platforms on keyword research, backlink data, site audits, rank tracking and content tools to choose the right toolkit for your marketing team.",
    sortOrder: 4,
    faqs: [
      {
        question: "Do I need both Semrush and Ahrefs?",
        answer:
          "Most teams do not. The two suites cover much of the same ground, and one is usually enough for research, audits and tracking. Some specialists subscribe to both to cross-check data, but that is a preference rather than a requirement.",
      },
      {
        question: "How accurate is third-party SEO data?",
        answer:
          "Keyword volumes and traffic figures from SEO tools are estimates built from sampled and modeled data. They are useful for comparing opportunities and competitors, but your own analytics and search console data are the source of truth for your site.",
      },
      {
        question: "What limits should I compare between SEO tool plans?",
        answer:
          "Look at the number of projects, tracked keywords, pages crawled in audits, report exports and user seats. These usage limits often matter more to the total cost than the list of available tools.",
      },
    ],
  },
  {
    slug: "project-management",
    name: "Project Management",
    description: "Work management tools for planning projects, assigning tasks and tracking progress across a team.",
    intro:
      "Project management tools range from simple boards that visualize tasks moving through stages to configurable work platforms that combine projects, docs, goals, dashboards and automation. Simple tools are quick to adopt and hard to misuse, while flexible platforms can model almost any workflow but need someone to design the structure and keep it tidy.\n\nStart by describing how your team actually works: whether you run repeatable processes or one-off projects, whether tasks depend on each other, how many teams need to coordinate and what leaders need to see in reports. Adoption is the biggest risk with this category, so weigh the learning curve and the everyday editing experience as heavily as advanced features. Check which views, automations, dependencies and reporting options sit on the plan you would realistically use, since these are often the capabilities reserved for paid tiers.",
    seoTitle: "Best Project Management Tools: Asana, monday.com, ClickUp",
    seoDescription:
      "Compare project management tools on views, automation, dependencies, reporting and learning curve to find the right fit for how your team plans and ships work.",
    sortOrder: 5,
    faqs: [
      {
        question: "Is a Kanban board enough for project management?",
        answer:
          "For small teams with straightforward workflows, a board is often all you need. Once you have dependencies between tasks, several projects competing for the same people, or leadership reporting requirements, timeline views, workload views and dashboards become more valuable.",
      },
      {
        question: "How do I get a team to adopt a new project management tool?",
        answer:
          "Keep the initial setup simple, agree on a few conventions such as how tasks are named and when they are updated, and move one active project in first. Adding structure gradually works better than launching with a complex system nobody understands.",
      },
      {
        question: "Can project management tools replace docs and chat?",
        answer:
          "Some platforms include docs, whiteboards and comments, which can reduce the number of separate tools. Most teams still keep a chat tool for quick conversation, so check how well the project tool integrates with the chat and document tools you already use.",
      },
      {
        question: "What is the difference between project and work management?",
        answer:
          "Project management focuses on delivering defined projects with tasks, owners and deadlines. Work management tools extend that to ongoing processes such as requests, content calendars or operations, often with configurable fields and dashboards across teams.",
      },
    ],
  },
];
