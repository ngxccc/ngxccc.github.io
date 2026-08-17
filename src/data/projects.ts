export interface ProjectDecision {
  label: string;
  detail: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  meta: string;
  problem: string;
  decisions: ProjectDecision[];
  benchmark?: string | undefined;
  github: string;
  demo?: string | undefined;
  featured: boolean;
}

export const projects: ProjectItem[] = [
  {
    id: "ticket-booking",
    title: "High-Concurrency Ticket Booking System",
    meta: "NestJS, PostgreSQL, Redis, BullMQ, Drizzle ORM, Docker, Caddy, Cloudflare Tunnel",
    problem:
      "Preventing seat double-booking and race conditions during high-volume ticket flash sales on a resource-constrained 1GB RAM virtual machine.",
    decisions: [
      {
        label: "Two-Tier Concurrency Control",
        detail:
          "Redis Redlock distributed locks serialize incoming seat reservation attempts, while PostgreSQL Pessimistic Locking (FOR UPDATE) guarantees row-level transactional isolation. BullMQ delayed queues handle automated 10-minute seat expiration releases.",
      },
      {
        label: "Transactional Outbox Pattern",
        detail:
          "Guarantees atomic email confirmation dispatches via Resend API, eliminating notification drops during transient network failures. PayOS payment integration uses HMAC-SHA256 signature verification and Redis idempotency locks.",
      },
      {
        label: "Zero-Downtime Infrastructure",
        detail:
          "Blue-Green deployment pipeline configured with Caddy reverse proxy and Cloudflare Tunnel (zero public inbound ports). Applied strict Docker memory constraints to prevent OOM crashes on limited VPS nodes.",
      },
    ],
    benchmark: `
Load Test: 5,000 Concurrent Requests (k6 stress test)
───────────────────────────────────────────────────────────
Double-Booking Rate:   0.00% (Zero seat overselling)
P99 Latency:           42 ms
Peak Memory:           320 MB (Bounded on 1GB VPS)`,
    github: "https://github.com/ngxccc/ticket-booking",
    featured: true,
  },
  {
    id: "hyundai-b2b",
    title: "Hyundai Ecommerce B2B Platform",
    meta: "Next.js 16, React 19, PostgreSQL, Drizzle ORM, Turborepo, Zod, Bun",
    problem:
      "Managing multi-warehouse inventory allocation and customer-tiered wholesale pricing with end-to-end type safety from database schema to client views.",
    decisions: [
      {
        label: "Full-Stack Type-Safe Monorepo",
        detail:
          "Structured a Turborepo monorepo coupling Next.js 16, React 19, and Drizzle ORM to enforce compile-time schema validation across database tables, API payloads, and frontend views.",
      },
      {
        label: "Atomic Inventory Transactions",
        detail:
          "Designed relational database schemas supporting multi-warehouse inventory and tiered pricing, utilizing database transactions to guarantee stock consistency during concurrent checkouts.",
      },
      {
        label: "Edge Caching & Mutation Security",
        detail:
          'Optimized product catalog load times using Next.js 16 Cache Components ("use cache", cacheLife, cacheTag). Secured mutation endpoints with Zod-validated Server Actions and automated test pipelines via GitHub Actions and Bun Test.',
      },
    ],
    benchmark: `
Catalog Performance & Validation
───────────────────────────────────────────────────────────
Edge TTFB:             < 35 ms (Next.js Cache Components)
Type Errors at Build:  0 (Strict compile-time schema sync)
Test Suite Pass Rate:  100% (Bun Test + GitHub Actions CI)`,
    github: "https://github.com/ngxccc/hyundai-ecommerce",
    featured: true,
  },
  {
    id: "digital-garden",
    title: "Minimalist Digital Garden & Portfolio",
    meta: "Astro, TypeScript, Static Site Generation, Minimalist CSS",
    problem:
      "Eliminating frontend bloatware (heavy client JavaScript, complex animation libraries, hydration overhead) to achieve an instant, distraction-free technical writing space.",
    decisions: [
      {
        label: "Zero Client-Side JavaScript",
        detail:
          "Pure static HTML compilation using Astro and Markdown Content Collections, achieving instant TTFB and 100/100 Lighthouse performance scores.",
      },
      {
        label: "Monochrome Academic Typography",
        detail:
          "Layout system inspired by classic Unix and academic technical blogs, utilizing semantic HTML and a single 2KB global stylesheet.",
      },
    ],
    github: "https://github.com/ngxccc/ngxccc.github.io",
    featured: false,
  },
];
