# WeyAm — Wey am? Right here.

**Find the receipts, screenshots and proofs buried in your gallery — by meaning, not keywords.**

Your proof lives in screenshots: the transfer receipt your landlord claims he never
got, the meter token from three weeks ago, the dollar rate you swore you saved.
Gallery search can't help — it matches filenames like `IMG_2041.jpg`, not meaning.
WeyAm embeds every proof into **Appwrite VectorsDB**, so you ask the way you
remember it — *"the money I sent my landlord for the house"* — and it finds a
receipt that shares almost none of those words.

Built solo for the **Appwrite Databases Hackathon** (Oct 19–31, 2026).
**Database: VectorsDB** — the only database. Remove it and WeyAm doesn't exist.

## What it does

- **Search by meaning** — natural-language queries ranked by cosine similarity,
  each result explaining *what meaning it matched on*.
- **Add a proof** — paste the text on any screenshot/receipt; it's embedded and
  stored as one VectorsDB document: `{ embeddings, metadata }`.
- **Find look-alikes** — run any proof against the vault; its nearest neighbours
  surface duplicates (the demo vault ships with the same ₦250,000 rent transfer
  saved twice — they find each other).

## How VectorsDB is used — deliberately

| Choice | Why |
|---|---|
| VectorsDB (not TablesDB) | The core loop *is* nearest-neighbour search; there is no keyword fallback anywhere in the app |
| `all-minilm` built-in embeddings (384d) | No external embedding service to wire — Appwrite generates vectors in the same system that stores them |
| Fixed dimension 384 | The collection rejects any other width, so a wrong-model vector can never poison the vault |
| `hnsw_cosine` index | Cosine compares direction (meaning), ignores magnitude (length of the receipt text) |
| Text lives in `metadata` | A search result carries everything needed to render — no second lookup |

Server flow (`lib/appwrite-server.ts`, verified against `node-appwrite` v31):

```ts
// Embeddings is its own service in the current SDK:
const res = await new Embeddings(client).createTextEmbeddings({
  texts: [query], model: EmbeddingModel.Allminilm,
});
// Search is the familiar listDocuments, with a vector in the query:
await new VectorsDB(client).listDocuments({
  databaseId: "weyam", collectionId: "proofs",
  queries: [Query.vectorCosine("embeddings", res.embeddings[0].embedding), Query.limit(6)],
});
```

The API key stays server-side (route handlers under `app/api/`); the browser
never sees it.

## Run it

```bash
npm install
npm run dev        # demo mode — works immediately, no account needed
npm test           # vector-engine tests (9, all pinned to the demo promises)
npm run build
```

**Demo mode** runs a small local embedding + cosine engine (`lib/embed.js`)
that mirrors the live flow 1:1 — same ranking contract, same explanations — so
the app is fully usable before Appwrite is wired.

**Live mode**: create an Appwrite project, then follow
[`docs/APPWRITE_SETUP.md`](docs/APPWRITE_SETUP.md) (5 minutes: API key →
`scripts/setup-vectorsdb.mjs` → `scripts/seed-vectorsdb.mjs` → fill `.env.local`).
The UI detects the env and switches its badge to `LIVE · Appwrite VectorsDB`.

## Stack

- Next.js 16 (App Router, route handlers) · React 19 · TypeScript
- Tailwind CSS v4 — UI inspired by shadcn/ui structure, Magic UI motion
  (marquee, number ticker) and Aceternity patterns (spotlight cards, bento
  grid, animated beam pipeline), implemented in-repo
- Appwrite VectorsDB + built-in embeddings via `node-appwrite`

## Layout

```
app/            page (search console + vault), api/ route handlers
lib/            appwrite-server.ts (live), embed.js (local engine), seed.js
scripts/        setup-vectorsdb.mjs, seed-vectorsdb.mjs
tests/          embed.test.mjs — the demo promises, pinned
docs/           APPWRITE_SETUP.md
submission/     SUBMISSION.md — form copy + 2.5-minute demo video script
BRAND.md        name story, voice, name-collision check
```
