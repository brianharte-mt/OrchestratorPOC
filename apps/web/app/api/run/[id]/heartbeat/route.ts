import { NextResponse } from "next/server";
import { heartbeat } from "../../../_lib/runtime";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(heartbeat(params.id));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
