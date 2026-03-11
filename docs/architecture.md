# Manifold Three POC Architecture

## Overview
This proof-of-concept is a monorepo with a Next.js operator console and a TypeScript API. The API contains an orchestrator kernel heartbeat that evaluates run state and advances work through shell transitions, skill execution, review, and packaging.

## Monorepo layout
- `apps/web`: Next.js operator console (`/runs` and `/run/[id]`).
- `apps/api`: Express API implementing heartbeat orchestrator and operator controls.
- `packages/contracts`: shared typed models for runs, steps, branches, artifacts, events, manual interventions, action enums, and shell names.
- `packages/skills`: typed skill executors that generate artifacts.
- `packages/prompts`: planner and shell prompt templates.
- `database`: Supabase Postgres schema + seed SQL.

## Orchestrator kernel
Heartbeat flow:
1. Load run snapshot.
2. Ask planner for next legal action (`codex_planner_used` event).
3. Validate action.
4. Dispatch skill or shell transition.
5. Record artifacts/events.
6. Return advanced state.

## Shells
- `Strategist`: brief parsing, strategy routes, message hierarchy.
- `Maker`: long-form asset drafting.
- `Reviewer`: quality and risk review.
- `Operator`: packaging and manual control.

Shell transitions emit `shell_switched` events.

## Codex runtime participation
- Planner role: every heartbeat logs `codex_planner_used`.
- Shell support role: Strategist/Reviewer skill execution logs `codex_shell_assist`.

## Evaluation checks
The run page displays:
- Artifact schema validity (`schemaValid` flag).
- Required artifacts produced (count check).
- Review score presence (`ReviewReport`).

## Deploy
- API deploy target: Vercel serverless function or Node service.
- Web deploy target: Vercel Next.js app.
- Database: Supabase Postgres using SQL files in `database/`.
- Secrets: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_URL`.
