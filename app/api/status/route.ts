import { NextResponse, connection } from "next/server";
import { appwriteConfigured, DATABASE_ID, COLLECTION_ID } from "@/lib/appwrite-server";

export async function GET() {
  await connection(); // env is read at request time, never prerendered
  return NextResponse.json({
    mode: appwriteConfigured() ? "live" : "local",
    database: "VectorsDB",
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    embeddingModel: "all-minilm",
    dimension: 384,
    index: "hnsw_cosine",
  });
}
