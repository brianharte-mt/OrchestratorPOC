import { AllowedAction, Event, PlannerAction, Run, RunSnapshot, ShellName, SkillName, Step } from "@manifold/contracts";
import { skillExecutors } from "@manifold/skills";
import { db, getSnapshot } from "./store";

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

const planner = (snapshot: RunSnapshot): PlannerAction => {
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

const validateAction = (action: AllowedAction): boolean =>
  ["create_branch", "execute_skill", "switch_shell", "review_artifact", "package_outputs", "complete_run"].includes(action);

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

export const heartbeat = (runId: string) => {
  const snapshot = getSnapshot(runId);
  logEvent(runId, "heartbeat_tick", "Heartbeat evaluated current state", snapshot.run.currentShell);
  const action = planner(snapshot);
  if (!validateAction(action.action)) throw new Error("Invalid action");

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
