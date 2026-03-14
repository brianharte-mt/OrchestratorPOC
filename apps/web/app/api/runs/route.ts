import { NextRequest, NextResponse } from "next/server";
import { createRun, listRuns } from "../_lib/runtime";

export async function GET() {
  return NextResponse.json(listRuns());
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { title?: string; brief?: string };
  const run = createRun(body.title, body.brief);
  return NextResponse.json(run, { status: 201 });
}
