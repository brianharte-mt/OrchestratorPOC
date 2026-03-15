"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Run = { id: string; title: string; brief: string; status: string; currentShell: string; isExample?: boolean };

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : `/api${path}`);

const BRIEF_PLACEHOLDER =
  "Create campaign messaging for a new AI-powered marketing operations platform targeting mid-sized consumer brands. We need a positioning route, message hierarchy, homepage copy draft, and review notes. Priority channels are website and LinkedIn. Tone should be clear, modern, and credible.";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [brief, setBrief] = useState(BRIEF_PLACEHOLDER);

  const load = async () => {
    const res = await fetch(apiUrl("/runs"));
    setRuns(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const createRun = async () => {
    await fetch(apiUrl("/runs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Marketing brief run", brief })
    });
    await load();
  };

  const { primaryRuns, exampleRuns } = useMemo(() => {
    const primaries = runs.filter((run) => !run.isExample);
    const examples = runs.filter((run) => run.isExample);
    return { primaryRuns: primaries, exampleRuns: examples };
  }, [runs]);

  return (
    <main>
      <h1>Marketing orchestration demo</h1>

      <div className="card">
        <h2>Start a marketing orchestration run</h2>
        <p className="muted">
          Enter a marketing brief. Include the objective, audience, offer or product, channels, constraints, and what output you want.
        </p>
        <label htmlFor="brief">Marketing brief</label>
        <textarea
          id="brief"
          value={brief}
          placeholder={BRIEF_PLACEHOLDER}
          onChange={(e) => setBrief(e.target.value)}
        />
        <button onClick={createRun}>Start run</button>
      </div>

      <div className="card">
        <h3>What this run will try to produce</h3>
        <ul>
          <li>Brief summary</li>
          <li>Strategy routes</li>
          <li>Message hierarchy</li>
          <li>Draft asset</li>
          <li>Review report</li>
          <li>Final package</li>
        </ul>
      </div>

      {primaryRuns.length > 0 && (
        <div className="card">
          <h3>Your runs</h3>
          {primaryRuns.map((run) => (
            <div className="card inset" key={run.id}>
              <strong>{run.title}</strong>
              <p>{run.brief}</p>
              <div className="row">
                <span>Status: {run.status}</span>
                <span>Current shell: {run.currentShell}</span>
                <Link href={`/run/${run.id}`}>Open run</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Example runs</h3>
        <p className="muted">These are demo scenarios so you can inspect the flow quickly.</p>
        {exampleRuns.map((run) => (
          <div className="card inset" key={run.id}>
            <strong>{run.title}</strong>
            <p>{run.brief}</p>
            <div className="row">
              <span>Status: {run.status}</span>
              <span>Current shell: {run.currentShell}</span>
              <Link href={`/run/${run.id}`}>Open run</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
