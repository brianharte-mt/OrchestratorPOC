type RunStatus = "pending" | "running" | "paused" | "completed" | "failed";
type ShellName = "Strategist" | "Maker" | "Reviewer" | "Operator";
type SkillName =
  | "parse_brief"
  | "generate_strategy_routes"
  | "build_message_hierarchy"
  | "draft_long_form_asset"
  | "review_for_quality_and_risk"
  | "package_workspace_outputs";
type ArtifactType =
  | "Brief"
  | "StrategyOptionSet"
  | "MessageHierarchy"
  | "DraftAsset"
  | "ReviewReport"
  | "WorkspacePackage";

type Run = {
  id: string;
  title: string;
  brief: string;
  status: RunStatus;
  currentShell: ShellName;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
};

type Step = {
  id: string;
  runId: string;
  orderIndex: number;
  skillName: SkillName;
  status: "queued" | "running" | "completed" | "failed";
  shell: ShellName;
  startedAt?: string;
  finishedAt?: string;
};

type Branch = {
  id: string;
  runId: string;
  name: "branch_a" | "branch_b";
  selected: boolean;
  createdAt: string;
};

type Artifact = {
  id: string;
  runId: string;
  branchId?: string;
  stepId?: string;
  type: ArtifactType;
  payload: unknown;
  schemaValid: boolean;
  createdAt: string;
};

type Event = {
  id: string;
  runId: string;
  type:
    | "run_created"
    | "heartbeat_tick"
    | "shell_switched"
    | "skill_executed"
    | "branch_created"
    | "artifact_created"
    | "review_completed"
    | "outputs_packaged"
    | "codex_planner_used"
    | "codex_shell_assist"
    | "operator_control";
  shell?: ShellName;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type ManualIntervention = {
  id: string;
  runId: string;
  action: "pause" | "resume" | "retry_step" | "force_shell";
  payload?: Record<string, unknown>;
  createdAt: string;
};

type PlannerAction = {
  action: "create_branch" | "execute_skill" | "switch_shell" | "review_artifact" | "package_outputs" | "complete_run";
  reason: string;
  shell?: ShellName;
  skillName?: SkillName;
  branchName?: "branch_a" | "branch_b";
};

type Snapshot = {
  run: Run;
  steps: Step[];
  branches: Branch[];
  artifacts: Artifact[];
  events: Event[];
};

type RuntimeDb = {
  runs: Run[];
  steps: Step[];
  branches: Branch[];
  artifacts: Artifact[];
  events: Event[];
  interventions: ManualIntervention[];
  initialized: boolean;
};

const globalWithDb = globalThis as typeof globalThis & { __manifoldDb?: RuntimeDb };

const db: RuntimeDb =
  globalWithDb.__manifoldDb ??
  (globalWithDb.__manifoldDb = {
    runs: [],
    steps: [],
    branches: [],
    artifacts: [],
    events: [],
    interventions: [],
    initialized: false
  });

const createArtifact = (runId: string, type: ArtifactType, payload: unknown): Artifact => ({
  id: crypto.randomUUID(),
  runId,
  type,
  payload,
  schemaValid: true,
  createdAt: new Date().toISOString()
});

const skillExecutors: Record<SkillName, (runId: string, input: Record<string, unknown>) => Artifact> = {
  parse_brief: (runId, input) =>
    createArtifact(runId, "Brief", {
      summary: String(input.brief ?? "").split(".")[0],
      audience: "B2B SaaS buyers",
      objective: "Drive trial signups"
    }),
  generate_strategy_routes: (runId) =>
    createArtifact(runId, "StrategyOptionSet", {
      routes: [
        { id: "route-1", title: "Fear of missing out", promise: "Avoid hidden churn risk" },
        { id: "route-2", title: "Operator confidence", promise: "Know status at every step" }
      ]
    }),
  build_message_hierarchy: (runId) =>
    createArtifact(runId, "MessageHierarchy", {
      core: "Launch faster with orchestrated AI execution",
      pillars: ["Reliability", "Control", "Auditability"],
      proof: ["Shell transitions", "Codex participation events", "Review score"]
    }),
  draft_long_form_asset: (runId) =>
    createArtifact(runId, "DraftAsset", {
      headline: "The Operator's Console for AI Workflows",
      body: "Manifold Three coordinates shells, skills, and heartbeat planning to ship marketing outputs with full traceability."
    }),
  review_for_quality_and_risk: (runId) =>
    createArtifact(runId, "ReviewReport", {
      score: 8.7,
      quality: "Strong",
      risks: ["Needs customer quote", "Add compliance disclaimer"]
    }),
  package_workspace_outputs: (runId) =>
    createArtifact(runId, "WorkspacePackage", {
      files: ["brief.json", "strategy.json", "hierarchy.json", "draft.md", "review.json"],
      archive: `workspace-${runId}.zip`
    })
};

const getSnapshot = (runId: string): Snapshot => {
  const run = db.runs.find((r) => r.id === runId);
  if (!run) {
    throw new Error("Run not found");
  }
  return {
    run,
    steps: db.steps.filter((s) => s.runId === runId).sort((a, b) => a.orderIndex - b.orderIndex),
    branches: db.branches.filter((b) => b.runId === runId),
    artifacts: db.artifacts.filter((a) => a.runId === runId),
    events: db.events.filter((e) => e.runId === runId)
  };
};

const skillOrder: SkillName[] = [
  "parse_brief",
  "generate_strategy_routes",
  "build_message_hierarchy",
  "draft_long_form_asset",
  "review_for_quality_and_risk",
  "package_workspace_outputs"
];

const logEvent = (runId: string, type: Event["type"], message: string, shell?: ShellName, metadata?: Record<string, unknown>) => {
  db.events.push({ id: crypto.randomUUID(), runId, type, message, shell, metadata, createdAt: new Date().toISOString() });
};

const planner = (snapshot: Snapshot): PlannerAction => {
  logEvent(snapshot.run.id, "codex_planner_used", "Codex planner proposed next legal action", snapshot.run.currentShell);
  const completed = snapshot.steps.filter((s) => s.status === "completed").length;
  if (completed === 0 && snapshot.branches.length === 0) {
    return { action: "create_branch", reason: "Initialize branch strategy", branchName: "branch_a" };
  }

  if (completed < skillOrder.length - 1) {
    const skillName = skillOrder[completed];
    const shellMap: Record<SkillName, ShellName> = {
      parse_brief: "Strategist",
      generate_strategy_routes: "Strategist",
      build_message_hierarchy: "Strategist",
      draft_long_form_asset: "Maker",
      review_for_quality_and_risk: "Reviewer",
      package_workspace_outputs: "Operator"
    };

    if (snapshot.run.currentShell !== shellMap[skillName]) {
      return { action: "switch_shell", reason: "Skill requires different shell", shell: shellMap[skillName] };
    }

    return { action: "execute_skill", reason: "Execute next workflow skill", skillName };
  }

  if (!snapshot.artifacts.some((a) => a.type === "ReviewReport")) {
    return { action: "review_artifact", reason: "Need formal reviewer check" };
  }
  if (!snapshot.artifacts.some((a) => a.type === "WorkspacePackage")) {
    return { action: "package_outputs", reason: "Create delivery package" };
  }
  return { action: "complete_run", reason: "All required artifacts produced" };
};

const ensureStep = (run: Run, skillName: SkillName): Step => {
  const existing = db.steps.find((s) => s.runId === run.id && s.skillName === skillName);
  if (existing) return existing;
  const step: Step = {
    id: crypto.randomUUID(),
    runId: run.id,
    orderIndex: db.steps.filter((s) => s.runId === run.id).length + 1,
    skillName,
    status: "queued",
    shell: run.currentShell
  };
  db.steps.push(step);
  return step;
};

const seed = () => {
  if (db.initialized) return;

  const demos: Array<Pick<Run, "title" | "brief">> = [
    { title: "AI launch narrative", brief: "Launch an orchestrator POC for enterprise marketing leaders." },
    { title: "Retention campaign", brief: "Create a campaign to reduce trial churn in 30 days." },
    { title: "Product update", brief: "Announce new workflow governance features to existing customers." }
  ];

  demos.forEach((demo, i) => {
    const now = new Date().toISOString();
    db.runs.push({
      id: `run-${i + 1}`,
      title: demo.title,
      brief: demo.brief,
      status: "pending",
      currentShell: "Operator",
      currentStep: 0,
      createdAt: now,
      updatedAt: now
    });
  });

  db.initialized = true;
};

export const listRuns = () => {
  seed();
  return db.runs;
};

export const createRun = (title: string | undefined, brief: string | undefined) => {
  seed();
  const now = new Date().toISOString();
  const run: Run = {
    id: crypto.randomUUID(),
    title: title ?? "Ad-hoc run",
    brief: brief ?? "",
    status: "running",
    currentShell: "Operator",
    currentStep: 0,
    createdAt: now,
    updatedAt: now
  };
  db.runs.push(run);
  logEvent(run.id, "run_created", "Run created by operator", "Operator");
  return run;
};

export const fetchSnapshot = (runId: string) => {
  seed();
  return getSnapshot(runId);
};

export const heartbeat = (runId: string) => {
  seed();
  const snapshot = getSnapshot(runId);
  logEvent(runId, "heartbeat_tick", "Heartbeat evaluated current state", snapshot.run.currentShell);
  const action = planner(snapshot);

  if (action.action === "create_branch" && action.branchName) {
    db.branches.push({
      id: crypto.randomUUID(),
      runId,
      name: action.branchName,
      selected: true,
      createdAt: new Date().toISOString()
    });
    logEvent(runId, "branch_created", `Created ${action.branchName}`, snapshot.run.currentShell);
    return getSnapshot(runId);
  }

  if (action.action === "switch_shell" && action.shell) {
    snapshot.run.currentShell = action.shell;
    snapshot.run.updatedAt = new Date().toISOString();
    logEvent(runId, "shell_switched", `Switched shell to ${action.shell}`, action.shell);
    return getSnapshot(runId);
  }

  if (action.action === "execute_skill" && action.skillName) {
    const step = ensureStep(snapshot.run, action.skillName);
    step.status = "running";
    step.startedAt = new Date().toISOString();
    if (snapshot.run.currentShell === "Strategist" || snapshot.run.currentShell === "Reviewer") {
      logEvent(runId, "codex_shell_assist", `Codex assisted ${snapshot.run.currentShell} shell`, snapshot.run.currentShell, {
        skill: action.skillName
      });
    }
    const artifact = skillExecutors[action.skillName](runId, { brief: snapshot.run.brief });
    artifact.stepId = step.id;
    db.artifacts.push(artifact);
    step.status = "completed";
    step.finishedAt = new Date().toISOString();
    logEvent(runId, "skill_executed", `Executed skill ${action.skillName}`, snapshot.run.currentShell);
    logEvent(runId, "artifact_created", `Created artifact ${artifact.type}`, snapshot.run.currentShell);
    return getSnapshot(runId);
  }

  if (action.action === "review_artifact") {
    const artifact = skillExecutors.review_for_quality_and_risk(runId, {});
    db.artifacts.push(artifact);
    logEvent(runId, "review_completed", "Reviewer completed quality and risk assessment", "Reviewer");
    return getSnapshot(runId);
  }

  if (action.action === "package_outputs") {
    const artifact = skillExecutors.package_workspace_outputs(runId, {});
    db.artifacts.push(artifact);
    logEvent(runId, "outputs_packaged", "Operator packaged workspace outputs", "Operator");
    return getSnapshot(runId);
  }

  if (action.action === "complete_run") {
    snapshot.run.status = "completed";
    snapshot.run.updatedAt = new Date().toISOString();
    return getSnapshot(runId);
  }

  return getSnapshot(runId);
};

export const controlRun = (runId: string, action?: string, shell?: string) => {
  seed();
  const run = db.runs.find((item) => item.id === runId);
  if (!run) {
    throw new Error("Run not found");
  }

  if (action === "pause") run.status = "paused";
  if (action === "resume") run.status = "running";
  if (action === "force_shell" && shell) run.currentShell = shell as ShellName;
  if (action === "retry_step") {
    const failed = db.steps.find((s) => s.runId === run.id && s.status === "failed");
    if (failed) failed.status = "queued";
  }

  db.interventions.push({
    id: crypto.randomUUID(),
    runId: run.id,
    action: (action as ManualIntervention["action"]) ?? "pause",
    payload: { action, shell },
    createdAt: new Date().toISOString()
  });

  logEvent(run.id, "operator_control", `Operator action: ${action ?? "unknown"}`, "Operator", { action, shell });
  run.updatedAt = new Date().toISOString();

  return getSnapshot(run.id);
};
