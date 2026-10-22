import { NextResponse, connection } from "next/server";
import { appwriteConfigured, listProofs } from "@/lib/appwrite-server";
import { SEED_ITEMS } from "@/lib/seed.js";

// GET /api/items — the vault contents (live VectorsDB or local seed).
export async function GET() {
  await connection(); // env is read at request time, never prerendered
  if (appwriteConfigured()) {
    try {
      const items = await listProofs();
      return NextResponse.json({ mode: "live", items });
    } catch (err) {
      return NextResponse.json(
        { error: `Appwrite list failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }
  }
  return NextResponse.json({ mode: "local", items: SEED_ITEMS });
}
