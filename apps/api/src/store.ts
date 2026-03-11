import { Artifact, Branch, Event, ManualIntervention, Run, RunSnapshot, Step } from "@manifold/contracts";

export const db: {
  runs: Run[];
  steps: Step[];
  branches: Branch[];
  artifacts: Artifact[];
  events: Event[];
  interventions: ManualIntervention[];
} = {
  runs: [],
  steps: [],
  branches: [],
  artifacts: [],
  events: [],
  interventions: []
};

export const getSnapshot = (runId: string): RunSnapshot => {
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
