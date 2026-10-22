// WeyAm local vector engine tests — run: node --test tests/
// These pin the demo promises:
//   1. A meaning-query with almost no shared keywords still finds its proof.
//   2. The duplicated rent receipt is each other's top look-alike.
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchLocal, lookAlikes, embed, cosine } from "../lib/embed.js";
import { SEED_ITEMS } from "../lib/seed.js";

test("landlord query finds the rent transfer first", () => {
  const [top] = searchLocal(SEED_ITEMS, "the money I sent my landlord for the house");
  assert.equal(top.item.id, "rent-transfer-1");
});

test("'light token' finds the electricity token", () => {
  const [top] = searchLocal(SEED_ITEMS, "the light token I bought");
  assert.equal(top.item.id, "ikedc-token");
});

test("plumber query finds the plumber chat", () => {
  const [top] = searchLocal(SEED_ITEMS, "when is the plumber coming?");
  assert.equal(top.item.id, "plumber-chat");
});

test("dollar query finds the rate screenshot", () => {
  const [top] = searchLocal(SEED_ITEMS, "how much was dollar going for?");
  assert.equal(top.item.id, "usd-rate");
});

test("build bug query finds the error screenshot", () => {
  const [top] = searchLocal(SEED_ITEMS, "that bug that broke my build");
  assert.equal(top.item.id, "build-error");
});

test("savings query finds the ajo circle", () => {
  const [top] = searchLocal(SEED_ITEMS, "savings group money for this month");
  assert.equal(top.item.id, "ajo-payout");
});

test("duplicate rent receipts are top look-alikes of each other", () => {
  const a = SEED_ITEMS.find((i) => i.id === "rent-transfer-1");
  const b = SEED_ITEMS.find((i) => i.id === "rent-transfer-2");
  const [topA] = lookAlikes(SEED_ITEMS, a);
  const [topB] = lookAlikes(SEED_ITEMS, b);
  assert.equal(topA.item.id, b.id);
  assert.equal(topB.item.id, a.id);
  assert.ok(topA.score > 0.6, `dupe score should be high, got ${topA.score}`);
});

test("embeddings are unit vectors and self-similarity is 1", () => {
  const v = embed("transfer rent landlord");
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-6);
  assert.ok(Math.abs(cosine(v, v) - 1) < 1e-6);
});

test("unrelated query scores the rent receipt low", () => {
  const results = searchLocal(SEED_ITEMS, "exam score admission");
  const rent = results.find((r) => r.item.id.startsWith("rent-transfer"));
  assert.ok(!rent || rent.score < 0.35);
});
