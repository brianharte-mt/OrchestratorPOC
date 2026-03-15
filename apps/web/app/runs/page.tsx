"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Run = { id: string; title: string; brief: string; status: string; currentShell: string };

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : `/api${path}`);

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [brief, setBrief] = useState("Create a launch campaign for Manifold Three.");

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
      body: JSON.stringify({ title: "Operator submitted brief", brief })
    });
    await load();
  };

  return (
    <main>
      <h1>Manifold Three Operator Console</h1>
      <div className="card">
        <h3>Start Run</h3>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} />
        <button onClick={createRun}>Create run</button>
      </div>
      {runs.map((run) => (
        <div className="card" key={run.id}>
          <strong>{run.title}</strong>
          <p>{run.brief}</p>
          <div className="row">
            <span>Status: {run.status}</span>
            <span>Shell: {run.currentShell}</span>
            <Link href={`/run/${run.id}`}>Open run</Link>
          </div>
        </div>
      ))}
    </main>
  );
}
