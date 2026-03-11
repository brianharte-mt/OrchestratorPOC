import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { heartbeat } from "./orchestrator";
import { seed } from "./seed";
import { db, getSnapshot } from "./store";

dotenv.config();
seed();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/runs", (_req, res) => {
  res.json(db.runs);
});

app.post("/runs", (req, res) => {
  const now = new Date().toISOString();
  const run = {
    id: crypto.randomUUID(),
    title: req.body.title ?? "Ad-hoc run",
    brief: req.body.brief,
    status: "running" as const,
    currentShell: "Operator" as const,
    currentStep: 0,
    createdAt: now,
    updatedAt: now
  };
  db.runs.push(run);
  res.status(201).json(run);
});

app.get("/run/:id", (req, res) => {
  try {
    res.json(getSnapshot(req.params.id));
  } catch {
    res.status(404).json({ error: "Run not found" });
  }
});

app.post("/run/:id/heartbeat", (req, res) => {
  try {
    const result = heartbeat(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/run/:id/control", (req, res) => {
  const run = db.runs.find((item) => item.id === req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  const { action, shell } = req.body;
  if (action === "pause") run.status = "paused";
  if (action === "resume") run.status = "running";
  if (action === "force_shell" && shell) run.currentShell = shell;
  if (action === "retry_step") {
    const failed = db.steps.find((s) => s.runId === run.id && s.status === "failed");
    if (failed) failed.status = "queued";
  }
  db.interventions.push({ id: crypto.randomUUID(), runId: run.id, action, payload: req.body, createdAt: new Date().toISOString() });
  db.events.push({
    id: crypto.randomUUID(),
    runId: run.id,
    type: "operator_control",
    shell: "Operator",
    message: `Operator action: ${action}`,
    metadata: req.body,
    createdAt: new Date().toISOString()
  });
  return res.json(getSnapshot(run.id));
});

const port = Number(process.env.API_PORT ?? 4000);
app.listen(port, () => {
  console.log(`api listening on ${port}`);
});
