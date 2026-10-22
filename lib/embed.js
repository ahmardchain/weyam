// WeyAm local vector engine.
//
// This is a real (if small) embedding + cosine-search implementation used for
// WeyAm's offline demo mode. It mirrors the live Appwrite flow 1:1:
//   text -> embedding vector -> cosine similarity -> ranked results.
//
// The vector has two parts:
//   1. Concept dimensions — curated synonym clusters. Two texts that use
//      *different words for the same thing* ("sent" vs "transfer",
//      "light" vs "electricity") land close together here. This is what makes
//      the search semantic instead of keyword-based.
//   2. Hashed token dimensions — exact tokens (names, banks, amounts) still
//      matter, so each token also votes into a hashed space at lower weight.
//
// In live mode this module is replaced server-side by Appwrite's built-in
// embedding models (all-minilm, 384d) + VectorsDB HNSW cosine search.
// The ranking contract (score 0..1, shared-concept explanation) is identical.

export const CONCEPTS = [
  { id: "pay", label: "money moved", words: ["transfer", "transferred", "paid", "pay", "payment", "sent", "send", "debit", "debited", "transaction", "money", "credited", "credit", "bank"] },
  { id: "rent", label: "rent & housing", words: ["rent", "landlord", "house", "flat", "apartment", "accommodation", "tenant"] },
  { id: "power", label: "electricity", words: ["electricity", "power", "nepa", "ikedc", "meter", "units", "token", "light", "prepaid", "utility"] },
  { id: "data", label: "data & internet", words: ["data", "internet", "browsing", "bundle", "airtime", "mtn", "subscription", "plan", "browse", "network", "glo", "airtel"] },
  { id: "fx", label: "dollar rate", words: ["dollar", "usd", "exchange", "rate", "fx", "conversion", "parallel", "aboki", "currency", "naira"] },
  { id: "repair", label: "repairs", words: ["plumber", "fix", "fixing", "fixed", "repair", "leaking", "leak", "tap", "sink", "pipe", "plumbing", "artisan"] },
  { id: "exam", label: "exams & school", words: ["exam", "jamb", "score", "result", "admission", "university", "school", "screening", "waec"] },
  { id: "bug", label: "bugs & code", words: ["bug", "error", "typeerror", "stack", "trace", "failure", "failed", "broke", "broken", "deployment", "deploy", "build", "production", "code", "undefined", "function", "crash"] },
  { id: "travel", label: "travel", words: ["flight", "plane", "ticket", "boarding", "departure", "seat", "airport", "travel", "trip"] },
  { id: "savings", label: "savings circle", words: ["ajo", "esusu", "savings", "contribution", "contributions", "circle", "payout", "rotation", "coordinator", "thrift", "members", "group", "monthly", "month"] },
  { id: "food", label: "food", words: ["restaurant", "dinner", "food", "meal", "rice", "chicken", "eatery", "lunch", "breakfast"] },
  { id: "shopping", label: "shopping", words: ["supermarket", "groceries", "shopping", "store", "pos", "checkout", "market", "bought", "purchased", "purchase"] },
  { id: "chat", label: "chats & agreements", words: ["whatsapp", "chat", "message", "agreed", "promised", "screenshot"] },
];

const WORD_TO_CONCEPTS = new Map();
CONCEPTS.forEach((concept, idx) => {
  for (const word of concept.words) {
    if (!WORD_TO_CONCEPTS.has(word)) WORD_TO_CONCEPTS.set(word, []);
    WORD_TO_CONCEPTS.get(word).push(idx);
  }
});

export const HASH_DIM = 128;
export const VECTOR_DIM = CONCEPTS.length + HASH_DIM;

const STOPWORDS = new Set([
  "the", "a", "an", "for", "this", "that", "i", "me", "my", "is", "was", "are",
  "were", "of", "to", "in", "on", "at", "it", "its", "did", "do", "does",
  "when", "what", "how", "much", "with", "from", "and", "or", "be", "been",
  "am", "an", "by", "as", "if", "so", "no", "not", "we", "you", "he", "she",
]);

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[₦$€£,.:;!?()"'“”‘’/\\[\]{}<>|@#%^&*_+=~`-]/g, " ")
    .split(/\s+/)
    .filter((t) => (t.length > 1 || /^\d$/.test(t)) && !STOPWORDS.has(t));
}

function hashToken(token) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % HASH_DIM;
}

function conceptHits(text) {
  const hits = new Set();
  for (const token of tokenize(text)) {
    const variants = [token, token.replace(/s$/, ""), token.replace(/ing$/, ""), token.replace(/ed$/, "")];
    for (const v of variants) {
      const idxs = WORD_TO_CONCEPTS.get(v);
      if (idxs) idxs.forEach((i) => hits.add(i));
    }
  }
  return hits;
}

/** Embed text into a normalized VECTOR_DIM vector. */
export function embed(text) {
  const vec = new Array(VECTOR_DIM).fill(0);
  const conceptCounts = new Array(CONCEPTS.length).fill(0);
  for (const token of tokenize(text)) {
    const variants = [token, token.replace(/s$/, "")];
    let matched = false;
    for (const v of variants) {
      const idxs = WORD_TO_CONCEPTS.get(v);
      if (idxs) {
        matched = true;
        for (const i of idxs) conceptCounts[i] += 1;
      }
    }
    vec[CONCEPTS.length + hashToken(token)] += matched ? 0.35 : 0.5;
  }
  // Diminishing returns per concept: a receipt that says "transfer" six
  // times is not six times more *about* paying than one that says it once.
  // sqrt keeps dense short documents from crowding out on-topic ones.
  for (let i = 0; i < CONCEPTS.length; i++) {
    vec[i] = Math.sqrt(conceptCounts[i]);
  }
  const norm = Math.hypot(...vec) || 1;
  return vec.map((v) => v / norm);
}

export function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Concept labels two texts share — the human-readable "why it matched". */
export function sharedConcepts(textA, textB) {
  const a = conceptHits(textA);
  const b = conceptHits(textB);
  return CONCEPTS.filter((c, i) => a.has(i) && b.has(i)).map((c) => c.label);
}

export function docText(item) {
  return [item.title, item.kind, item.party, item.amount, item.text].filter(Boolean).join(" ");
}

/** Rank items by cosine similarity to the query. Returns [{item, score, why}]. */
export function searchLocal(items, query, limit = 6) {
  const qv = embed(query);
  return items
    .map((item) => {
      const text = docText(item);
      return {
        item,
        score: cosine(qv, embed(text)),
        why: sharedConcepts(query, text),
      };
    })
    .filter((r) => r.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Find near-duplicates / look-alikes of one item inside the vault. */
export function lookAlikes(items, target, limit = 3) {
  const tv = embed(docText(target));
  return items
    .filter((i) => i.id !== target.id)
    .map((item) => ({ item, score: cosine(tv, embed(docText(item))) }))
    .filter((r) => r.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
