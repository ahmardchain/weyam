# WeyAm — submission pack

**Event:** Appwrite Databases Hackathon — Oct 19–31, 2026
**Deadline:** Oct 31, 2026, 11:59 PM PT (= Nov 1, 08:59 WAT)
**Submit at:** hackathon.appwrite.io dashboard → Submit project
**Needs:** public repo link ✅ + demo video (2–3 min max) ⏳ + live link (optional)

## Form copy

**Project name:** WeyAm

**Database used:** VectorsDB

**Description (short):**
WeyAm finds the receipts, screenshots and proofs buried in your gallery — by
meaning, not keywords. Every proof is embedded with Appwrite's built-in
all-minilm model and stored in VectorsDB as a single document (embeddings +
metadata). Ask "the money I sent my landlord for the house" and it finds a
transfer receipt that shares almost none of those words — ranked by HNSW
cosine similarity, with an explanation of what meaning matched. The same
vector operation powers look-alike detection: save the same receipt twice
and the two copies find each other. VectorsDB isn't storage here; it's the
entire product.

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4,
node-appwrite (VectorsDB + Embeddings), Appwrite Cloud.

## Demo video script (~2:30)

1. **0:00–0:20 — The problem.** "This is my gallery. Four thousand screenshots.
   My landlord says he never got the rent. I *know* I saved the receipt."
   Scroll the vault. "Gallery search wants a filename. I don't have a filename.
   I have a memory."
2. **0:20–0:50 — The search.** Type: *"the money I sent my landlord for the
   house"*. Rent receipt ranks #1. Point at the explanation: "It matched on
   meaning — money moved, rent & housing. The receipt doesn't even contain the
   word 'sent'."
3. **0:50–1:15 — The party trick.** Click *"the light token I bought"*. The
   IKEDC electricity token wins. "Light. Electricity. One shared keyword —
   token. Everything else is pure meaning."
4. **1:15–1:45 — Add a proof.** Paste a new receipt's text, hit *Embed &
   store*. Then search for it using completely different words. It appears.
   "That's the whole ingest: text → 384 numbers → one VectorsDB document."
5. **1:45–2:10 — Look-alikes.** On the rent receipt, click *Find look-alikes*.
   The duplicate copy surfaces at the top. "I saved it twice. So did you.
   Cosine doesn't care about filenames."
6. **2:10–2:30 — The database.** Show the spec card + Appwrite console:
   collection `proofs`, dimension 384, `hnsw_cosine`. "One database, chosen
   on purpose. WeyAm — wey am? Right here."

## Checklist

- [ ] Appwrite project created + seeded (docs/APPWRITE_SETUP.md), badge = LIVE
- [ ] Deployed (Vercel import of github.com/ahmardchain/weyam) with env vars set
- [ ] Demo video recorded (script above), ≤ 3 min, uploaded (YouTube)
- [ ] Submitted on hackathon.appwrite.io before Oct 31 11:59 PM PT
- [ ] Repo public, README + this pack in place
