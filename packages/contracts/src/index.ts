export type RunStatus = "pending" | "running" | "paused" | "completed" | "failed";

export type ShellName = "Strategist" | "Maker" | "Reviewer" | "Operator";

export type AllowedAction =
  | "create_branch"
  | "execute_skill"
  | "switch_shell"
  | "review_artifact"
  | "package_outputs"
  | "complete_run";

export type EventType =
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

export type ArtifactType =
  | "Brief"
  | "StrategyOptionSet"
  | "MessageHierarchy"
  | "DraftAsset"
  | "ReviewReport"
  | "WorkspacePackage";

export interface Run {
  id: string;
  title: string;
  brief: string;
  status: RunStatus;
  currentShell: ShellName;
  currentStep: number;
  branchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  runId: string;
  orderIndex: number;
  skillName: SkillName;
  status: "queued" | "running" | "completed" | "failed";
  shell: ShellName;
  startedAt?: string;
  finishedAt?: string;
}

export interface Branch {
  id: string;
  runId: string;
  name: "branch_a" | "branch_b";
  selected: boolean;
  rationale?: string;
  createdAt: string;
}

export interface Artifact<T = unknown> {
  id: string;
  runId: string;
  branchId?: string;
  stepId?: string;
  type: ArtifactType;
  payload: T;
  schemaValid: boolean;
  createdAt: string;
}

export interface Event {
  id: string;
  runId: string;
  type: EventType;
  shell?: ShellName;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ManualIntervention {
  id: string;
  runId: string;
  action: "pause" | "resume" | "retry_step" | "force_shell";
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type SkillName =
  | "parse_brief"
  | "generate_strategy_routes"
  | "build_message_hierarchy"
  | "draft_long_form_asset"
  | "review_for_quality_and_risk"
  | "package_workspace_outputs";

export interface PlannerAction {
  action: AllowedAction;
  reason: string;
  shell?: ShellName;
  skillName?: SkillName;
  branchName?: "branch_a" | "branch_b";
}

export interface RunSnapshot {
  run: Run;
  steps: Step[];
  branches: Branch[];
  artifacts: Artifact[];
  events: Event[];
}
