"use client";

import { useEffect, useMemo, useState } from "react";

type Planner = {
  goal: string;
  complete: string[];
  missing: string[];
  candidates: Array<{ action: string; label: string; reason: string }>;
  selected: { label: string; reason: string };
};

type Snapshot = {
  run: { id: string; status: string; currentShell: string; title: string };
  planner: Planner;
  events: Array<{ id: string; type: string; message: string; createdAt: string }>;
  artifacts: Array<{ id: string; type: string; schemaValid: boolean; payload: any }>;
  branches: Array<{ id: string; name: string; selected: boolean }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : `/api${path}`);

const humanEvent = (type: string, message: string) => {
  const labels: Record<string, string> = {
    codex_planner_used: "Planner used Codex to choose the next action",
    codex_shell_assist: "A shell used Codex to generate or critique work",
    heartbeat_tick: "Heartbeat checked current run state",
    shell_switched: "Shell changed",
    skill_executed: "Skill executed",
    branch_created: "Strategy branch created",
    artifact_created: "Artifact produced",
    review_completed: "Review completed",
    outputs_packaged: "Final package assembled",
    operator_control: "Operator control applied",
    run_created: "Run created"
  };
  return labels[type] ?? message;
};

export default function RunPage({ params }: { params: { id: string } }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [autoRun, setAutoRun] = useState(false);

  const load = async () => {
    const res = await fetch(apiUrl(`/run/${params.id}`));
    setSnapshot(await res.json());
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const heartbeat = async () => {
    const res = await fetch(apiUrl(`/run/${params.id}/heartbeat`), { method: "POST" });
    const next = await res.json();
    setSnapshot(next);
    return next as Snapshot;
  };

  useEffect(() => {
    if (!autoRun || !snapshot) return;
    if (snapshot.run.status === "completed" || snapshot.run.status === "paused" || snapshot.run.status === "failed") return;

    let cancelled = false;

    const run = async () => {
      let cycles = 0;
      let current = snapshot;
      while (!cancelled && autoRun && cycles < 14) {
        if (["completed", "paused", "failed"].includes(current.run.status)) break;
        current = await heartbeat();
        cycles += 1;
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [autoRun, snapshot?.run.status]);

  const control = async (action: string, shell?: string) => {
    const res = await fetch(apiUrl(`/run/${params.id}/control`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, shell })
    });
    setSnapshot(await res.json());
  };

  const grouped = useMemo(() => {
    if (!snapshot) return null;
    const byType = Object.groupBy(snapshot.artifacts, (artifact) => artifact.type);
    return {
      brief: byType.Brief?.[0],
      routes: byType.StrategyOptionSet?.[0],
      hierarchy: byType.MessageHierarchy?.[0],
      draft: byType.DraftAsset?.[0],
      review: byType.ReviewReport?.[0],
      pack: byType.WorkspacePackage?.[0]
    };
  }, [snapshot]);

  if (!snapshot) return <main>Loading...</main>;

  const codexEvents = snapshot.events.filter((e) => e.type.includes("codex"));

  return (
    <main>
      <h1>{snapshot.run.title}</h1>
      <div className="card row">
        <span>Status: {snapshot.run.status}</span>
        <span>Current shell: {snapshot.run.currentShell}</span>
      </div>

      <div className="card">
        <h3>Current plan</h3>
        <p><strong>Goal:</strong> {snapshot.planner.goal}</p>
        <div className="columns">
          <div>
            <h4>What&apos;s complete</h4>
            <ul>{snapshot.planner.complete.length > 0 ? snapshot.planner.complete.map((item) => <li key={item}>{item}</li>) : <li>Nothing yet</li>}</ul>
          </div>
          <div>
            <h4>What&apos;s missing</h4>
            <ul>{snapshot.planner.missing.length > 0 ? snapshot.planner.missing.map((item) => <li key={item}>{item}</li>) : <li>All required outputs are complete</li>}</ul>
          </div>
        </div>
        <h4>Possible next steps</h4>
        <ul>
          {snapshot.planner.candidates.map((candidate) => (
            <li key={`${candidate.action}-${candidate.label}`}>
              <strong>{candidate.label}</strong> — {candidate.reason}
            </li>
          ))}
        </ul>
        <h4>Selected next step</h4>
        <p><strong>{snapshot.planner.selected.label}</strong></p>
        <p className="muted">Why: {snapshot.planner.selected.reason}</p>
      </div>

      <div className="card row">
        <label className="checkboxRow">
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
          Run automatically
        </label>
        <button onClick={heartbeat}>Heartbeat</button>
        <button onClick={() => control("pause")}>Pause</button>
        <button onClick={() => control("resume")}>Resume</button>
        <button onClick={() => control("retry_step")}>Retry step</button>
        <button onClick={() => control("force_shell", "Reviewer")}>Force shell: Reviewer</button>
      </div>

      <div className="card">
        <h3>Interim outputs</h3>

        {grouped?.brief && (
          <div className="artifactBlock">
            <h4>Brief summary</h4>
            <p>{grouped.brief.payload.summary}</p>
            <div className="columns">
              <p><strong>Objective:</strong> {grouped.brief.payload.objective}</p>
              <p><strong>Audience:</strong> {grouped.brief.payload.audience}</p>
              <p><strong>Offer/Product:</strong> {grouped.brief.payload.offerOrProduct}</p>
              <p><strong>Channels:</strong> {grouped.brief.payload.channels?.join(", ")}</p>
            </div>
          </div>
        )}

        {grouped?.routes && (
          <div className="artifactBlock">
            <h4>Strategy routes</h4>
            <div className="columns">
              {grouped.routes.payload.routes.map((route: any) => (
                <div className="card inset" key={route.name}>
                  <strong>{route.name}</strong>
                  <p><strong>Strategic idea:</strong> {route.strategicIdea}</p>
                  <p><strong>Why it fits:</strong> {route.whyItFits}</p>
                  <p><strong>Tradeoff/Risk:</strong> {route.tradeoffOrRisk}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {grouped?.hierarchy && (
          <div className="artifactBlock">
            <h4>Message hierarchy</h4>
            <p><strong>Master message:</strong> {grouped.hierarchy.payload.masterMessage}</p>
            {grouped.hierarchy.payload.supportingPillars.map((pillar: any) => (
              <div className="card inset" key={pillar.title}>
                <strong>{pillar.title}</strong>
                <p>{pillar.message}</p>
                <ul>{pillar.proofPoints.map((point: string) => <li key={point}>{point}</li>)}</ul>
              </div>
            ))}
            <p><strong>CTA ideas:</strong> {grouped.hierarchy.payload.ctaIdeas.join(" | ")}</p>
          </div>
        )}

        {grouped?.draft && (
          <div className="artifactBlock">
            <h4>Draft asset</h4>
            <p><strong>{grouped.draft.payload.type}</strong></p>
            <p><strong>{grouped.draft.payload.hero.headline}</strong></p>
            <p>{grouped.draft.payload.hero.subhead}</p>
            <p><strong>CTA:</strong> {grouped.draft.payload.hero.cta}</p>
            {grouped.draft.payload.sections.map((section: any) => (
              <div key={section.heading}>
                <p><strong>{section.heading}</strong></p>
                <p>{section.copy}</p>
              </div>
            ))}
          </div>
        )}

        {grouped?.review && (
          <div className="artifactBlock">
            <h4>Review report</h4>
            <p><strong>Score:</strong> {grouped.review.payload.overallScore}</p>
            <p><strong>Recommendation:</strong> {grouped.review.payload.recommendation}</p>
            <p><strong>Suggested revision focus:</strong> {grouped.review.payload.suggestedRevisionFocus}</p>
            <div className="columns">
              <div>
                <p><strong>Strengths</strong></p>
                <ul>{grouped.review.payload.strengths.map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <p><strong>Issues / risks</strong></p>
                <ul>{grouped.review.payload.issuesOrRisks.map((item: string) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {grouped?.pack && (
        <div className="card">
          <h3>Final output package</h3>
          <p>{grouped.pack.payload.packageSummary}</p>
          <p><strong>Recommended route:</strong> {grouped.pack.payload.recommendedRoute}</p>
          <p><strong>Outputs produced</strong></p>
          <ul>{grouped.pack.payload.outputsProduced.map((item: string) => <li key={item}>{item}</li>)}</ul>
          <p><strong>Handoff checklist</strong></p>
          <ul>{grouped.pack.payload.handoffChecklist.map((item: string) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h3>Branch history</h3>
        {snapshot.branches.map((b) => (
          <p key={b.id}>
            {b.name} {b.selected ? "(selected)" : "(losing)"}
          </p>
        ))}
      </div>

      <div className="card">
        <h3>Codex participation</h3>
        {codexEvents.length === 0 && <p className="muted">No Codex-assisted step yet.</p>}
        {codexEvents.map((e) => (
          <p key={e.id}>{humanEvent(e.type, e.message)}.</p>
        ))}
      </div>

      <div className="card">
        <h3>Event stream</h3>
        {snapshot.events.map((e) => (
          <p key={e.id}>
            {e.createdAt} — {humanEvent(e.type, e.message)}
          </p>
        ))}
      </div>
    </main>
  );
}
