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
  isExample?: boolean;
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

type PlanCandidate = {
  action: PlannerAction["action"];
  label: string;
  reason: string;
};

type PlannerView = {
  goal: string;
  complete: string[];
  missing: string[];
  candidates: PlanCandidate[];
  selected: { label: string; reason: string };
};

type Snapshot = {
  run: Run;
  steps: Step[];
  branches: Branch[];
  artifacts: Artifact[];
  events: Event[];
  planner: PlannerView;
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

const skillOrder: SkillName[] = [
  "parse_brief",
  "generate_strategy_routes",
  "build_message_hierarchy",
  "draft_long_form_asset",
  "review_for_quality_and_risk",
  "package_workspace_outputs"
];

const skillLabel: Record<SkillName, string> = {
  parse_brief: "Brief summary",
  generate_strategy_routes: "Strategy routes",
  build_message_hierarchy: "Message hierarchy",
  draft_long_form_asset: "Draft asset",
  review_for_quality_and_risk: "Review report",
  package_workspace_outputs: "Final package"
};

const actionLabel = (action: PlannerAction): string => {
  if (action.action === "create_branch") return "Create an initial strategic route";
  if (action.action === "switch_shell" && action.shell) return `Switch to the ${action.shell} shell`;
  if (action.action === "execute_skill" && action.skillName) return `Generate ${skillLabel[action.skillName].toLowerCase()}`;
  if (action.action === "review_artifact") return "Run quality and risk review";
  if (action.action === "package_outputs") return "Assemble the final output package";
  return "Complete the run";
};

const logEvent = (runId: string, type: Event["type"], message: string, shell?: ShellName, metadata?: Record<string, unknown>) => {
  db.events.push({ id: crypto.randomUUID(), runId, type, message, shell, metadata, createdAt: new Date().toISOString() });
};

const parseBrief = (brief: string) => {
  const text = brief.trim();
  const lowered = text.toLowerCase();

  const objective =
    /(objective|goal|need to|we need to)\s*[:\-]?\s*([^\.]+)/i.exec(text)?.[2]?.trim() ??
    "Create campaign messaging package from the submitted brief.";

  const audience =
    /(target(?:ing)?|audience)\s*[:\-]?\s*([^\.]+)/i.exec(text)?.[2]?.trim() ?? "Mid-sized consumer brand marketing teams";

  const offerOrProduct =
    /(product|platform|offer)\s*[:\-]?\s*([^\.]+)/i.exec(text)?.[2]?.trim() ?? "AI-powered marketing operations platform";

  const channels = ["website", "linkedin", "email", "paid social", "webinar", "sales deck"].filter((c) => lowered.includes(c));

  const requestedOutputs = [
    { token: "positioning", label: "Positioning route" },
    { token: "message hierarchy", label: "Message hierarchy" },
    { token: "homepage", label: "Homepage copy draft" },
    { token: "landing page", label: "Landing page draft" },
    { token: "review", label: "Review notes" }
  ]
    .filter((item) => lowered.includes(item.token))
    .map((item) => item.label);

  const tone =
    /(tone|voice)\s*(should be|is)?\s*[:\-]?\s*([^\.]+)/i.exec(text)?.[3]?.trim() ?? "Clear, modern, and credible";

  const constraintsMatches = text.match(/(priority|must|constraint|constraints|deadline|budget)[^\.]*\.?/gi) ?? [];

  return {
    objective,
    audience,
    offerOrProduct,
    requestedOutputs: requestedOutputs.length > 0 ? requestedOutputs : ["Positioning route", "Message hierarchy", "Draft asset", "Review notes"],
    channels: channels.length > 0 ? channels.map((c) => c[0].toUpperCase() + c.slice(1)) : ["Website", "LinkedIn"],
    tone,
    constraints: constraintsMatches.length > 0 ? constraintsMatches.map((item) => item.trim()) : ["Keep claims specific and credible"]
  };
};

const createArtifact = (runId: string, type: ArtifactType, payload: unknown): Artifact => ({
  id: crypto.randomUUID(),
  runId,
  type,
  payload,
  schemaValid: true,
  createdAt: new Date().toISOString()
});

const skillExecutors: Record<SkillName, (runId: string, input: Record<string, unknown>) => Artifact> = {
  parse_brief: (runId, input) => {
    const brief = String(input.brief ?? "");
    const parsed = parseBrief(brief);
    return createArtifact(runId, "Brief", {
      summary: `${parsed.objective} for ${parsed.audience}.`,
      objective: parsed.objective,
      audience: parsed.audience,
      offerOrProduct: parsed.offerOrProduct,
      requestedOutputs: parsed.requestedOutputs,
      channels: parsed.channels,
      tone: parsed.tone,
      constraints: parsed.constraints
    });
  },

  generate_strategy_routes: (runId, input) => {
    const parsed = parseBrief(String(input.brief ?? ""));
    return createArtifact(runId, "StrategyOptionSet", {
      routes: [
        {
          name: "Operational confidence",
          strategicIdea: `Position ${parsed.offerOrProduct} as the fastest way to ship campaigns with fewer mistakes and clearer ownership.`,
          whyItFits: `Fits ${parsed.audience} because they need execution certainty and cross-functional visibility.`,
          tradeoffOrRisk: "Can sound process-heavy unless tied to growth outcomes."
        },
        {
          name: "Revenue momentum",
          strategicIdea: `Frame the platform as the growth engine that turns strategy into channel-ready assets quickly.`,
          whyItFits: `Supports the objective: ${parsed.objective}.`,
          tradeoffOrRisk: "May feel over-promissory if proof points are thin."
        },
        {
          name: "Control with creativity",
          strategicIdea: "Show that teams can move fast creatively while keeping clear governance and review quality.",
          whyItFits: `Balances ${parsed.tone.toLowerCase()} tone with practical decision confidence.`,
          tradeoffOrRisk: "Needs concrete examples to avoid sounding like generic platform messaging."
        }
      ]
    });
  },

  build_message_hierarchy: (runId, input) => {
    const parsed = parseBrief(String(input.brief ?? ""));
    return createArtifact(runId, "MessageHierarchy", {
      masterMessage: `${parsed.offerOrProduct} helps ${parsed.audience} launch stronger campaigns with speed, clarity, and control.`,
      supportingPillars: [
        {
          title: "Align quickly",
          message: "Turn a brief into a clear plan so teams know what to do next.",
          proofPoints: ["Shared planner view", "Visible shell ownership", "Traceable decisions"]
        },
        {
          title: "Ship quality faster",
          message: "Generate channel-ready drafts and iterate with review signals built in.",
          proofPoints: ["Draft generation workflow", "Quality/risk review", "Structured output package"]
        },
        {
          title: "Stay in control",
          message: "Operators can pause, reroute, and inspect every step.",
          proofPoints: ["Manual controls", "Event history", "Clear completion signals"]
        }
      ],
      ctaIdeas: ["Start your first orchestrated campaign", "See how your team can launch faster", "Get a guided campaign output in one run"]
    });
  },

  draft_long_form_asset: (runId, input) => {
    const parsed = parseBrief(String(input.brief ?? ""));
    return createArtifact(runId, "DraftAsset", {
      type: "Homepage section draft",
      hero: {
        headline: `Launch better campaigns with ${parsed.offerOrProduct}`,
        subhead: `Built for ${parsed.audience} who need faster execution without losing message quality.`,
        cta: "See the orchestration demo"
      },
      sections: [
        {
          heading: "From brief to channel-ready output",
          copy: `Start with your objective, channels (${parsed.channels.join(", ")}), and constraints. The orchestrator plans each next step and generates readable outputs.`
        },
        {
          heading: "Strategy and messaging you can review",
          copy: "Get distinct strategic routes, a messaging ladder, and draft copy before final packaging."
        },
        {
          heading: "Operator control at every stage",
          copy: "Pause, resume, or force shell transitions while keeping a full event trail and rationale."
        }
      ]
    });
  },

  review_for_quality_and_risk: (runId, input) => {
    const parsed = parseBrief(String(input.brief ?? ""));
    return createArtifact(runId, "ReviewReport", {
      overallScore: 8.6,
      strengths: [
        "Clear objective-to-message alignment",
        "Distinct strategy routes with explicit tradeoffs",
        "Draft copy is structured for website and social adaptation"
      ],
      issuesOrRisks: [
        "Needs one concrete customer proof point",
        `Ensure tone stays ${parsed.tone.toLowerCase()} across all channels`,
        "Add one quantified outcome claim only if evidence is available"
      ],
      recommendation: "Proceed with the operational confidence route and polish proof-heavy sections.",
      suggestedRevisionFocus: "Tighten hero proof, add one testimonial block, and align CTA language between website and LinkedIn."
    });
  },

  package_workspace_outputs: (runId, input) => {
    const parsed = parseBrief(String(input.brief ?? ""));
    return createArtifact(runId, "WorkspacePackage", {
      packageSummary: `Marketing package prepared for ${parsed.audience} around ${parsed.offerOrProduct}.`,
      outputsProduced: [
        "Brief summary with extracted objective/audience/channels",
        "Three strategic route options",
        "Message hierarchy with proof points and CTAs",
        "Homepage section draft",
        "Quality and risk review"
      ],
      recommendedRoute: "Operational confidence",
      handoffChecklist: [
        "Confirm selected route with stakeholders",
        "Adapt draft for LinkedIn post sequence",
        "Collect one customer proof quote before publish"
      ]
    });
  }
};

const getSnapshotBase = (runId: string) => {
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

const missingFromArtifacts = (artifacts: Artifact[]) =>
  skillOrder
    .filter((skill) => !artifacts.some((a) => a.type === ({
      parse_brief: "Brief",
      generate_strategy_routes: "StrategyOptionSet",
      build_message_hierarchy: "MessageHierarchy",
      draft_long_form_asset: "DraftAsset",
      review_for_quality_and_risk: "ReviewReport",
      package_workspace_outputs: "WorkspacePackage"
    } as Record<SkillName, ArtifactType>)[skill]))
    .map((skill) => skillLabel[skill]);

const planner = (snapshot: ReturnType<typeof getSnapshotBase>) => {
  logEvent(snapshot.run.id, "codex_planner_used", "Planner used Codex to choose the next action", snapshot.run.currentShell);

  const completed = snapshot.steps.filter((s) => s.status === "completed").length;
  const candidateActions: PlannerAction[] = [];

  if (completed === 0 && snapshot.branches.length === 0) {
    candidateActions.push(
      { action: "create_branch", reason: "No route context exists yet.", branchName: "branch_a" },
      { action: "switch_shell", reason: "Strategist can begin brief interpretation.", shell: "Strategist" }
    );
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

    candidateActions.push(
      { action: "execute_skill", reason: `Next planned output is ${skillLabel[skillName].toLowerCase()}.`, skillName },
      { action: "switch_shell", reason: `Need ${shellMap[skillName]} shell for ${skillLabel[skillName].toLowerCase()}.`, shell: shellMap[skillName] }
    );

    if (snapshot.run.currentShell === shellMap[skillName]) {
      candidateActions.unshift({ action: "execute_skill", reason: "Current shell is ready to produce the next output.", skillName });
    }
  }

  if (!snapshot.artifacts.some((a) => a.type === "ReviewReport")) {
    candidateActions.push({ action: "review_artifact", reason: "Need quality/risk review before final package." });
  }

  if (!snapshot.artifacts.some((a) => a.type === "WorkspacePackage")) {
    candidateActions.push({ action: "package_outputs", reason: "Need a final output package for handoff." });
  }

  candidateActions.push({ action: "complete_run", reason: "All required outputs exist and quality gate passed." });

  let selected: PlannerAction = candidateActions[0];

  if (completed === 0 && snapshot.branches.length === 0) {
    selected = { action: "create_branch", reason: "The run needs an initial strategic path before execution.", branchName: "branch_a" };
  } else if (completed < skillOrder.length - 1) {
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
      selected = {
        action: "switch_shell",
        reason: `${skillLabel[skillName]} is next, so switching to ${shellMap[skillName]} first.`,
        shell: shellMap[skillName]
      };
    } else {
      selected = {
        action: "execute_skill",
        reason: `The brief has enough detail to produce ${skillLabel[skillName].toLowerCase()}.`,
        skillName
      };
    }
  } else if (!snapshot.artifacts.some((a) => a.type === "ReviewReport")) {
    selected = { action: "review_artifact", reason: "Need a quality and risk check before packaging outputs." };
  } else if (!snapshot.artifacts.some((a) => a.type === "WorkspacePackage")) {
    selected = { action: "package_outputs", reason: "All interim outputs exist; package them for final handoff." };
  } else {
    selected = { action: "complete_run", reason: "All required artifacts produced and reviewed." };
  }

  const plan: PlannerView = {
    goal: "Create campaign messaging package from the submitted brief.",
    complete: snapshot.artifacts.map((artifact) =>
      ({
        Brief: "Brief parsed",
        StrategyOptionSet: "Strategy routes generated",
        MessageHierarchy: "Message hierarchy created",
        DraftAsset: "Draft asset written",
        ReviewReport: "Review report completed",
        WorkspacePackage: "Final package assembled"
      } as Record<ArtifactType, string>)[artifact.type]
    ),
    missing: missingFromArtifacts(snapshot.artifacts),
    candidates: candidateActions.slice(0, 4).map((candidate) => ({
      action: candidate.action,
      label: actionLabel(candidate),
      reason: candidate.reason
    })),
    selected: {
      label: actionLabel(selected),
      reason: selected.reason
    }
  };

  return { action: selected, plan };
};

const getSnapshot = (runId: string): Snapshot => {
  const base = getSnapshotBase(runId);
  const { plan } = planner(base);
  return { ...base, planner: plan };
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
    {
      title: "Example run: AI platform launch messaging",
      brief: "Create campaign messaging for a new AI-powered marketing operations platform targeting mid-sized consumer brands. Need positioning routes, message hierarchy, homepage draft, and review notes. Channels: website + LinkedIn."
    },
    {
      title: "Example run: retention push",
      brief: "Build a retention campaign concept for trial users at risk of churn. Include message ladder, email direction, and review guidance. Tone should be practical and reassuring."
    }
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
      updatedAt: now,
      isExample: true
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
    title: title ?? "Marketing brief run",
    brief: brief ?? "",
    status: "running",
    currentShell: "Operator",
    currentStep: 0,
    createdAt: now,
    updatedAt: now,
    isExample: false
  };
  db.runs.unshift(run);
  logEvent(run.id, "run_created", "Run created by operator", "Operator");
  return run;
};

export const fetchSnapshot = (runId: string) => {
  seed();
  const base = getSnapshotBase(runId);
  const { plan } = planner(base);
  return { ...base, planner: plan };
};

export const heartbeat = (runId: string) => {
  seed();
  const snapshot = getSnapshotBase(runId);
  logEvent(runId, "heartbeat_tick", "Heartbeat evaluated current state", snapshot.run.currentShell);
  const { action } = planner(snapshot);

  if (action.action === "create_branch" && action.branchName) {
    db.branches.push({
      id: crypto.randomUUID(),
      runId,
      name: action.branchName,
      selected: true,
      createdAt: new Date().toISOString()
    });
    logEvent(runId, "branch_created", `Created ${action.branchName}`, snapshot.run.currentShell);
    return fetchSnapshot(runId);
  }

  if (action.action === "switch_shell" && action.shell) {
    snapshot.run.currentShell = action.shell;
    snapshot.run.updatedAt = new Date().toISOString();
    logEvent(runId, "shell_switched", `Switched shell to ${action.shell}`, action.shell);
    return fetchSnapshot(runId);
  }

  if (action.action === "execute_skill" && action.skillName) {
    const step = ensureStep(snapshot.run, action.skillName);
    step.status = "running";
    step.startedAt = new Date().toISOString();
    if (snapshot.run.currentShell === "Strategist") {
      logEvent(runId, "codex_shell_assist", "Strategist used Codex to propose route and message options", snapshot.run.currentShell, {
        skill: action.skillName
      });
    }
    if (snapshot.run.currentShell === "Reviewer") {
      logEvent(runId, "codex_shell_assist", "Reviewer used Codex to critique the draft and identify risks", snapshot.run.currentShell, {
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
    return fetchSnapshot(runId);
  }

  if (action.action === "review_artifact") {
    const artifact = skillExecutors.review_for_quality_and_risk(runId, { brief: snapshot.run.brief });
    db.artifacts.push(artifact);
    logEvent(runId, "review_completed", "Reviewer completed quality and risk assessment", "Reviewer");
    return fetchSnapshot(runId);
  }

  if (action.action === "package_outputs") {
    const artifact = skillExecutors.package_workspace_outputs(runId, { brief: snapshot.run.brief });
    db.artifacts.push(artifact);
    logEvent(runId, "outputs_packaged", "Operator packaged workspace outputs", "Operator");
    return fetchSnapshot(runId);
  }

  if (action.action === "complete_run") {
    snapshot.run.status = "completed";
    snapshot.run.updatedAt = new Date().toISOString();
    return fetchSnapshot(runId);
  }

  return fetchSnapshot(runId);
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

  return fetchSnapshot(run.id);
};
