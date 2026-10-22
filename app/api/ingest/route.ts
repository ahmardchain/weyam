import { NextResponse } from "next/server";
import { appwriteConfigured, ingestProof } from "@/lib/appwrite-server";


// POST /api/ingest { kind, title, party, amount, date, hue, text }
// Live mode only: embeds the proof with Appwrite's built-in model and stores
// { embeddings, metadata } in VectorsDB. In local mode the client embeds and
// keeps the item in its own vault state — this route answers 501 honestly.
export async function POST(req: Request) {
  if (!appwriteConfigured()) {
    return NextResponse.json(
      { error: "Live Appwrite is not configured. Set APPWRITE_* env vars (see docs/APPWRITE_SETUP.md)." },
      { status: 501 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const meta = {
    kind: String(body.kind || "Proof"),
    title: String(body.title || "").trim(),
    party: String(body.party || ""),
    amount: String(body.amount || ""),
    date: String(body.date || ""),
    hue: String(body.hue || "from-slate-500 to-slate-700"),
    text: String(body.text || "").trim(),
  };
  if (!meta.title || !meta.text) {
    return NextResponse.json({ error: "title and text are required" }, { status: 400 });
  }
  try {
    const item = await ingestProof(meta);
    return NextResponse.json({ mode: "live", item });
  } catch (err) {
    return NextResponse.json(
      { error: `Appwrite ingest failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
