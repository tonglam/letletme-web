# LetLetMe Web

Front end of [letletme.top](https://letletme.top) - A Fantasy Premier League (FPL) analytics and tournament management platform.

## Overview

LetLetMe is a comprehensive web application for Fantasy Premier League enthusiasts. It provides tools for tracking player and team statistics, managing tournaments, viewing live match data, and more.

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

- **Home Dashboard**: View deadlines, price changes, head-to-head comparisons, and match information
- **Live Data**: Real-time updates during gameweeks
- **Player & Team Statistics**: Detailed performance analytics
- **Tournament Management**: Create and manage custom FPL tournaments
- **User Profiles**: Personalized user experience
- **Authentication**: Secure login and account management

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
