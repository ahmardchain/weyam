// WeyAm — live Appwrite VectorsDB layer (server only).
//
// Verified against node-appwrite v31 installed in this repo:
//   - Embeddings service: createTextEmbeddings({ texts, model })
//       -> { embeddings: [{ embedding: number[], dimension, model }] }
//   - VectorsDB service: create / createCollection / createIndex /
//     createDocument / listDocuments with Query.vectorCosine('embeddings', v)
//   - EmbeddingModel.Allminilm = "all-minilm" (384 dimensions)
//   - VectorsDBIndexType.HnswCosine = "hnsw_cosine"
//
// A VectorsDB document is exactly two fields:
//   embeddings: number[]  (the vector, fixed width = collection dimension)
//   metadata:   object    (everything needed to render a result)
//
// The API key is read from server env only and never reaches the browser.

import { Client, VectorsDB, Embeddings, EmbeddingModel, Query, ID } from "node-appwrite";

export const DATABASE_ID = process.env.APPWRITE_VECTORSDB_ID || "weyam";
export const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID || "proofs";
export const EMBEDDING_MODEL = EmbeddingModel.Allminilm;
export const EMBEDDING_DIMENSION = 384; // all-minilm

export function appwriteConfigured() {
  return Boolean(
    process.env.APPWRITE_ENDPOINT &&
      process.env.APPWRITE_PROJECT_ID &&
      process.env.APPWRITE_API_KEY,
  );
}

function client() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT as string)
    .setProject(process.env.APPWRITE_PROJECT_ID as string)
    .setKey(process.env.APPWRITE_API_KEY as string);
}

export type ProofMeta = {
  kind: string;
  title: string;
  party: string;
  amount: string;
  date: string;
  hue: string;
  text: string;
};

function docToItem(doc: Record<string, unknown>) {
  const meta = (doc.metadata || {}) as Partial<ProofMeta>;
  return {
    id: String(doc.$id),
    kind: meta.kind || "Proof",
    title: meta.title || "Untitled proof",
    party: meta.party || "",
    amount: meta.amount || "",
    date: meta.date || "",
    hue: meta.hue || "from-slate-500 to-slate-700",
    text: meta.text || "",
  };
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings = new Embeddings(client());
  const res = await embeddings.createTextEmbeddings({
    texts,
    model: EMBEDDING_MODEL,
  });
  return res.embeddings.map((e) => e.embedding);
}

export async function searchProofs(query: string, limit = 6) {
  const vectors = new VectorsDB(client());
  const [qv] = await embedTexts([query]);
  const res = await vectors.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.vectorCosine("embeddings", qv), Query.limit(limit)],
  });
  // VectorsDB returns documents ranked most -> least similar. The SDK list
  // response does not expose the raw distance, so live results report rank
  // order; local mode additionally shows the numeric cosine score.
  return res.documents.map((d, i) => ({
    item: docToItem(d as unknown as Record<string, unknown>),
    score: null as number | null,
    rank: i + 1,
  }));
}

export async function listProofs(limit = 100) {
  const vectors = new VectorsDB(client());
  const res = await vectors.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.limit(limit)],
  });
  return res.documents.map((d) => docToItem(d as unknown as Record<string, unknown>));
}

export async function ingestProof(meta: ProofMeta) {
  const vectors = new VectorsDB(client());
  const embedSource = [meta.title, meta.kind, meta.party, meta.amount, meta.text]
    .filter(Boolean)
    .join(" ");
  const [vector] = await embedTexts([embedSource]);
  const doc = await vectors.createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: { embeddings: vector, metadata: meta },
  });
  return docToItem(doc as unknown as Record<string, unknown>);
}
