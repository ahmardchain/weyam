import { NextResponse } from "next/server";
import { appwriteConfigured, searchProofs } from "@/lib/appwrite-server";
import { searchLocal } from "@/lib/embed.js";
import { SEED_ITEMS } from "@/lib/seed.js";


// POST /api/search { query, items? }
// Live mode: Appwrite VectorsDB (built-in embeddings + HNSW cosine).
// Local mode: the same flow over lib/embed.js so the demo runs anywhere.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  if (appwriteConfigured()) {
    try {
      const results = await searchProofs(query, 6);
      return NextResponse.json({ mode: "live", results });
    } catch (err) {
      return NextResponse.json(
        { error: `Appwrite search failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }
  }

  const items = Array.isArray(body.items) && body.items.length ? body.items : SEED_ITEMS;
  return NextResponse.json({ mode: "local", results: searchLocal(items, query, 6) });
}
