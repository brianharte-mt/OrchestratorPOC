import { NextResponse } from "next/server";
import { fetchSnapshot } from "../../_lib/runtime";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(fetchSnapshot(params.id));
  } catch {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
}
