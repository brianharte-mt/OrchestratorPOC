import { Artifact, ArtifactType, SkillName } from "@manifold/contracts";

const createArtifact = <T>(runId: string, type: ArtifactType, payload: T): Artifact<T> => ({
  id: crypto.randomUUID(),
  runId,
  type,
  payload,
  schemaValid: true,
  createdAt: new Date().toISOString()
});

export const skillExecutors: Record<SkillName, (runId: string, input: any) => Artifact> = {
  parse_brief: (runId, input: { brief: string }) =>
    createArtifact(runId, "Brief", {
      summary: input.brief.split(".")[0],
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
