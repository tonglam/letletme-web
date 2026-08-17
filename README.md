# LetLetMe Web

Front end of [letletme.top](https://letletme.top) — a live-first, persistent Fantasy Premier League (FPL) context and custom-competition platform.

## Overview

LetLetMe helps FPL managers follow their teams, tracked official leagues, and custom competitions live; preserve the personal and competition context that matters across the season; and explore source-backed evidence without turning it into transfer advice.

> **The whole gameweek. Your call.**

The target public information architecture is:

- **Live:** Follow every point, rank, and competition change as it happens.
- **Briefing:** Catch up on globally edited real-world Week, News, Views, and Features without personalized ranking or LetLetMe recommendations.
- **My FPL:** Return to a linked team, season history, official leagues, and remembered context.
- **Competitions:** Track bounded official leagues and run LetLetMe competitions that go beyond official FPL formats.
- **Explore:** Inspect players, fixtures, the market, field trends, and comparisons.

LetLetMe does not operate a manager's official FPL team, build its own points forecasts, or issue `buy`, `sell`, or optimized-team recommendations. Official team actions remain on the official FPL website.

See [LetLetMe Product Conclusions](docs/product/letletme-product-conclusions.md) for the full product definition, information architecture, resource priorities, assistant concept, retention model, and homepage direction. The historical [Four-Section Product Specification](docs/product/letletme-four-section-specification.md) continues to define Live, My FPL, Competitions, and Explore; its Briefing clauses are superseded. The [Briefing Full-Chain Architecture](docs/product/letletme-briefing-content-architecture.md) defines the current X/Grok acquisition, editorial, Data, GraphQL, Web, cache, and operations contract; the [Briefing News Architecture](docs/product/letletme-briefing-news-architecture.md) provides the executable News-menu contract. The [Cross-Section Implementation Plan](docs/product/letletme-cross-section-implementation-plan.md) governs the remaining shared identities, contracts, dependency gates, migration boundaries, and delivery order.

This repository is the UI and identity authority in a four-repository system:

- `letletme_data` validates FPL input and is the sole writer of canonical
  `public` domain tables and shared Redis read models.
- `letletme-graphql` exposes public and authorized product reads.
- `letletme-web` owns Better Auth, verified FPL binding, Mini Program sessions,
  and the browser-to-service boundary.
- `letletme-wechat-miniprogram` is a native client with no direct database or
  shared-cache access.

PostgreSQL is authoritative. Redis, signed request envelopes, server-rendered
caches, and browser state are derived and replaceable.

## Features

- **Live results:** Real-time team points, player contributions, matches, bonus state, and prepared tracked-official-league or custom-competition standings with provisional-state handling.
- **My FPL review:** Settled team and competition results, season history, rank movement, captaincy, bench, hits, chips, transfers, and comparative league context.
- **Prepared competitions:** Resource-bounded tracked official leagues with scheduled collection, plus custom membership, gameweek configuration, points races, groups, knockouts, live standings, completed results, and management tools.
- **Briefing (planned):** One globally edited Week publication plus News, Views, and Features sourced from attributed real-world information.
- **Explore tools:** Gameweek statistics, fixtures and difficulty, market movement, league trends and exposure, player profiles, and multi-player comparison.
- **Personal context:** Verified FPL-team binding, authenticated private views, and the foundation for remembered teams, leagues, competitions, and followed interests.
- **Trustworthy data states:** Official FPL facts, transparent LetLetMe calculations, separate verified match evidence, freshness, and graceful degraded states.
- **Authentication:** Secure login, account management, and server-owned authorization for private operations.

The public labels above describe the agreed product model. Some current route and source-directory names—such as `data`, `me`, and `tournament`—predate that information architecture and remain implementation names until a deliberate migration.

## Tech Stack

### Core Technologies

- **TypeScript**: Type-safe JavaScript for better developer experience
- **Next.js 16**: React framework with App Router for server and client components
- **TailwindCSS**: Utility-first CSS framework for styling
- **Shadcn/UI**: Reusable UI components built with Radix UI and Tailwind

### Form Handling

- **React Hook Form**: Form validation and handling
- **Zod**: Schema validation for forms and data

### UI/UX

- **Lucide React**: Icon library
- **Tailwind Merge**: Utility for merging Tailwind classes
- **Tailwind Animate**: Animation utilities for Tailwind

### Development Tools

- **ESLint**: JavaScript/TypeScript linting
- **Next.js App Router**: File-based routing system

## Project Structure

```text
letletme-web/
├── app/                  # Next.js App Router pages
│   ├── auth/             # Authentication routes
│   ├── data/             # Data visualization routes
│   ├── live/             # Live match data
│   ├── profile/          # User profile pages
│   ├── stats/            # Statistics pages
│   ├── tournament/       # Tournament management
│   └── layout.tsx        # Root layout
├── components/           # React components
│   ├── auth/             # Authentication components
│   ├── data/             # Data visualization components
│   ├── home/             # Homepage components
│   ├── layout/           # Layout components
│   ├── live/             # Live match components
│   ├── profile/          # Profile components
│   ├── theme/            # Theme components
│   ├── tournament/       # Tournament components
│   └── ui/               # UI components (shadcn/ui)
├── lib/                  # Utility functions and services
├── public/               # Static assets
│   └── images/           # Image assets
│       ├── logos/        # App logos
│       ├── team-logos/   # Premier League team logos
│       └── icons/        # Icons including favicon
└── types/                # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js 22
- npm
- PostgreSQL 15+ for auth/migration work
- Running GraphQL and Data services for full local functionality

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/tonglam/letletme-web.git
   cd letletme-web
   ```

2. Install dependencies

   ```bash
   npm ci
   ```

3. Configure and migrate

   ```bash
   cp .env.example .env.local
   npm run db:migrate
   npm run db:migrate:status
   ```

4. Run the development server

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Build and Deployment

```bash
# Build for production
npm run build

# Repository verification
npm test
npm run lint
npx tsc --noEmit
npm audit --audit-level=moderate

# Start production server
npm run start
```

## Development Guidelines

- Follow TypeScript best practices and avoid using `any` type
- Use the component structure under `documentation/` for reference
- Follow these principles:
  - DRY (Don't Repeat Yourself)
  - Single Responsibility
  - Separation of Concerns
  - Clear Dependencies

## License

See the [LICENSE](LICENSE) file for details.
