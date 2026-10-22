// Create WeyAm's VectorsDB database, collection and HNSW cosine index.
// Run AFTER creating an Appwrite project + API key (scopes: vectorsdb.*,
// embeddings.write). See docs/APPWRITE_SETUP.md.
//   node --env-file=.env.local scripts/setup-vectorsdb.mjs
import { Client, VectorsDB, VectorsDBIndexType } from "node-appwrite";

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
const DATABASE_ID = process.env.APPWRITE_VECTORSDB_ID || "weyam";
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID || "proofs";
const DIMENSION = 384; // all-minilm — must match the embedding model in lib/appwrite-server.ts

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const db = new VectorsDB(client);

async function ensure(label, fn) {
  try {
    const out = await fn();
    console.log(`created: ${label}`);
    return out;
  } catch (err) {
    if (err && (err.code === 409 || /already exists/i.test(String(err.message)))) {
      console.log(`exists:  ${label}`);
      return null;
    }
    throw err;
  }
}

await ensure(`database ${DATABASE_ID}`, () =>
  db.create({ databaseId: DATABASE_ID, name: "WeyAm proofs" }),
);
await ensure(`collection ${COLLECTION_ID} (dim ${DIMENSION})`, () =>
  db.createCollection({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    name: "Proofs",
    dimension: DIMENSION,
  }),
);
await ensure("index embeddings_hnsw_cosine", () =>
  db.createIndex({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    key: "embeddings_hnsw_cosine",
    type: VectorsDBIndexType.HnswCosine,
    attributes: ["embeddings"],
  }),
);
console.log("VectorsDB ready. Next: node --env-file=.env.local scripts/seed-vectorsdb.mjs");
