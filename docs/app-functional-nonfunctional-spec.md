# OrchestratorPOC — Functional & Non-Functional Specification

## 1) Purpose and Scope

OrchestratorPOC is a workflow orchestration demonstration that simulates multi-shell AI-assisted execution for marketing-style work.

It provides:

- A web console for operators to create and monitor runs.
- A deterministic heartbeat-driven orchestrator that decides what action to execute next.
- Skill executors that emit typed artifacts representing work products.
- Traceability through run events, branch history, and artifact outputs.

This document describes both **functional** and **non-functional** behavior as currently implemented.

---

## 2) System Context

### 2.1 Main Components

1. **Next.js Web App (`apps/web`)**
   - Renders operator UI (`/runs`, `/run/[id]`).
   - Hosts app-router API endpoints under `/api/*`.

2. **In-memory Runtime (`apps/web/app/api/_lib/runtime.ts`)**
   - Stores all run state in process memory.
   - Seeds demo runs.
   - Implements planning, step execution, heartbeat progression, and operator controls.

3. **API Route Handlers (`apps/web/app/api/**`)**
   - Expose runtime operations over HTTP JSON.

4. **Domain Contracts (`packages/contracts`)**
   - Define canonical domain entities and event/action vocabularies.

5. **Skill Implementations (`packages/skills`)**
   - Provide synthetic artifact generation used by the orchestrator model.

> Note: There is also a legacy standalone Express API in `apps/api`; the deployed web app behavior is currently represented by the Next route handlers and in-web runtime.

---

## 3) Functional Specification

## 3.1 Core Domain Model

### Run
A run is a top-level execution container with:
- identity (`id`), metadata (`title`, `brief`),
- lifecycle status (`pending|running|paused|completed|failed`),
- current shell (`Strategist|Maker|Reviewer|Operator`),
- timestamps (`createdAt`, `updatedAt`).

### Step
A step represents execution of one skill in sequence:
- `skillName`, `orderIndex`,
- status (`queued|running|completed|failed`),
- shell ownership and start/finish times.

### Branch
A branch captures strategy routing and winning/losing selection:
- `name` (`branch_a|branch_b`),
- `selected` flag.

### Artifact
Artifacts are skill outputs:
- typed by `ArtifactType` (`Brief`, `StrategyOptionSet`, `MessageHierarchy`, `DraftAsset`, `ReviewReport`, `WorkspacePackage`),
- carry JSON payloads,
- have schema validity indicator (`schemaValid`).

### Event
Events provide chronological traceability for orchestration and interventions.

### Manual Intervention
Operator-issued controls with action and payload auditing.

---

## 3.2 User-Facing UI Behavior

## `/runs` page behavior

1. On load, the client fetches `GET /api/runs` (or external base if `NEXT_PUBLIC_API_URL` is set).
2. Displays a run creation card with editable brief text.
3. Displays one card per run including:
   - title,
   - brief,
   - status,
   - current shell,
   - deep-link to `/run/{id}`.
4. Clicking **Create run** issues `POST /api/runs` then refreshes list.

## `/run/[id]` page behavior

1. On load, fetches `GET /api/run/{id}` and renders run snapshot.
2. Shows run status and current shell summary.
3. Supports operator actions:
   - **Heartbeat** → `POST /api/run/{id}/heartbeat`
   - **Pause** / **Resume** / **Retry step** / **Force shell: Reviewer** → `POST /api/run/{id}/control`
4. Renders snapshot sections:
   - artifacts and readiness checks,
   - branch history,
   - codex-participation events,
   - full event stream.

---

## 3.3 API Functional Behavior

## `GET /api/runs`
Returns all runs from in-memory DB; triggers seed on first access.

## `POST /api/runs`
Creates a new run:
- `title` defaults to `Ad-hoc run`.
- `brief` defaults to empty string.
- status initialized to `running`, shell to `Operator`.
- emits a `run_created` event.
- returns `201` with run JSON.

## `GET /api/run/{id}`
Returns full snapshot:
- run,
- ordered steps,
- branches,
- artifacts,
- events.
If run is missing, returns `404` with `{ error: "Run not found" }`.

## `POST /api/run/{id}/heartbeat`
Executes one planner/orchestrator tick and returns updated snapshot.
On runtime error, returns `400` with error message.

## `POST /api/run/{id}/control`
Applies manual control action and returns updated snapshot.
If run missing or operation fails, returns `404` with error payload.

---

## 3.4 Orchestration & Planning Semantics

The orchestrator is **single-step per heartbeat** and deterministic against current snapshot state.

### Heartbeat sequence
For each heartbeat tick:
1. Log `heartbeat_tick` event.
2. Invoke planner to obtain next legal action and log `codex_planner_used`.
3. Execute one action branch:
   - `create_branch`
   - `switch_shell`
   - `execute_skill`
   - `review_artifact`
   - `package_outputs`
   - `complete_run`
4. Return latest snapshot.

### Planner decision policy

1. If no completed steps and no branches → create `branch_a`.
2. Else, while the main skill pipeline is incomplete:
   - determine next skill by count of completed steps,
   - enforce required shell for that skill,
   - switch shell if needed, otherwise execute skill.
3. After skill pipeline completion:
   - if no `ReviewReport`, request `review_artifact`.
   - else if no `WorkspacePackage`, request `package_outputs`.
   - else mark run as `completed`.

### Skill order (authoritative pipeline)
1. `parse_brief`
2. `generate_strategy_routes`
3. `build_message_hierarchy`
4. `draft_long_form_asset`
5. `review_for_quality_and_risk`
6. `package_workspace_outputs`

### Shell mapping by skill
- Strategist: `parse_brief`, `generate_strategy_routes`, `build_message_hierarchy`
- Maker: `draft_long_form_asset`
- Reviewer: `review_for_quality_and_risk`
- Operator: `package_workspace_outputs`

### Step lifecycle behavior
- A step is created lazily when skill execution is requested.
- Status transitions `queued -> running -> completed` occur within one heartbeat for successful execution.
- `retry_step` only re-queues the first step in `failed` state (if present).

---

## 3.5 Skills — Complete Functional Coverage

This section documents each skill’s output contract as currently implemented.

## `parse_brief`
**Input:** `{ brief: string }`  
**Output Artifact:** `Brief`
```json
{
  "summary": "First sentence of brief",
  "audience": "B2B SaaS buyers",
  "objective": "Drive trial signups"
}
```
Behavior notes:
- Summary is derived via split on `.` and selecting first segment.

## `generate_strategy_routes`
**Input:** ignored in implementation  
**Output Artifact:** `StrategyOptionSet`
```json
{
  "routes": [
    { "id": "route-1", "title": "Fear of missing out", "promise": "Avoid hidden churn risk" },
    { "id": "route-2", "title": "Operator confidence", "promise": "Know status at every step" }
  ]
}
```

## `build_message_hierarchy`
**Output Artifact:** `MessageHierarchy`
```json
{
  "core": "Launch faster with orchestrated AI execution",
  "pillars": ["Reliability", "Control", "Auditability"],
  "proof": ["Shell transitions", "Codex participation events", "Review score"]
}
```

## `draft_long_form_asset`
**Output Artifact:** `DraftAsset`
```json
{
  "headline": "The Operator's Console for AI Workflows",
  "body": "Manifold Three coordinates shells, skills, and heartbeat planning to ship marketing outputs with full traceability."
}
```

## `review_for_quality_and_risk`
**Output Artifact:** `ReviewReport`
```json
{
  "score": 8.7,
  "quality": "Strong",
  "risks": ["Needs customer quote", "Add compliance disclaimer"]
}
```

## `package_workspace_outputs`
**Output Artifact:** `WorkspacePackage`
```json
{
  "files": ["brief.json", "strategy.json", "hierarchy.json", "draft.md", "review.json"],
  "archive": "workspace-{runId}.zip"
}
```

### Artifact metadata behavior (all skills)
All skill artifacts are emitted with:
- generated UUID `id`,
- `runId`,
- `schemaValid: true`,
- creation timestamp.

When skill execution is tied to an orchestrator step, `stepId` is attached.

---

## 3.6 Operator Controls

### `pause`
Sets run status to `paused`.

### `resume`
Sets run status to `running`.

### `force_shell`
Sets run shell to supplied shell value (used by UI for `Reviewer`).

### `retry_step`
Finds first failed step in run and sets it back to `queued`.

### Control audit trail
Every control action:
- appends a `ManualIntervention` record,
- emits `operator_control` event,
- updates run `updatedAt` timestamp.

---

## 4) Non-Functional Specification

## 4.1 Performance Characteristics

- Data access is in-memory array filtering/sorting; expected low latency for small demo datasets.
- Complexity grows linearly with number of records due to repeated scans (`find`, `filter`).
- No pagination or query optimization currently implemented.

## 4.2 Scalability

- Runtime state is process-local memory; no shared persistence.
- Horizontal scaling creates isolated state per instance.
- Serverless cold starts or instance recycling reset state to seed defaults.
- Not suitable for multi-instance consistency requirements without external storage.

## 4.3 Reliability & Durability

- No durable storage layer; all data is ephemeral.
- No transaction semantics; concurrent writes rely on single process event loop behavior.
- Error handling exists at route boundaries with JSON error responses.

## 4.4 Security Posture

- No authentication/authorization on API routes.
- No tenant isolation.
- CORS concerns are minimal for same-origin app router usage, but external API override can introduce cross-origin considerations.
- No explicit input schema validation; request bodies are cast/assumed.

## 4.5 Observability & Auditability

- Rich domain event stream provides business-level traceability per run.
- No integrated metrics, structured logging sink, tracing, or alerting.
- Console-level observability is primarily through rendered event stream.

## 4.6 Availability & Operational Constraints

- Availability depends on Next runtime instance health.
- In-memory design implies recovery == state reset, not state restoration.
- Suitable for proof-of-concept demos and low-risk environments.

## 4.7 Maintainability

- Domain concepts are explicit and strongly typed in contracts/runtime.
- Orchestration logic is centralized and easy to reason about.
- Current runtime duplicates concepts present in `apps/api`; risk of divergence if both paths evolve independently.

## 4.8 Portability & Deployment

- Next.js app router endpoints are compatible with Vercel serverless model.
- Legacy standalone Express app (`apps/api`) remains viable for non-serverless deployments but is not required for current web path.

---

## 5) Known Gaps / Risks

1. **No persistence** (state loss on restart/cold start).
2. **No auth** (all API operations publicly callable).
3. **No request validation** (type casts instead of runtime validation).
4. **No idempotency controls** for repeated button clicks/retries.
5. **No rate limiting** or abuse protections.
6. **No production-grade logging/metrics**.
7. **Dual runtime sources** (`apps/api` and `apps/web/api/_lib`) may drift.

---

## 6) Acceptance Checklist (Current Behavior)

- [x] Runs page lists seeded runs.
- [x] Create run adds run and displays it.
- [x] Run details show status, shell, artifacts, branches, and events.
- [x] Heartbeat advances workflow according to planner policy.
- [x] Manual controls mutate run state and append audit events.
- [x] Artifact readiness checks display in UI.
- [x] Codex-related events appear in event sections when applicable.

---

## 7) Suggested Evolution Path

1. Replace in-memory DB with durable store (Postgres/Redis) and repository abstraction.
2. Add schema validation (e.g., Zod) for all request bodies.
3. Add authn/authz for operator APIs.
4. Add idempotency keys and optimistic concurrency for controls.
5. Add metrics + structured logs + traces.
6. Consolidate orchestration implementation to a single shared runtime package.

