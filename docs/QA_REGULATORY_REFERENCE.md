# Codes & Guidance — QA checklist (Josh, vernon.helixsystems.ca)

Solo Recreation Operations Coordinator check after deploy. Reference only — not legal advice.

## Find it
1. Sign in on vernon.helixsystems.ca.
2. Left rail **Codes & Guidance** (Reference domain, immediately after Recreation). Click opens `/recreation/regulations`. Hover still lists Codes & Guidance. Phone menu: the same rail name is a direct link. Do not look under Docs.
3. Confirm the amber disclaimer: Pulse does not reproduce code text and does not decide legal requirements.

## Browse & search
4. If the library is empty: **Add guidance document** (or **New card**) — not a wall of demo content. Startup does **not** auto-insert catalog rows; existing cards stay as you left them.
5. If cards already exist from the earlier starter set, category chips still filter them. Keyword search: `chief engineer`, `pool code`, `building code`, `oh&s`, `ammonia`, `TSBC`, `ice plant`, `secondary coolant` (only if those cards are present).
6. Open a card: title, category, classification (Law/Regulation vs Guidance vs Internal), applicability, summary, official source name + URL, verification badge + review date, “What to do in Pulse” links.

## Official sources (spot-check cards Josh has added or kept)
7. Official source URL on a card should open the public page (or stay blank until Josh fills it).
8. Classification is Josh’s label — Pulse does not decide legal requirements.
9. Starter catalog (optional one-off seed only — never on API boot) includes TSBC ammonia awareness, PEBPVRSR chief-engineer definition / s.68–70, refrigeration in-charge / A3-B2L capacity **pointers**, secondary-coolant directive D-BP 2025-02, and design-registration bulletin IB-DA 2020-01. Summaries cite public pages; they are not CSA B52 text.

## Ask / Search
10. **Recreation → Coordination → Ops Copilot** (or Intelligence, if still labelled that way).
11. Type a question about a card Josh created (use its title) → Ask. Citations should include that Codes & Guidance card when it exists.
12. Header **Search / Ask** (or Ctrl/⌘K): `ammonia`, `chief engineer`, `TSBC`, and `ice plant` should deep-link to Codes & Guidance. `ammonia emergency` / `ammonia release` still open Emergency Response. `Where do I add a PM for the ice plant?` still opens Equipment.
13. Open a citation into the matching library card.

## Internal vs official
14. Internal notes stay labelled **Internal note**. Official statutes Josh links stay **Law/Regulation** or **Regulator guidance** as he marks them.

## Mobile
15. Phone or narrow browser: chips scroll horizontally, cards stack, the editor and official link are usable.

## Edit / create / archive (Josh — company admin)
16. Open any card → **Edit**. Change title, summary, category, classification, applicability, official source, Pulse pointers, keywords. **Save changes**. Refresh — edits remain.
17. **New card** / **Add guidance document**: add a local document. It appears in filters and in header Search / Ask after reload.
18. **Archive** a card with confirm. It leaves the active library; **Show archived** + **Restore** brings it back.
19. API restart must **not** insert a new starter catalog. Existing cards stay as Josh left them (including archived). Re-running the optional catalog seed upserts **untouched** `source_key` rows only and skips `user_modified` / archived cards — it must not fight manual entry.
20. Do not paste copyrighted code. Leave verification as Unverified until you confirm the URL.

If a public URL 404s, keep the organization name, mark verification **Unverified** or **Needs municipal confirmation**, and note how to find the page.
