# Workspace

## Overview

pnpm workspace monorepo migrated to standard npm workspaces. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: npm workspaces
- **Node.js version**: 20+ (supports modern ESModules)
- **Package manager**: npm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Key Commands

- `npm run typecheck` — full typecheck across all packages
- `npm run build` — typecheck + build all packages
- `npm run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `npm run db:push` — push DB schema changes to PostgreSQL database
- `npm run dev:server` — run the Express API server locally
- `npm run dev:client` — run the React Frontend Dashboard locally
- `npm run dev:sandbox` — run the mockup sandbox development environment

