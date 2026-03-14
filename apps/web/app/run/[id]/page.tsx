"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  run: { id: string; status: string; currentShell: string; title: string };
  events: Array<{ id: string; type: string; message: string; createdAt: string }>;
  artifacts: Array<{ id: string; type: string; schemaValid: boolean }>;
  branches: Array<{ id: string; name: string; selected: boolean }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : `/api${path}`);

export default function RunPage({ params }: { params: { id: string } }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const load = async () => {
    const res = await fetch(apiUrl(`/run/${params.id}`));
    setSnapshot(await res.json());
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const heartbeat = async () => {
    const res = await fetch(apiUrl(`/run/${params.id}/heartbeat`), { method: "POST" });
    setSnapshot(await res.json());
  };

  const control = async (action: string, shell?: string) => {
    const res = await fetch(apiUrl(`/run/${params.id}/control`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, shell })
    });
    setSnapshot(await res.json());
  };

  if (!snapshot) return <main>Loading...</main>;

  const codexEvents = snapshot.events.filter((e) => e.type.includes("codex"));
  const review = snapshot.artifacts.find((a) => a.type === "ReviewReport");

  return (
    <main>
      <h1>{snapshot.run.title}</h1>
      <div className="card row">
        <span>Status: {snapshot.run.status}</span>
        <span>Current shell: {snapshot.run.currentShell}</span>
      </div>

      <div className="card row">
        <button onClick={heartbeat}>Heartbeat</button>
        <button onClick={() => control("pause")}>Pause</button>
        <button onClick={() => control("resume")}>Resume</button>
        <button onClick={() => control("retry_step")}>Retry step</button>
        <button onClick={() => control("force_shell", "Reviewer")}>Force shell: Reviewer</button>
      </div>

      <div className="card">
        <h3>Artifacts</h3>
        {snapshot.artifacts.map((a) => (
          <p key={a.id}>{a.type} (schema: {String(a.schemaValid)})</p>
        ))}
        <p>Required artifacts produced: {snapshot.artifacts.length >= 6 ? "yes" : "no"}</p>
        <p>Review score present: {review ? "yes" : "no"}</p>
      </div>

      <div className="card">
        <h3>Branch history</h3>
        {snapshot.branches.map((b) => (
          <p key={b.id}>{b.name} {b.selected ? "(selected)" : "(losing)"}</p>
        ))}
      </div>

      <div className="card">
        <h3>Codex runtime participation</h3>
        {codexEvents.map((e) => (
          <p key={e.id}>{e.type}: {e.message}</p>
        ))}
      </div>

      <div className="card">
        <h3>Event stream</h3>
        {snapshot.events.map((e) => (
          <p key={e.id}>{e.createdAt} - {e.type} - {e.message}</p>
        ))}
      </div>
    </main>
  );
}
