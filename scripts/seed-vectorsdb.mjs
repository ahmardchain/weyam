// Seed the live VectorsDB collection with the demo vault from lib/seed.js —
// each item is embedded with Appwrite's built-in model and stored as
// { embeddings, metadata }.
//   node --env-file=.env.local scripts/seed-vectorsdb.mjs
import { Client, VectorsDB, Embeddings, EmbeddingModel } from "node-appwrite";
import { SEED_ITEMS } from "../lib/seed.js";

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
const DATABASE_ID = process.env.APPWRITE_VECTORSDB_ID || "weyam";
const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID || "proofs";

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error("Missing APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);
const vectors = new VectorsDB(client);
const embeddings = new Embeddings(client);

const sources = SEED_ITEMS.map((i) =>
  [i.title, i.kind, i.party, i.amount, i.text].filter(Boolean).join(" "),
);
const res = await embeddings.createTextEmbeddings({
  texts: sources,
  model: EmbeddingModel.Allminilm,
});

for (let n = 0; n < SEED_ITEMS.length; n++) {
  const item = SEED_ITEMS[n];
  const vector = res.embeddings[n].embedding;
  if (!vector.length) throw new Error(`Empty embedding for ${item.id}: ${res.embeddings[n].error}`);
  const { id, ...metadata } = item;
  try {
    await vectors.createDocument({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
      documentId: id,
      data: { embeddings: vector, metadata },
    });
    console.log(`seeded: ${id} (${vector.length}d)`);
  } catch (err) {
    if (err && err.code === 409) console.log(`exists: ${id}`);
    else throw err;
  }
}
console.log("Seed complete.");
