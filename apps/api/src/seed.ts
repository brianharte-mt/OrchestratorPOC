import { Run } from "@manifold/contracts";
import { db } from "./store";

export const seed = () => {
  if (db.runs.length > 0) return;
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
};
