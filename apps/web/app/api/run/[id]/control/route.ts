import { NextRequest, NextResponse } from "next/server";
import { controlRun } from "../../../_lib/runtime";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { action?: string; shell?: string };
    return NextResponse.json(controlRun(params.id, body.action, body.shell));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}
