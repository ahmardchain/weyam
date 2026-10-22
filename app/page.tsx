"use client";

import { useEffect, useRef, useState } from "react";
import { SEED_ITEMS, DEMO_QUERIES } from "@/lib/seed.js";
import { searchLocal, lookAlikes } from "@/lib/embed.js";

type Item = (typeof SEED_ITEMS)[number];
type Result = { item: Item; score: number | null; why?: string[]; rank?: number };

const HUES = [
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-700",
  "from-sky-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-rose-500 to-red-700",
];

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

function spotlight(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

function ProofVisual({ item, large = false }: { item: Item; large?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${item.hue} ${
        large ? "h-28" : "h-20"
      }`}
    >
      <div className="bg-dots absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase">
          {item.kind} · {item.date}
        </div>
        <div className={`font-bold text-white ${large ? "text-xl" : "text-base"}`}>
          {item.amount}
        </div>
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
        {item.party.split("(")[0].trim()}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-lime-300">{pct}% match</span>
    </div>
  );
}

export default function Home() {
  const [items, setItems] = useState<Item[]>(SEED_ITEMS);
  const [mode, setMode] = useState<"local" | "live">("local");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Record<string, Result[]>>({});
  const [form, setForm] = useState({ title: "", kind: "Receipt", party: "", amount: "", text: "" });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await (await fetch("/api/status")).json();
        if (s.mode === "live") {
          setMode("live");
          const data = await (await fetch("/api/items")).json();
          if (Array.isArray(data.items) && data.items.length) setItems(data.items);
        }
      } catch {
        /* local mode is the default */
      }
    })();
  }, []);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setSearching(true);
    try {
      if (mode === "live") {
        const data = await (
          await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: text }),
          })
        ).json();
        if (data.error) throw new Error(data.error);
        setResults(data.results);
      } else {
        // Small delay so the ranking feels like a real vector query resolving.
        await new Promise((r) => setTimeout(r, 280));
        setResults(searchLocal(items, text, 6));
      }
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Search failed");
      setResults(searchLocal(items, text, 6));
    } finally {
      setSearching(false);
    }
  }

  async function addProof(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.text.trim()) return;
    const item: Item = {
      id: `proof-${Date.now()}`,
      kind: form.kind,
      title: form.title.trim(),
      party: form.party.trim() || "You",
      amount: form.amount.trim() || "—",
      date: "Today",
      hue: HUES[items.length % HUES.length],
      text: form.text.trim(),
    };
    if (mode === "live") {
      try {
        const data = await (
          await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          })
        ).json();
        if (data.error) throw new Error(data.error);
        setItems((prev) => [data.item, ...prev]);
        setNotice("Proof embedded with Appwrite (all-minilm, 384d) and stored in VectorsDB.");
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Ingest failed");
        return;
      }
    } else {
      setItems((prev) => [item, ...prev]);
      setNotice("Proof embedded and added to the vault. Now search for it by meaning, not its title.");
    }
    setForm({ title: "", kind: "Receipt", party: "", amount: "", text: "" });
  }

  function toggleDupes(item: Item) {
    setDupes((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: lookAlikes(items, item).map((r: { item: Item; score: number }) => ({ ...r })),
      };
    });
  }

  const marqueeKinds = [
    "transfer receipts", "meter tokens", "rate screenshots", "exam results",
    "chat agreements", "flight tickets", "ajo records", "error screenshots",
    "POS receipts", "bill payments",
  ];

  return (
    <main className="min-h-screen bg-[#06060a] text-zinc-100">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#06060a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="pulse-ring flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-emerald-500 font-black text-black">
              W?
            </div>
            <div className="leading-tight">
              <div className="font-bold tracking-tight">WeyAm</div>
              <div className="text-[11px] text-zinc-400">Wey am? Right here.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[11px] ${
                mode === "live"
                  ? "border-lime-300/40 bg-lime-300/10 text-lime-300"
                  : "border-white/15 bg-white/5 text-zinc-300"
              }`}
            >
              {mode === "live" ? "● LIVE · Appwrite VectorsDB" : "● DEMO · local vector engine"}
            </span>
            <a
              href="#vault"
              className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-lime-300 sm:block"
            >
              Open the vault
            </a>
          </div>
        </div>
      </header>

      {/* ---------- Hero + search console ---------- */}
      <section className="bg-grid relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-10">
          <p className="fade-up font-mono text-xs tracking-[0.25em] text-lime-300 uppercase">
            Appwrite Databases Hackathon · VectorsDB
          </p>
          <h1
            className="fade-up mt-4 max-w-3xl text-5xl font-black tracking-tight sm:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            “Wey am?”
            <span className="block bg-gradient-to-r from-lime-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
              Right here.
            </span>
          </h1>
          <p
            className="fade-up mt-5 max-w-2xl text-lg text-zinc-400"
            style={{ animationDelay: "120ms" }}
          >
            Your proof lives in screenshots — transfer receipts, meter tokens, rate charts, chat
            agreements — and your gallery can&apos;t find any of it, because it searches filenames,
            not meaning. WeyAm embeds every proof into Appwrite VectorsDB, so you ask the way you
            remember it, and it answers.
          </p>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-6">
            {[
              { n: 384, s: "d vectors", label: "per proof (all-minilm)" },
              { n: 0, s: "", label: "keywords needed" },
              { n: 2, s: "", label: "fields per document" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-black text-white">
                  <CountUp to={stat.n} suffix={stat.s} />
                </div>
                <div className="mt-1 text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Search console */}
          <div
            className="spotlight-card fade-up mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl sm:p-7"
            onMouseMove={spotlight}
            style={{ animationDelay: "220ms" }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(query);
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe the proof you’re looking for…"
                className="h-14 flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 text-base outline-none placeholder:text-zinc-500 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/20"
              />
              <button
                type="submit"
                disabled={searching}
                className="h-14 rounded-2xl bg-gradient-to-r from-lime-300 to-emerald-400 px-8 font-bold text-black transition hover:brightness-110 disabled:opacity-60"
              >
                {searching ? "Searching vectors…" : "Find am →"}
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {DEMO_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => runSearch(q)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-lime-300/50 hover:text-lime-200"
                >
                  {q}
                </button>
              ))}
            </div>

            <div ref={resultsRef}>
              {results !== null && (
                <div className="mt-6 space-y-3">
                  {results.length === 0 && (
                    <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                      No proof sits close to that meaning yet. Add it to the vault below — future
                      you will find it in seconds.
                    </p>
                  )}
                  {results.map((r, i) => (
                    <div
                      key={r.item.id}
                      className="fade-up flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center"
                      style={{ animationDelay: `${i * 70}ms` }}
                    >
                      <div className="w-full shrink-0 sm:w-44">
                        <ProofVisual item={r.item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-zinc-500">#{i + 1}</span>
                          <h3 className="font-semibold text-white">{r.item.title}</h3>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{r.item.text}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {typeof r.score === "number" && <ScoreBar score={r.score} />}
                          {r.why && r.why.length > 0 && (
                            <span className="text-xs text-zinc-500">
                              matched on meaning:{" "}
                              <span className="text-lime-200">{r.why.join(" · ")}</span>
                            </span>
                          )}
                          {mode === "live" && (
                            <span className="text-xs text-zinc-500">
                              ranked by VectorsDB HNSW cosine
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notice && (
              <p className="mt-4 rounded-xl border border-lime-300/20 bg-lime-300/5 px-4 py-3 text-sm text-lime-200">
                {notice}
              </p>
            )}
          </div>
        </div>

        {/* Marquee */}
        <div className="relative border-y border-white/5 bg-white/[0.015] py-3">
          <div className="animate-marquee flex w-max gap-10 pr-10">
            {[...marqueeKinds, ...marqueeKinds].map((k, i) => (
              <span key={i} className="flex items-center gap-10 text-sm whitespace-nowrap text-zinc-500">
                {k} <span className="text-lime-300">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Bento: how it works ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-black tracking-tight">The database is the product</h2>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Take VectorsDB away and WeyAm has nothing left — no fallback keyword table, no second
          database. Every feature below is one vector operation.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {/* Pipeline */}
          <div
            className="spotlight-card rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:col-span-2"
            onMouseMove={spotlight}
          >
            <h3 className="font-bold">One pipeline, end to end</h3>
            <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {[
                { t: "Capture", d: "Screenshot / receipt text (OCR)" },
                { t: "Embed", d: "Appwrite built-in all-minilm → 384 numbers" },
                { t: "Store", d: "VectorsDB document: embeddings + metadata" },
                { t: "Ask", d: "Query embedded the same way" },
                { t: "Rank", d: "HNSW cosine — nearest meanings first" },
              ].map((step, i, arr) => (
                <div key={step.t} className="flex flex-1 items-center gap-3">
                  <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 p-3">
                    <div className="font-mono text-[10px] tracking-widest text-lime-300 uppercase">
                      Step {i + 1}
                    </div>
                    <div className="mt-1 font-semibold">{step.t}</div>
                    <div className="mt-1 text-xs leading-relaxed text-zinc-500">{step.d}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <svg width="26" height="12" viewBox="0 0 26 12" className="hidden shrink-0 sm:block">
                      <line x1="0" y1="6" x2="20" y2="6" stroke="#a3e635" strokeWidth="1.5" className="beam-line" />
                      <path d="M19 1 L25 6 L19 11" fill="none" stroke="#a3e635" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-5 font-mono text-xs text-zinc-500">
              Query.vectorCosine(&quot;embeddings&quot;, queryVector) — the same listDocuments call
              as every Appwrite database, with a vector where a keyword would go.
            </p>
          </div>

          {/* Spec card */}
          <div className="rounded-3xl border border-lime-300/20 bg-gradient-to-b from-lime-300/10 to-transparent p-6">
            <h3 className="font-bold">VectorsDB, deliberately</h3>
            <dl className="mt-4 space-y-3 font-mono text-sm">
              {[
                ["database", "VectorsDB"],
                ["collection", "proofs"],
                ["dimension", "384 (fixed)"],
                ["model", "all-minilm (built-in)"],
                ["index", "hnsw_cosine"],
                ["fields", "embeddings · metadata"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-lime-200">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              The fixed dimension is the discipline: a collection only accepts vectors from its
              own model, so a bad embedding can never silently poison the vault.
            </p>
          </div>

          {/* Keyword vs meaning */}
          <div
            className="spotlight-card rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            onMouseMove={spotlight}
          >
            <h3 className="font-bold">Keywords fail this. Meaning doesn&apos;t.</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-black/40 p-3">
                <div className="text-zinc-500">You search:</div>
                <div className="font-medium text-white">“the light token I bought”</div>
              </div>
              <div className="rounded-xl bg-black/40 p-3">
                <div className="text-zinc-500">The proof actually says:</div>
                <div className="font-medium text-white">
                  “Prepaid electricity token purchased… IKEDC units credited”
                </div>
              </div>
              <p className="text-zinc-400">
                Shared keywords: <span className="font-mono text-rose-300">token</span>. Shared
                meaning: <span className="text-lime-200">electricity, purchase, payment</span> —
                that&apos;s the gap VectorsDB closes.
              </p>
            </div>
          </div>

          {/* Dupes */}
          <div
            className="spotlight-card rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:col-span-2"
            onMouseMove={spotlight}
          >
            <h3 className="font-bold">Same receipt, saved twice? It knows.</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Similarity cuts both ways: run any proof against the vault and its nearest neighbours
              are its look-alikes. This demo vault ships with the same ₦250,000 rent transfer saved
              twice — open the vault, hit{" "}
              <span className="text-lime-200">“Find look-alikes”</span> on either copy, and watch
              them find each other. No filenames compared, no hashes — just two vectors sitting
              almost on top of each other.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs text-zinc-500">
              <span className="rounded-full border border-white/10 px-3 py-1">cosine &gt; 0.9 → same proof, twice</span>
              <span className="rounded-full border border-white/10 px-3 py-1">0.4 – 0.9 → related proof</span>
              <span className="rounded-full border border-white/10 px-3 py-1">&lt; 0.4 → different story</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Vault ---------- */}
      <section id="vault" className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight">The vault</h2>
            <p className="mt-2 text-zinc-400">
              {items.length} proofs embedded and searchable. In live mode these are VectorsDB
              documents; each card renders straight from its <span className="font-mono text-sm">metadata</span>.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="spotlight-card rounded-3xl border border-white/10 bg-white/[0.03] p-4"
                onMouseMove={spotlight}
              >
                <ProofVisual item={item} large />
                <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.text}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-500">{item.date}</span>
                  <button
                    onClick={() => toggleDupes(item)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium transition hover:border-lime-300/60 hover:text-lime-200"
                  >
                    {dupes[item.id] ? "Hide look-alikes" : "Find look-alikes"}
                  </button>
                </div>
                {dupes[item.id] && (
                  <div className="fade-up mt-3 space-y-2">
                    {dupes[item.id].length === 0 && (
                      <p className="rounded-lg bg-black/40 px-3 py-2 text-xs text-zinc-500">
                        Nothing in the vault sits close to this one. It&apos;s one of a kind.
                      </p>
                    )}
                    {dupes[item.id].map((r) => (
                      <div
                        key={r.item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2"
                      >
                        <span className="truncate text-xs text-amber-100">{r.item.title}</span>
                        {typeof r.score === "number" && <ScoreBar score={r.score} />}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Add proof */}
          <form
            onSubmit={addProof}
            className="h-fit rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:sticky lg:top-24"
          >
            <h3 className="font-bold">Add a proof</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Paste what&apos;s written on the screenshot or receipt. WeyAm embeds the text — the
              words you&apos;ll later <em>remember</em>, not the words on it, do the finding.
            </p>
            <div className="mt-5 space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Title — e.g. School fees transfer"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-300/60"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none"
                >
                  {["Receipt", "Bill", "Screenshot", "Chat", "Ticket", "Result"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Amount — ₦50,000"
                  className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-300/60"
                />
              </div>
              <input
                value={form.party}
                onChange={(e) => setForm({ ...form, party: e.target.value })}
                placeholder="Who / where — e.g. Landlord, MTN"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-300/60"
              />
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="The text on the proof, as written…"
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-lime-300/60"
                required
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-lime-300 to-emerald-400 py-3 font-bold text-black transition hover:brightness-110"
              >
                Embed &amp; store →
              </button>
            </div>
          </form>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-zinc-500">
          <span>
            <span className="font-bold text-zinc-300">WeyAm</span> — Wey am? Right here.
          </span>
          <span className="font-mono text-xs">
            Built solo for the Appwrite Databases Hackathon · Oct 19–31, 2026 · Database: VectorsDB
          </span>
        </div>
      </footer>
    </main>
  );
}
