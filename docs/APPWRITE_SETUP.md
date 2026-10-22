# WeyAm — Appwrite setup (live mode)

Time: ~5 minutes. Needs **your** sign-in — the Appwrite account is your
hacker profile for this hackathon.

## 1. Sign in & create a project

1. Go to [hackathon.appwrite.io](https://hackathon.appwrite.io/) and sign in
   (GitHub) — this is also your hackathon registration.
2. In the Appwrite Console, create a project named **WeyAm**.
3. Note the **Project ID** and your region endpoint
   (e.g. `https://fra.cloud.appwrite.io/v1`).

## 2. API key

Console → project → **API Keys** → create a key with scopes:

- `vectorsdb.read`, `vectorsdb.write`
- `vectorsdb.collections.read`, `vectorsdb.collections.write`
- `vectorsdb.indexes.read`, `vectorsdb.indexes.write`
- `vectorsdb.documents.read`, `vectorsdb.documents.write`
- `embeddings.write`

## 3. Env

```bash
cp .env.example .env.local
# fill APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
```

## 4. Create the database + seed

```bash
node --env-file=.env.local scripts/setup-vectorsdb.mjs
node --env-file=.env.local scripts/seed-vectorsdb.mjs
npm run dev
```

The header badge flips to **LIVE · Appwrite VectorsDB** and `/api/status`
reports `mode: "live"`. Setup creates:

- Database `weyam` (type: VectorsDB)
- Collection `proofs`, dimension **384** (matches built-in `all-minilm`)
- Index `embeddings_hnsw_cosine` (HNSW, cosine) on `embeddings`

## Notes / gotchas

- **Dimension is forever.** A collection accepts only vectors of its fixed
  width. Changing the embedding model later means a new collection — that's
  why WeyAm pins `all-minilm` in `lib/appwrite-server.ts`, the setup script,
  and the seed script, in one place each.
- **Embeddings is a separate service** in the current SDK
  (`new Embeddings(client).createTextEmbeddings(...)`), not a method on
  `VectorsDB` as some launch posts show. The repo code already does this.
- **Search results don't expose raw distances** via `listDocuments`, so live
  mode ranks by VectorsDB's returned order; the numeric cosine % shows in
  demo mode, where WeyAm computes it itself.
