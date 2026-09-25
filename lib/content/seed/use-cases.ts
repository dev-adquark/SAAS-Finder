import type { SeedUseCase } from "@/lib/content/seed/types";

export const seedUseCases: SeedUseCase[] = [
  {
    slug: "website-builders-for-small-business",
    title: "Best Website Builders for Small Business",
    audience: "Small business owners",
    category: "website-builders",
    intro:
      "For most small businesses, a website has a practical job: help local customers find you, explain what you offer, and turn visits into calls, bookings, quote requests or sales. The owner is often the person maintaining it, usually in spare moments between running the business, so a builder that is quick to update and handles hosting and security without intervention is worth more than advanced design control.\n\nThe builders below are ranked by how well they support that reality. We weighed built-in business tools such as bookings, forms and simple commerce, how easy everyday edits are for a non-designer, and how much of the essential SEO groundwork is handled for you. We also considered what happens when you need help later, whether from a freelancer or from the platform's own ecosystem of apps.",
    criteria: [
      { name: "Built-in business tools", description: "Native or add-on support for bookings, contact forms, simple stores and customer communication." },
      { name: "Ease of everyday edits", description: "How quickly a non-designer can update hours, prices, photos and pages without breaking the layout." },
      { name: "Local SEO basics", description: "Editable metadata, clean URLs, sitemaps and mobile-friendly pages that help local searchers find you." },
      { name: "Low maintenance", description: "Managed hosting, security and updates so the owner does not have to maintain infrastructure." },
    ],
    seoTitle: "Best Website Builders for Small Business",
    seoDescription:
      "Compare the best website builders for small businesses on bookings, ease of editing, local SEO basics and maintenance, with honest caveats for each platform.",
    faqs: [
      {
        question: "Which website builder is easiest for a small business owner to maintain?",
        answer:
          "All-in-one builders with managed hosting are easiest because updates and security are handled for you. Among them, the best choice is the one whose editor you find intuitive, so try editing a template before committing.",
      },
      {
        question: "Do small businesses need a custom-coded website?",
        answer:
          "Rarely at the start. A hosted builder covers most small business needs, and custom development makes more sense once you have specialized requirements such as complex integrations or unique functionality.",
      },
      {
        question: "Can I take online bookings with a website builder?",
        answer:
          "Yes. Several builders include scheduling natively or through add-ons. Check which plan includes bookings and whether it supports deposits, staff calendars or reminders if you need them.",
      },
    ],
    products: [
      {
        slug: "wix",
        rationale:
          "Wix offers the widest range of built-in business tools, from bookings and events to stores and forms, and its editor is approachable for owners doing their own updates.",
        caveat: "Its free-form editor can make larger sites harder to keep consistent, and switching templates later means rebuilding.",
      },
      {
        slug: "squarespace",
        rationale:
          "Squarespace is a good fit for service businesses and small shops that want a polished, professional presence with scheduling and commerce available on the same platform.",
        caveat: "Its app ecosystem is narrower, so businesses with unusual integration needs should check compatibility first.",
      },
      {
        slug: "webflow",
        rationale:
          "Webflow suits small businesses that are working with a designer or agency and want a custom, scalable marketing site with a structured CMS.",
        caveat: "Owners maintaining the site alone will face a steeper learning curve than on all-in-one builders.",
      },
    ],
  },
  {
    slug: "website-builders-for-creators",
    title: "Best Website Builders for Creators",
    audience: "Creators, artists and portfolio owners",
    category: "website-builders",
    intro:
      "Creators need a website that shows their work at its best: photography, illustration, writing, video or a personal brand. Visual presentation matters more here than in most categories, because the site itself is part of the portfolio. Many creators also want to sell prints, digital products, memberships or services from the same place.\n\nWe ranked these builders on how well they present visual work, how much control they give over a distinctive look, and how easily a creator can publish new pieces and sell directly to an audience. Different creators will weigh these differently: a photographer may prize image presentation above all, while a designer building a personal brand may want complete control over layout and interactions.",
    criteria: [
      { name: "Visual presentation", description: "How well templates and layouts showcase images, video and written work." },
      { name: "Creative control", description: "Freedom to shape a distinctive look rather than a generic template." },
      { name: "Publishing workflow", description: "How easy it is to add new portfolio pieces, blog posts or projects regularly." },
      { name: "Selling to an audience", description: "Support for selling prints, digital goods, services or memberships directly." },
    ],
    seoTitle: "Best Website Builders for Creators and Portfolios",
    seoDescription:
      "Find the best website builder for creators, artists and portfolios, compared on visual presentation, creative control, publishing workflow and selling tools.",
    faqs: [
      {
        question: "What is the best website builder for a portfolio?",
        answer:
          "Design-led builders tend to be the easiest route to a polished portfolio, while visual development platforms suit creators who want complete control. The best choice depends on whether you prefer strong defaults or full design freedom.",
      },
      {
        question: "Can I sell my work from a portfolio site?",
        answer:
          "Yes. Most major builders support selling physical or digital products, and some support memberships or services. Commerce features vary by plan, so check the plan you intend to use.",
      },
      {
        question: "Should creators use a custom domain?",
        answer:
          "A custom domain looks more professional and makes your site easier to remember and share. Most builders require a paid plan to connect one.",
      },
    ],
    products: [
      {
        slug: "squarespace",
        rationale:
          "Squarespace's curated, image-forward templates make it the quickest route to a portfolio that looks professionally designed, with commerce and memberships available on the same platform.",
        caveat: "Creators who want a truly unconventional layout may find its section-based editor restrictive.",
      },
      {
        slug: "webflow",
        rationale:
          "Webflow gives designers and visually ambitious creators full control over layout and interactions, so the site itself can become a showcase of their skills.",
        caveat: "It requires comfort with web design concepts, and its commerce tools are less central than its design features.",
      },
      {
        slug: "wix",
        rationale:
          "Wix suits creators who want to drag elements anywhere and add features such as bookings, events or online courses through its app market.",
        caveat: "Its flexibility makes it easier to end up with an inconsistent design unless you stay disciplined.",
      },
    ],
  },
  {
    slug: "crm-for-freelancers",
    title: "Best CRM for Freelancers",
    audience: "Freelancers and solo consultants",
    category: "crm",
    intro:
      "Freelancers rarely need an enterprise sales system. What they need is a reliable place to keep client contacts, track proposals and follow-ups, and see which opportunities are close to turning into paid work. Because the freelancer is also the administrator, a CRM must be quick to set up, cheap or free to run, and simple enough to keep updated alongside client work.\n\nWe ranked these CRMs on how well they fit a one-person business: whether there is a usable free edition, how little setup is needed before the tool becomes useful, how clearly it shows follow-ups and deal stages, and whether it connects to email and calendars without effort. Tools built for large teams can technically work for freelancers, but the overhead is rarely worth it.",
    criteria: [
      { name: "Cost for a single user", description: "Availability of a free edition or an affordable single-seat option." },
      { name: "Minimal setup", description: "How quickly a solo user can import contacts and start tracking deals." },
      { name: "Follow-up visibility", description: "Clear reminders and pipeline views so no proposal or lead is forgotten." },
      { name: "Email and calendar sync", description: "Easy connection to the inbox and calendar a freelancer already uses." },
    ],
    seoTitle: "Best CRM for Freelancers and Solo Consultants",
    seoDescription:
      "Compare the best CRM tools for freelancers on cost for a single user, setup effort, follow-up reminders and email sync, with caveats for each option.",
    faqs: [
      {
        question: "Do freelancers really need a CRM?",
        answer:
          "Once you are juggling several leads, proposals and repeat clients, a CRM helps prevent missed follow-ups and gives you a clear picture of upcoming work. A spreadsheet can work at first but becomes harder to manage as volume grows.",
      },
      {
        question: "Is a free CRM good enough for a freelancer?",
        answer:
          "Often, yes. A free CRM edition typically covers contacts, a pipeline and basic email tracking, which is enough for many solo businesses. Check the limits on features and automation before committing.",
      },
      {
        question: "What should a freelancer track in a CRM?",
        answer:
          "Track contacts, the source of each lead, proposal status, next follow-up dates and deal value. Keeping notes from calls and meetings on each record also helps when clients return.",
      },
    ],
    products: [
      {
        slug: "hubspot",
        rationale:
          "HubSpot's free CRM tools give freelancers contact management, a deal pipeline and email tracking without an upfront cost, with room to add marketing tools later.",
        caveat: "Upgrading beyond the free tools can become expensive, so freelancers should be clear about which paid features they actually need.",
      },
      {
        slug: "zoho-crm",
        rationale:
          "Zoho CRM's free edition suits budget-conscious freelancers, and those who already use Zoho apps for invoicing or email benefit from native connections.",
        caveat: "Its settings-heavy interface takes a little longer to learn than simpler tools.",
      },
      {
        slug: "pipedrive",
        rationale:
          "Pipedrive's visual pipeline and activity reminders make it easy for a freelancer to see which proposals need a nudge and what to do next.",
        caveat: "It is trial-based rather than free, so solo users should weigh the ongoing subscription against free alternatives.",
      },
    ],
  },
  {
    slug: "crm-for-small-sales-teams",
    title: "Best CRM for Small Sales Teams",
    audience: "Small sales teams",
    category: "crm",
    intro:
      "A small sales team needs a CRM that reps will actually keep up to date, because pipeline data is only useful when it is accurate. That means a clear view of deals, easy activity logging, and automation that removes admin rather than adding it. Sales managers also need reliable reporting on pipeline health and forecasts without hiring a dedicated administrator.\n\nWe ranked these CRMs for teams of a handful of reps up to a small department. We looked at how quickly the team can become productive, how well the pipeline supports daily selling, how much automation is available without complex configuration, and how the platform scales if the team grows or adds marketing and service needs.",
    criteria: [
      { name: "Rep adoption", description: "How intuitive the daily workflow is, so reps log activities and update deals consistently." },
      { name: "Pipeline clarity", description: "Visual deal stages, multiple pipelines and clear next steps for each opportunity." },
      { name: "Practical automation", description: "Automations that cut routine admin such as follow-up tasks and deal handoffs." },
      { name: "Manager reporting", description: "Reports and forecasts a sales manager can build and trust without an administrator." },
    ],
    seoTitle: "Best CRM for Small Sales Teams",
    seoDescription:
      "Compare the best CRMs for small sales teams on rep adoption, pipeline clarity, practical automation and manager reporting, with trade-offs for each tool.",
    faqs: [
      {
        question: "What matters most when choosing a CRM for a small sales team?",
        answer:
          "Adoption matters most. A CRM that reps find easy to update produces accurate pipeline data, which makes reporting and forecasting reliable. Prioritize daily usability over a long feature list.",
      },
      {
        question: "Should a small team choose an enterprise CRM to prepare for growth?",
        answer:
          "Usually not. Enterprise CRMs bring setup and administration overhead that small teams struggle to absorb. It is often better to choose a tool that fits now and migrate if requirements genuinely change.",
      },
      {
        question: "How many pipelines should a small sales team use?",
        answer:
          "Start with one pipeline per distinct sales process, such as new business and renewals. Too many pipelines early on can make reporting harder to interpret.",
      },
    ],
    products: [
      {
        slug: "pipedrive",
        rationale:
          "Pipedrive is built around exactly what small sales teams do every day, with a visual pipeline and activity focus that keeps reps engaged and data current.",
        caveat: "Teams that also need marketing automation or service ticketing will need additional tools or integrations.",
      },
      {
        slug: "hubspot",
        rationale:
          "HubSpot suits small sales teams that work closely with marketing, since deals, contacts and campaigns share one database and reporting.",
        caveat: "Costs can rise quickly as seats and higher-tier sales features are added.",
      },
      {
        slug: "zoho-crm",
        rationale:
          "Zoho CRM gives process-driven teams configurable stages, Blueprint rules and workflow automation at a price point that suits smaller budgets.",
        caveat: "Getting the most from it requires someone willing to spend time on configuration.",
      },
      {
        slug: "salesforce",
        rationale:
          "Salesforce can make sense for small teams that expect rapid growth or already need complex territories, approvals or integrations.",
        caveat: "Without an administrator or partner, its setup and upkeep can overwhelm a small team.",
      },
    ],
  },
  {
    slug: "design-tools-for-marketing-teams",
    title: "Best Design Tools for Marketing Teams",
    audience: "Marketing teams",
    category: "design",
    intro:
      "Marketing teams produce a constant stream of visual content: social posts, ads, email headers, presentations, event materials and landing page graphics. Much of it is created by marketers rather than trained designers, so the right tool needs to make quality output easy while protecting brand consistency across many hands.\n\nWe ranked these tools on how well they serve that workflow. The most important factors are the speed of producing common formats, the strength of brand controls such as locked templates and shared assets, collaboration and approval features, and how well the tool fits alongside the professional design tools a brand or web team may already use.",
    criteria: [
      { name: "Speed for common formats", description: "Templates and resizing that turn a campaign idea into multiple channel assets quickly." },
      { name: "Brand consistency", description: "Shared logos, colors, fonts and templates that keep non-designers on brand." },
      { name: "Collaboration and review", description: "Comments, sharing and approvals that fit a team's review process." },
      { name: "Fit with existing tools", description: "How well assets move between the tool and the team's other design and publishing tools." },
    ],
    seoTitle: "Best Design Tools for Marketing Teams",
    seoDescription:
      "Compare design tools for marketing teams on speed, brand consistency, collaboration and fit with existing tools, from template editors to Figma.",
    faqs: [
      {
        question: "Should marketing teams use Figma or a template editor?",
        answer:
          "Template editors are faster for most day-to-day campaign assets created by marketers. Figma is valuable when the marketing team designs web pages or works closely with product designers on shared design systems.",
      },
      {
        question: "How can a marketing team keep designs on brand?",
        answer:
          "Use a tool with brand kits and shared templates, restrict edits to key elements where possible, and give the team a small set of approved starting templates for common formats.",
      },
      {
        question: "Can one design tool cover all marketing needs?",
        answer:
          "A template editor can cover most everyday content, but many teams pair it with a professional tool for brand identity, web design or complex illustration work.",
      },
    ],
    products: [
      {
        slug: "canva",
        rationale:
          "Canva lets marketers of any skill level produce on-brand content across nearly every format, with brand kits, shared templates and collaboration built for teams.",
        caveat: "Brand controls sit on paid plans, and heavily used templates need customizing to avoid a generic look.",
      },
      {
        slug: "adobe-express",
        rationale:
          "Adobe Express fits marketing teams that already use Creative Cloud, since brand assets from Photoshop or Illustrator flow in through shared libraries.",
        caveat: "Teams outside the Adobe ecosystem gain less from its integration advantages.",
      },
      {
        slug: "figma",
        rationale:
          "Figma suits marketing teams that design landing pages, web graphics and campaign systems alongside product or web designers.",
        caveat: "It is slower than template editors for quick social content and assumes some design skill.",
      },
    ],
  },
  {
    slug: "seo-tools-for-agencies",
    title: "Best SEO Tools for Agencies",
    audience: "SEO and marketing agencies",
    category: "marketing",
    intro:
      "Agencies use SEO tools differently from in-house teams. They research many domains across industries, pitch prospects with competitive analysis, run audits for multiple clients, and report results on a regular schedule. The right platform needs to handle volume and client separation without costs spiraling, and it must produce reports that clients understand.\n\nWe compared these tools on the factors that matter most for agency work: depth of competitive and backlink research, support for managing many client projects, reporting and sharing options, and breadth beyond organic search for agencies that also offer paid or content services. Both leading suites are capable, so the decision usually hinges on your agency's service mix.",
    criteria: [
      { name: "Competitive research depth", description: "Quality of keyword, traffic and backlink data for researching clients and competitors." },
      { name: "Multi-client management", description: "Projects, limits and seats that scale with a growing client roster." },
      { name: "Client reporting", description: "Report building, scheduling and sharing options suitable for client delivery." },
      { name: "Service breadth", description: "Coverage beyond organic SEO for agencies that also run paid, content or local campaigns." },
    ],
    seoTitle: "Best SEO Tools for Agencies: Semrush vs Ahrefs",
    seoDescription:
      "Compare the best SEO tools for agencies on competitive research, multi-client management, reporting and service breadth to choose the right platform.",
    faqs: [
      {
        question: "Which SEO tool is better for agency reporting?",
        answer:
          "Both leading suites support reporting, but they differ in report builders, branding options and scheduling by plan. Agencies should test how easily they can produce the specific reports their clients expect.",
      },
      {
        question: "How should agencies compare SEO tool plans?",
        answer:
          "Compare the limits on projects, tracked keywords, audit crawls, reports and seats against your current and expected client load. These limits usually determine the real cost more than the base subscription.",
      },
      {
        question: "Do agencies need more than one SEO tool?",
        answer:
          "Many agencies standardize on one suite for efficiency. Some specialist agencies add a second tool to cross-check data or cover a gap, but it is not a requirement.",
      },
    ],
    products: [
      {
        slug: "semrush",
        rationale:
          "Semrush suits full-service agencies because it covers SEO, paid search research, content marketing and local tools in one platform with project-based client management.",
        caveat: "The number of tools and add-ons can make plan selection and costs complex for growing agencies.",
      },
      {
        slug: "ahrefs",
        rationale:
          "Ahrefs is a strong fit for SEO-focused agencies that lean on backlink analysis, competitor research and content gap work for pitches and strategy.",
        caveat: "Agencies offering paid search or broader marketing services will find its coverage narrower, and usage-based limits need monitoring.",
      },
    ],
  },
  {
    slug: "project-management-tools-for-small-teams",
    title: "Best Project Management Tools for Small Teams",
    audience: "Small teams",
    category: "project-management",
    intro:
      "Small teams need project management that gets out of the way. With a handful of people, there is rarely a dedicated operations lead to design workflows, so the best tool is one everyone understands immediately, keeps work visible, and does not demand ongoing administration. Cost per seat also matters more when budgets are tight.\n\nWe ranked these tools on how quickly a small team can start, how easy daily updates are, how much value the free or entry tiers provide, and whether the tool can grow with the team without a painful migration. Simpler tools come first here because adoption is the biggest risk for small teams, but more capable platforms are included for teams that expect complexity.",
    criteria: [
      { name: "Speed to adopt", description: "How quickly everyone on the team can understand and use the tool without training." },
      { name: "Everyday simplicity", description: "Low friction for creating, updating and completing tasks." },
      { name: "Value on entry tiers", description: "How much useful functionality is available on free or entry-level plans." },
      { name: "Room to grow", description: "Ability to add views, automation and structure as the team and projects grow." },
    ],
    seoTitle: "Best Project Management Tools for Small Teams",
    seoDescription:
      "Compare project management tools for small teams on speed to adopt, everyday simplicity, value on entry tiers and room to grow, with caveats for each.",
    faqs: [
      {
        question: "What is the simplest project management tool for a small team?",
        answer:
          "Board-based tools are usually the simplest because moving cards between columns is intuitive. They work well until projects involve many dependencies or cross-project reporting.",
      },
      {
        question: "Can a small team use a free project management plan?",
        answer:
          "Many small teams start on free plans successfully. Check limits on users, views, automation and storage, since these determine when an upgrade becomes necessary.",
      },
      {
        question: "When should a small team switch to a more advanced tool?",
        answer:
          "Consider switching when you regularly need dependencies, timelines, workload balancing or reporting across projects that your current tool cannot provide without workarounds.",
      },
    ],
    products: [
      {
        slug: "trello",
        rationale:
          "Trello's board-and-card model is understood almost instantly, making it the lowest-friction way for a small team to make work visible.",
        caveat: "Teams will outgrow it if projects need dependencies, timelines or cross-project reporting on the free tier.",
      },
      {
        slug: "asana",
        rationale:
          "Asana gives small teams a clean structure for projects and tasks that scales gracefully as work becomes more complex.",
        caveat: "Timelines, advanced automation and reporting require paid tiers.",
      },
      {
        slug: "clickup",
        rationale:
          "ClickUp suits small teams that want tasks, docs and whiteboards in one place and are happy to invest a little time in setup.",
        caveat: "Its breadth of options can overwhelm teams that just want a simple task list.",
      },
      {
        slug: "monday",
        rationale:
          "monday.com works for small teams that like visual, spreadsheet-style boards and want quick automation wins.",
        caveat: "Seat-based packaging can make it less economical for very small or uneven team sizes.",
      },
    ],
  },
  {
    slug: "project-management-tools-for-marketing-teams",
    title: "Best Project Management Tools for Marketing Teams",
    audience: "Marketing teams",
    category: "project-management",
    intro:
      "Marketing teams juggle campaigns, content calendars, creative requests, launches and recurring reporting, often with contributors across design, sales and external agencies. Their project tool needs to handle both one-off campaigns with deadlines and repeatable processes such as content production, while giving leaders a clear view of what is shipping and when.\n\nWe ranked these tools on how well they support marketing workflows: request intake from other teams, calendar and timeline views for campaigns and content, automation for approvals and handoffs, and dashboards for tracking progress across many initiatives. The ordering differs from our small-team list because marketing work places more weight on intake, calendars and cross-project visibility than on pure simplicity.",
    criteria: [
      { name: "Request intake", description: "Forms and templates that turn requests from other teams into structured tasks." },
      { name: "Campaign and content calendars", description: "Calendar and timeline views that make launch dates and publishing schedules clear." },
      { name: "Approvals and handoffs", description: "Automation that moves work between writers, designers and reviewers smoothly." },
      { name: "Cross-campaign visibility", description: "Dashboards or portfolios that show progress across many campaigns at once." },
    ],
    seoTitle: "Best Project Management Tools for Marketing Teams",
    seoDescription:
      "Compare project management tools for marketing teams on request intake, campaign calendars, approvals and cross-campaign visibility, with honest trade-offs.",
    faqs: [
      {
        question: "What features should marketing teams look for in a project management tool?",
        answer:
          "Look for request forms, calendar and timeline views, reusable campaign templates, approval workflows and dashboards that summarize progress across campaigns.",
      },
      {
        question: "Can a project management tool manage a content calendar?",
        answer:
          "Yes. Most tools in this category offer calendar views and custom fields for channel, status and publish date, which make them practical for editorial calendars.",
      },
      {
        question: "How do marketing teams handle creative requests from other departments?",
        answer:
          "Many teams use intake forms that create tasks automatically with the required details, then route them to the right person with automation rules.",
      },
    ],
    products: [
      {
        slug: "asana",
        rationale:
          "Asana's forms, rules, timelines and portfolios map closely to marketing workflows, from creative requests to campaign launches and leadership reporting.",
        caveat: "Several of these capabilities, including timelines and portfolios, depend on paid tiers.",
      },
      {
        slug: "monday",
        rationale:
          "monday.com's visual boards and dashboards make content calendars and campaign trackers easy to build and share with stakeholders.",
        caveat: "Without clear conventions, marketing workspaces can sprawl across too many boards.",
      },
      {
        slug: "clickup",
        rationale:
          "ClickUp suits marketing teams that want briefs, docs and tasks together, with custom fields for channels, formats and statuses.",
        caveat: "Its interface and settings take time to learn, which can slow adoption among occasional contributors.",
      },
      {
        slug: "trello",
        rationale:
          "Trello works for small marketing teams running a simple content pipeline where cards move from idea to published.",
        caveat: "Cross-campaign reporting and advanced calendar planning need paid tiers or Power-Ups.",
      },
    ],
  },
];
