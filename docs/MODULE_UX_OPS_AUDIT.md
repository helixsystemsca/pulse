# Pulse module UX & ops audit

**Audience:** Josh Collins (Recreation Operations Coordinator, City of Vernon–style BC municipal recreation) and Leif (product/engineering).  
**Host:** [vernon.helixsystems.ca](https://vernon.helixsystems.ca)  
**Date:** 16 September 2026  
**Codebase:** `helixsystemsca/pulse` @ `682d169c` (`main` after PR #26)

This is an **audit + recommendations** document, not a redesign spec. Priorities assume a **near-term solo coordinator**: facilities, ammonia ice plant / chief-engineer duties, pools, schedules, work requests, inventory/equipment, training/certs, contractors, and Codes & Guidance. Josh prefers **manual data entry** over fighting auto-seed, and **municipal professional UI** (ops chrome, not toy/pastel).

---

## TL;DR

Pulse already has the bones of a modern municipal CMMS: facility-as-anchor, inspection→work request, equipment PMs, Ask/Search intent routing, TSBC / chief-engineer guidance cards, schedule training alarms, and a quieter dashboard WR widget. The product is **too wide for one person** and **too split for closed-loop work**.

Josh should live in **eight daily tools** (Dashboard, Work Requests, Schedule, Equipment, Inventory, Facilities, Checklists, Codes & Guidance) plus **Emergency** when needed. Everything else should either **feed those tools** (exceptions, certs, contractors) or sit **out of the way** until a second user exists.

The highest-leverage move is not a visual redesign. It is **exception-based ops**: surface what is overdue / expired / failed, then jump to the record. Operational Attention already does this — it is just **hidden from the rail**.

---

## Executive summary — top 10 moves

Ordered for a solo recreation coordinator, not a platform roadmap.

| # | Move | Why it matters for Josh | Priority |
|---|------|-------------------------|----------|
| 1 | **Put exceptions on the home board** — pin Operational Attention (or its overdue tiles) on the Operations dashboard; keep the WR widget as KPIs + 2–3 clickable overdue rows | Stops hunting across WR, contractors, certs, and checklists every morning | P0 |
| 2 | **Make Equipment the only PM home** — hide the deprecated “Preventative scheduling (rules)” panel on Work Requests; keep “+ New PM” as a shortcut to equipment PM | Duplicate PM concepts waste the daily maintenance path | P0 |
| 3 | **Finish the facility panel** — show open WRs on the building; make inventory rows clickable; keep name-only create | Arena / pool should be the ops home, not three separate lists | P0 |
| 4 | **Emergency = one-screen runbook** — ammonia contacts + next steps on the Emergency page, not five “go elsewhere” cards | Under pressure, aggregators fail | P0 |
| 5 | **Quiet the solo-admin permission surface** — skip/defer the Permissions wizard after first setup; stop implying a department matrix Josh does not staff | Daily friction with no operational payoff | P0 |
| 6 | **Closed-loop WR ↔ inspection ↔ PM in the UI** — failed inspection already creates a WR; add “reinspect when done” and show PM-generated WRs as a filter, not a buried rules form | Modern CMMS practice; backend already does parts of this | P1 |
| 7 | **Competency on the schedule** — training alarms exist; wire recreation certs (NLS, first aid, ice-plant / refrigeration) instead of generic flashcard/CAPM empty states | Stops unqualified assignments on ice/pool shifts | P1 |
| 8 | **Contractor insurance digest** — expired/missing COI + WCB as a dashboard/Ask target, not a 20-field form hunt | Weekly compliance that is easy to miss | P1 |
| 9 | **One place for “how we do it”** — decision tree: Codes & Guidance (official URLs) vs Ops Knowledge (local notes) vs Procedures (acknowledgeable SOPs) vs facility emergency field | Four overlapping libraries confuse search and tours | P1 |
| 10 | **Park non-ops rails for Vernon** — Communications, Live Map hardware, department blank dashboards, Team Management “soon” pages, Monitoring demo | Reduces IA noise without deleting code | P2 |

**Keep (do not redesign):** Ask/Search intent catalog, Codes & Guidance rail + disclaimer + TSBC cards, facility name-only create, schedule DnD, WR KPI restyle, module-tour spotlights, nav hubs from PR #23/#25/#26.

---

## How to read this

Each module uses the same five blocks:

1. **What it’s for** — one sentence in ops language  
2. **Current strengths**  
3. **Friction / outdated patterns** — from code and copy; hypotheses labeled  
4. **Modern methodology** — realistic for a solo coordinator (exception queues, mobile rounds, QR-at-asset, closed-loop, competency-gated scheduling, searchable SOPs, evidence capture, digest/alarms)  
5. **Priority** + **1–3 next steps**

**Priority key**

- **P0** — painful on a typical day  
- **P1** — weekly / seasonal ops  
- **P2** — later or second-user  
- **Keep** — working; leave it  

**Method:** Registry + navigation tree + page shells on `main` after PR #26. Sampled highest-traffic modules in code (Dashboard, Work Requests, Schedule, Equipment, Inventory, Facilities, Codes & Guidance, Training/Flashcards, Checklists, Emergency, Contractors, Projects, Settings). Live tenant is login-gated; this document is **not** a pixel-perfect QA of vernon.helixsystems.ca. Where behavior is inferred, it is marked **Hypothesis**.

Related docs (do not duplicate): `docs/QA_REGULATORY_REFERENCE.md`, `docs/inventory-enterprise-roadmap.md`, `frontend/docs/UI_SYSTEM.md`, `frontend/docs/TRAINING_ARCHITECTURE.md`.

---

## Live information architecture

Sidebar is a **collapsed icon rail** with **domain flyouts** (`AppSideNav` + `buildNavigationTree`). Authorization is registry → contract → `enabled_features` → RBAC (`tenant-nav.ts`). Presentation domains are **not** used for access.

Rail order (`nav-domains.ts`):

| Rail label | Domain key | What Josh sees |
|------------|------------|----------------|
| Dashboards | Dashboards | Leadership + Operations dashboards |
| Planning | Planning | **Schedule**, then **Projects** (PR #25) |
| Operations | Operations | Work Requests, Logs & Inspections, Continuous Improvement, Monitoring, Routines, Messaging |
| **Recreation** | My Role | Planner, facilities, checklists, emergency, directory, docs, copilot |
| **Codes & Guidance** | Reference | Direct click to `/recreation/regulations` (PR #26); hover still opens flyout |
| Communications | Communications | Social / ads / publications (likely unused daily) |
| Aquatics / Reception / Fitness / Racquets | same | Department **blank dashboards** only |
| Training | Training | **Flashcards** only (milestone flag) |
| Team Management | Team Management | One hub (people/performance/growth inside) |
| Assets | Assets | Inventory, Scanner, Equipment |
| Maps | Visuals | Infrastructure maps, Facility drawings, Live Map, Zones & Devices |
| Administration | Administration | Permissions (Settings is **header cog**, filtered out of the live rail) |

**Hubs (PR #23):** Planner tabs, Projects tabs (Roadmap / PM tools), Team Management sections, Recreation People tabs (Contacts / Org Chart) are **in-page**, not extra flyout rows.

**Josh’s daily path (recommended):** Dashboards → Operations (WR) → Planning (Schedule) → Assets → Recreation (Facilities / Checklists / Emergency) → Codes & Guidance. Ask (`Ctrl/⌘K`) as the “I don’t know which rail” escape hatch.

---

## Dashboards

### Leadership dashboard — `/overview`

**What it’s for:** Organization-level widget canvas — overdue work, important dates, and module peeks in one place.

**Strengths**

- Shared `OperationalDashboard` engine with edit/add widget, contract-gated widgets, department empty-state CTA.
- Dashboard tour leads with **Ask**, then widgets (`tour-steps/dashboard.ts`).
- WR widget restyled to ops chrome (PR #22): platinum/iron tiles, muted status rails, sentence-case labels — matches Josh’s municipal preference.
- Custom peek catalog can surface monitoring, inventory, WR slices (`dashboardPageWidgetCatalog.ts`).

**Friction**

- **KPI-only WR widget** — counts without the 2–3 overdue rows already fetched at bootstrap (`NotificationsWorkOrdersOpsWidget.tsx`).
- **“Pending approval” KPI** counts `status=open` + `unassigned_only` — not the UI workflow state `pending_approval` (`kpi-summary.ts`). Easy to distrust the number.
- Leadership vs Operations boards share widgets but **separate layouts** — easy to edit the wrong one.
- Welcome overlay adds a second load after login.
- **Hypothesis:** A solo admin will still hunt because Attention / contractor expiry / certs are not default widgets.

**Modern methodology:** Exception-based home (overdue WR, failed inspections, expired COI, certs inside 30 days, incomplete seasonal checklists). Digests over hunting.

**Priority:** P0 (this is the morning screen)

**Next steps**

1. Default Operations/Leadership layout for Vernon: WR KPIs + overdue list, low inventory, certs/contractors, important dates. Hide empty department canvases from the rail if the department is not staffed.
2. Rename the WR KPI to **Unassigned open** (or filter true pending approval).
3. Add a widget (or pin) for `/recreation/attention` exception counts.

### Operations dashboard — `/worker`

**What it’s for:** Personal/ops-focused widget canvas (same engine as Leadership).

**Strengths:** Same widget contract; login can send field users here.

**Friction:** Name “Operations dashboard” vs rail “Dashboards” vs domain “Operations” (Work Requests). Three “operations” meanings.

**Priority:** Keep as the **Josh home** if Leadership stays exec-flavored; otherwise collapse to one board for a solo tenant.

**Next steps:** Pick **one** default homepage for Vernon company_admin (Operations dashboard) and keep Leadership as optional.

### Project dashboard — `/overview/project`

**Nav:** Hidden (`navVisible: false`); reach via Projects hub. **Priority:** Keep hidden.

### Department dashboards — `/dashboard/department/{aquatics|reception|fitness|racquets|communications|admin}`

**What it’s for:** Blank widget canvases owned by a department.

**Strengths:** Empty state with “Add your first widget” (`OperationalDashboard.tsx`).

**Friction:** For a solo recreation coordinator they are **empty rooms**. They also occupy four extra rail domains (Aquatics, Reception, Fitness, Racquets) that only contain a dashboard.

**Priority:** P2 — hide unused department rails on the Vernon contract until those teams log in.

**Next steps:** Contract/flag to hide empty department domains; do not build Aquatics-specific product until a second user asks.

---

## Planning

### Schedule — `/schedule`

**What it’s for:** Weekly staffing grid — build shifts, drag people/codes, publish, spot coverage and training conflicts.

**Strengths**

- Real DnD with row-scoped drops (`ScheduleEmployeeWeekGrid`, `lib/schedule/drag.ts`) — recent hardening in PR #21.
- **Training assignment alarms** (badge + toast + metrics strip) — this is the right modern pattern (competency-gated scheduling).
- Availability / coverage / shift definitions exist as **in-module** views, not flyout clutter.
- Feature tour on toolbar + workspace.

**Friction**

- Very large surface (`ScheduleApp.tsx` ~2,200+ lines) — first-week cognitive load.
- Full-page “Loading schedule…” with no skeleton.
- Module-disabled copy sends admins toward **System** rather than Settings.
- Training alarm is easy to miss in a dense week grid (**Hypothesis:** toast-only on assign).
- Alarms are only as good as the **cert data**. Training is currently flashcards-milestone; recreation tickets (NLS, first aid, refrigeration) may not be the records the alarm reads. **Hypothesis — confirm against `AssignmentTrainingAlarmBadge` data source.**

**Modern methodology:** Competency-gated scheduling; publish-day digest (“3 assignments with expired first aid”); mobile view for on-duty lookup, not for building the week.

**Priority:** P0 (weekly build is daily-adjacent in rec ops)

**Next steps**

1. Confirm which credentials fire the alarm; map ice-plant / NLS / first aid to that model (or document the gap).
2. Persistent “training conflicts” strip that stays visible after the toast.
3. Skeleton load; keep DnD as-is (Keep).

### Projects hub — `/projects` (tabs: Roadmap, Project Management)

**What it’s for:** Operational initiatives, tasks, skill matching — not the ice-plant PM calendar.

**Strengths:** Hub tabs (`PlanningHubChrome`); schedule overlay fields on projects; status buckets explained; Roadmap/PM not duplicated in the Planning flyout.

**Friction**

- PM tools need `can_use_pm_features` + `projects.pm.view` — tab can appear then bounce.
- Recreation also has a hidden **Planning Hub** (`/recreation/planning`) that is another link card to the same places.
- Naming: Planning rail vs Daily Planner vs Team Management → Planning vs Recreation Planning Hub.

**Modern methodology:** Use Projects for **capital / seasonal programs** (arena freeze-up project, pool start-up). Do not use it as the PM work-order list.

**Priority:** P1 (seasonal), Keep hub IA

**Next steps**

1. One-line on the Projects empty state: “Preventive maintenance lives on Equipment, not here.”
2. Hide Recreation Planning Hub forever or redirect to `/projects`.
3. Do not expand PM Gantt until Josh has more than a handful of projects.

### Daily Planner — `/planner` (Recreation rail)

Covered under Recreation; listed here because the name collides with this domain.

---

## Operations

### Work Requests — `/dashboard/maintenance`

**What it’s for:** Submit, assign, hold, and close maintenance work across zones — including PM-tagged items.

**Strengths**

- Full workflow: pending approval → assigned → in progress → hold (reason presets) → complete.
- Deep links from equipment parts (`?create=1&equipment_id=`).
- Inspection fail → WR API (`corrective-action`).
- My work / Approval / All tabs.
- Locations + settings from the header.
- KPI tiles on the dashboard now match ops chrome (PR #22).

**Friction**

- URL still says **maintenance**; product name is Work Requests.
- Table `min-w-[1220px]` — horizontal scroll on a phone in the plant.
- Empty state has no “create first request” CTA.
- **Two PM systems on one page:** header “+ New PM” (plans) vs collapsed **Preventative scheduling (rules)** which is labeled **deprecated** and says generation is “not automated yet” (`PreventativeMaintenanceApp.tsx`).
- Jargon leftovers: `hub_category`, `kind`, WO # vs request.
- Dashboard KPI label mismatch (see Dashboards).

**Modern methodology:** Exception queue (overdue / unassigned / failed-inspection origin). QR-at-asset → create WR. Close the loop: complete WR → update PM next due (backend `sync_pm_task_after_work_order_completed` already exists — **confirm it is visible in the UI**).

**Priority:** P0

**Next steps**

1. Hide or remove the deprecated preventative-rules `<details>` on the hub; point “+ New PM” copy at Equipment.
2. Mobile card layout (or a “My work today” list) for plant-floor use.
3. Empty state + filter chip **From inspections** / **PM generated**.

### Logs & Inspections — `/dashboard/compliance`

**What it’s for:** Run inspection sheets and operational logs, keep history, spawn a corrective WR from a failed line.

**Strengths**

- Clear hero copy; failed line → WR with notes/photos (`InspectionCorrectivePanel`).
- Custom templates; some runs POST to the server.
- Ask catalog already teaches “create a work request from a failed inspection.”

**Friction**

- Route and RBAC still say **compliance** — collisions with Training Compliance and Settings → Compliance.
- **Logs are localStorage / device-only**; vehicle sheet is mock until fleet sync. Audit-defensible history is incomplete.
- Corrective panel only shows for `lastServerRun` — easy to miss after navigation.
- No WR-complete → re-inspection; no inspection → PM schedule.

**Modern methodology:** Mobile-first rounds, evidence capture (photo + signature), closed-loop fail→WR→reinspect. QR on the asset opens the right sheet.

**Priority:** P0 (daily rounds) for inspections; P1 for log persistence

**Next steps**

1. Rename route/nav mental model: keep label “Logs & Inspections”; add a one-line “This is not Training Compliance.”
2. Persist logs to the API **or** badge them “This device only.”
3. After WR complete, prompt “Re-run inspection.”

### Operational Improvements — `/dashboard/operational-improvements`

**What it’s for:** Problem → analysis → action → measurement (CI), separate from a work request.

**Strengths:** Can link/create a WR from an action; playbooks/templates exist.

**Friction:** Isolated from inspections, low stock, and monitoring. Language (“opportunities”, value-stream) is lean-office, not arena ops.

**Priority:** P2 — Josh can use a WR or Quick Note instead until there is a CI program.

**Next steps:** Optional “Log as improvement” from a completed WR; otherwise leave it.

### Monitoring — `/monitoring`

**What it’s for:** Pool chemistry / CO₂ / feeder health.

**Strengths:** Honest “demo fill levels… live hardware will replace this preview.” Dashboard peeks exist.

**Friction:** Display-only mock. No threshold → WR or inbox alert. Easy to think pools are “in Pulse” when they are not live.

**Modern methodology:** Exception alarms (pH out of range → WR or duty notification). Until hardware is real, **do not** put this on Josh’s morning board.

**Priority:** P2 (Keep the honesty; don’t fake live ops)

**Next steps:** When telemetry lands, one rule: out-of-range → operational notification + optional WR. Until then, hide the widget by default on Vernon.

### Routines — `/standards/routines`

**What it’s for:** Shift checklists built from the Procedures library (handoffs), **not** recreation seasonal Checklists and **not** Daily Planner.

**Strengths:** Flyout copy already disambiguates. Wizard from procedures. Dashboard widget for assignments.

**Friction**

- Lives under `/standards` while the rail is Operations.
- Run requires a schedule `shift_id` — dead-end without a shift.
- No fail → WR.
- Widget may fall back to demo rows (**Hypothesis:** can mask empty real data).

**Priority:** P1 if Josh runs shift handover this way; else Keep but don’t market as Checklists.

**Next steps:** Deep link from Schedule (“Start tonight’s routine”); optional WR from a failed required line.

### Messaging — `/dashboard/messages`

**What it’s for:** Operational **alert inbox** (low stock, missing tools) plus admin product-feedback — **not chat**.

**Strengths:** Shares store with header bell; dismiss syncs; deep links to modules.

**Friction:** Name overpromises. Two “message” ideas (inbox vs megaphone feedback).

**Priority:** P1 as the digest surface; rename later.

**Next steps:** Relabel to **Ops inbox**. Route contractor/cert/PM due into this same bell instead of new channels.

---

## Recreation (rail label; domain key `My Role`)

This is Josh’s **role home**. Feature gate is `recreation_ops`. Several useful pages are `navVisible: false` (Attention, Org Chart, Reports, Knowledge Gaps, Planning Hub, Team Development, Command Center).

### Daily Planner — `/planner`

**What it’s for:** Personal 8:30–4:30 time-box (inbox / routine / analytics tabs) — not the staff Schedule.

**Strengths:** Excellent tours; interruption flow; explicit separation from Checklists and Routines.

**Friction:** Four things named planning/planner. Meetings not synced to Outlook. Emergency interruption is generic, not linked to Emergency Response. Quick-add fails when the day is full.

**Priority:** P1 (nice daily if Josh adopts it); Keep the tab hub

**Next steps:** One “Park for tomorrow” when the day is full; optional “Open Emergency” from the interruption modal.

### Facilities — `/recreation/facilities`

**What it’s for:** Master list of buildings you operate; inventory and equipment link here.

**Strengths**

- Best empty state in the product (“just a name”).
- Progressive disclosure (More details for systems/emergency).
- Contents API: assets + inventory; Add asset / Add inventory with `ops_facility_id`.
- Mobile list/detail swap.
- Ask: “Add a facility”, “Assets at the arena.”

**Friction**

- **No open work requests** on the facility panel (contents API is assets + inventory only).
- Inventory rows are **not links**.
- Entity-link graph (people, contractors, regulations) was dropped with `OpsModuleApp` — tour step `facilities-tour-links` still describes it and will skip.
- Tour anchors were missing on `FacilitiesApp` after PR #18 (create/search/list/detail/contents/add-asset). **This PR restores those anchors**; the links step remains skip-only.

**Modern methodology:** Facility-as-anchor is the right CMMS model. The building page should show: assets, stock, open WRs, last inspection, contractors who service it, emergency notes.

**Priority:** P0

**Next steps**

1. Add **Open work requests** (and last inspection date) to facility contents.
2. Link inventory names to `/dashboard/inventory` (same as assets → `/equipment/{id}`).
3. Do not restore a generic relationship graph until those two ops lists exist.

### Checklists — `/recreation/checklists`

**What it’s for:** Seasonal startup (arena freeze-up, pool open, playground) and onboarding lists, tied to facility + year.

**Strengths:** Progress + incomplete count; `?category=seasonal` deep link; Ask already routes “start a pool seasonal checklist.”

**Friction:** No in-UI template authoring. Facility is optional in the select but seasonal flow expects one. Native `confirm` delete. Not the same object as Routines or inspection sheets (three checklist concepts).

**Modern methodology:** Seasonal checklists as **projects with a due week**, exceptions on Attention, evidence (photo) on critical lines.

**Priority:** P0 in season, P1 off-season

**Next steps**

1. Require facility for seasonal templates; default to Arena / Aquatic Centre if only a few exist.
2. Surface incomplete seasonal lists on Attention / dashboard.
3. Keep templates API-driven (Josh should not have to design a builder).

### Emergency Response — `/recreation/emergency`

**What it’s for:** Personal readiness — counts and links for procedures, contacts, knowledge — **not** a municipal EOC.

**Strengths:** Honest scope in the header; readiness KPIs + gap callout from intelligence API; Ask routes “ammonia emergency” here vs TSBC rules to Codes & Guidance (correct split).

**Friction:** **Aggregator only** — five cards to somewhere else. Under an ammonia alarm that is too many taps. Emergency content also lives on the facility field, Knowledge category, and Training procedures.

**Modern methodology:** One-screen runbook: who to call, what to isolate, where the SOP is, where the TSBC card is. Offline-ish print/PDF already exists at `/recreation/reports/emergency-card` but is **hidden**.

**Priority:** P0

**Next steps**

1. Promote **print emergency card** onto this page.
2. Pin ammonia: primary contacts + link to internal SOP + Codes & Guidance card (not five equal cards).
3. Keep the disclaimer (personal hub ≠ city plan).

### Contractors — `/recreation/contractors`

**What it’s for:** Contractor pack — insurance, WCB, tickets, who services which plant.

**Strengths:** Compliance badges on the list; work-history link; Ask for “contractor insurance expiries”; trade placeholder mentions ammonia.

**Friction:** 20+ fields in a narrow panel; `serviced_facilities` is tags, not a facility picker; relationship IDs show UUID prefixes.

**Modern methodology:** Exception list (expired/missing COI) on the dashboard; QR or link for the contractor to upload a certificate (later).

**Priority:** P1

**Next steps**

1. List default sort: expired / missing first.
2. Facility picker instead of free-text tags.
3. Digest into Messaging / Attention (already in intelligence — **Hypothesis:** confirm Attention `contractors` tile).

### People / Contacts — `/recreation/people`, `/recreation/contacts`

**What it’s for:** Operational staff directory (not HR) and external callout list (TSBC, IH, fire, utilities).

**Strengths:** Directory chrome (People ↔ Contacts ↔ Org Chart); contact types include `technical_safety_bc` and `interior_health`.

**Friction:** `reports_to_person_id` is a **UUID paste** on People; Org Chart has a dropdown. Duplicates Team Management People. Long forms. No tap-to-call.

**Priority:** P1 (Contacts are P0 for emergency)

**Next steps**

1. Reuse the Org Chart manager dropdown on the People form.
2. `tel:` links on Contacts.
3. Treat Team Management People as HR-later; Recreation People as the ops directory (document in empty states).

### Meetings — `/recreation/meetings`

**What it’s for:** Ops meeting notes and action items.

**Friction:** No structured due dates on actions; overlaps Team Management meetings (flyout already warns).

**Priority:** P2 — Quick Notes + WR may be enough.

### Ops Knowledge — `/recreation/knowledge`

**What it’s for:** Local notes and lessons learned. Flyout: use Codes & Guidance for regulatory references.

**Friction:** “Rich text” is a textarea. Category includes Emergency Procedures (overlaps Emergency + facility field + SOPs).

**Priority:** P1 as searchable SOPs **if** Procedures stay hidden by the training milestone.

**Next steps:** Either (a) point Knowledge “Emergency Procedures” at Emergency, or (b) use Knowledge as the only local playbook until Training Learning is re-enabled. Do not keep both unlabeled.

### Ops Copilot — `/recreation/copilot`

**What it’s for:** Deterministic Q&A with citations — not an LLM. Header Ask can enhance with the same engine.

**Strengths:** Disclaimer; starter chips; ammonia vs chief-engineer routing tests.

**Friction:** Duplicate of header Ask for a solo user. Extra Recreation click.

**Priority:** Keep the engine; P2 as a separate rail item

**Next steps:** Keep Copilot as Ask’s citation backend; consider dropping the flyout row later so Recreation stays smaller.

### My Profile — `/recreation/me`

**What it’s for:** Professional operating profile (philosophy, authority matrix).

**Strengths:** Tabbed IA, blur-to-save, tour.

**Friction:** Authority table `min-w-[40rem]`. Unclear value in week-one ops.

**Priority:** P2 / Keep

### Quick Notes — `/recreation/quick-notes`

**What it’s for:** Field observations with priority and follow-up.

**Friction:** No capture FAB; follow-up does not create a planner inbox item or WR.

**Priority:** P1 — “convert to WR” would make it modern.

**Next steps:** One action: **Create work request from note**.

### Hidden Recreation surfaces (still in the product)

| Route | Purpose | Recommendation |
|-------|---------|----------------|
| `/recreation/attention` | Cross-module exception tiles + cert 30/60/90 | **P0 to surface** (dashboard or Recreation flyout) |
| `/recreation/reports` | PDF binder + emergency print card | Link from Emergency; keep hidden in rail |
| `/recreation/org-chart` | Hierarchy editor | Tab on People is enough |
| `/recreation/team-development` | Skills matrix | P2; overlaps Training |
| `/recreation/knowledge-gaps` | Open questions | P2 |
| `/recreation/planning` | Link hub to Projects/PM | Redirect or delete from IA |
| `/recreation` command center | Older hub | Keep hidden |

---

## Codes & Guidance (Reference rail) — `/recreation/regulations`

**What it’s for:** Pointers to **official public sources** (TSBC, PEBPVRSR, IH, building/fire) — not legal advice, not pasted code text.

**Strengths** (this is a Keep with polish)

- Own rail after Recreation; click goes home; hover still lists the item (PR #26).
- Amber disclaimer; classification; verification; “What to do in Pulse” pointers.
- TSBC ammonia / chief-engineer cards (PRs #24/#26); search chips; archive/restore; no boot-time auto-seed fighting Josh (`QA_REGULATORY_REFERENCE.md`).
- Full module tour; Ask phrases for ammonia, chief engineer, TSBC, ice plant.
- Empty library CTA is “add a document,” not a wall of demo content.

**Friction**

- Long create form (15+ fields) — two-step Select → Edit.
- Dense cards on phone (sticky detail, long scroll).
- Easy to confuse with Ops Knowledge and Procedures (mitigated by flyout copy if people read it).

**Modern methodology:** Searchable regulated SOP index + Pulse pointers (already the model). Keep **no copyrighted code body**.

**Priority:** Keep + P1 polish

**Next steps**

1. Default “New card” to the fields Josh actually fills (title, category, official URL, summary, Pulse pointers); hide the rest behind More.
2. Keep Ask routing as-is (emergency vs guidance split).
3. Do not auto-seed on API boot (already the rule — protect it).

---

## Communications

| Module | Route | For Josh? |
|--------|-------|-----------|
| Social Planner | `/communications/campaign-planner` | No — comms team |
| Arena Advertising | `/drawings?workspace=advertising` | Occasional (ads on boards); lives in drawings engine |
| Xplor → InDesign | `/communications/indesign-pipeline` | Publications pipeline |
| Media assets | `/communications/assets` | **No page** — registry + widget catalog only; platform shell would show Coming Soon if hit via department URL. Canonical `/communications/assets` is likely a **404**. |

**Priority:** P2 — hide the Communications rail on Vernon until a comms user exists. **Bug:** Media assets nav item without a page (P1 if the rail is on).

**Next steps:** Hide `comms_assets` or ship a stub library; do not invest in campaign planner for solo rec ops.

---

## Training — `/training/flashcards`

**What it’s for (today):** Certification **flashcard study**. `TRAINING_MILESTONE_FLASHCARDS_ONLY = true` redirects Overview / Learning / Interviews to flashcards. **Compliance remains reachable** at `/training/compliance` but is **not in the rail**.

**Strengths:** Milestone keeps the rail honest. Empty state explains packs must be imported. Tours exist for the hidden IA. Schedule training alarms are the ops payoff.

**Friction**

- Empty state shows `python -m scripts.seed_capm_training_packs` — **developer copy on an ops page**. CAPM/PMP hints are not ice-plant / NLS / Pool Operator.
- Procedures / acknowledgments / qualification matrix — the actual municipal training system — are **hidden**. Attention still links `/standards/procedures`.
- Solo admin cannot “run training” without a Leif import.

**Modern methodology:** Competency-gated scheduling + expiry digest (30/60/90 already on Attention’s `CertificationExpiryPanel`). Flashcards are a study aid, not the system of record.

**Priority:** P1 (certs are weekly/seasonal risk); milestone Keep until rec packs exist

**Next steps**

1. Replace CLI empty copy with **Manage decks → Import** only; add a sentence that recreation tickets are tracked under Attention / Compliance when enabled.
2. Decide: re-enable **Compliance** in the Training flyout (expiring NLS/first aid) **without** opening the whole learning hub.
3. Do not seed CAPM into Vernon.

---

## Team Management — `/team-management`

**What it’s for:** Manager workspace — roster health, performance, growth, workforce planning, 1:1s.

**Strengths:** One rail row; six internal sections; People described as HR source of truth.

**Friction:** Duplicate People vs Recreation People. Many sub-routes are `(soon)` placeholders (`TeamManagementFuturePage`). Overview “training expiring” is an em dash (not wired). Deprecated hub still has mock metrics if referenced.

**Priority:** P2 for a solo coordinator (Josh **is** the team). Permissions/roster still needed (see Administration).

**Next steps:** Leave the hub; don’t build hiring/recognition. Wire expiring certs from the same source as Attention or hide the tile.

---

## Assets

### Inventory — `/dashboard/inventory`

**What it’s for:** Parts, consumables, tools — stock, vendors, queue, QR, usage on WRs.

**Strengths:** Unified workspace tabs; WR usage on the item; scanner kiosk; setup wizard; facility link (`ops_facility_id`); low-stock widget + notifications. Purchasing folded in (legacy routes redirect). Enterprise roadmap already drafted.

**Friction:** 8–10 tabs + Issue/Receive/Kiosk as **separate routes**. Jargon (material requests, register form). Setup wizard auto-opens until dismissed. Scanner hidden from sidebar for people who already have Inventory (header kiosk) — good, but easy to miss.

**Modern methodology:** QR-at-bin, issue to WR, exception queue for below-min. Mobile kiosk is the round tool; desktop is replenishment.

**Priority:** P0 for stock used on ice plant / pool chemicals

**Next steps**

1. Default tab = List + a badge on Queue when something is below min (don’t make Josh visit Analytics).
2. Clickable inventory from Facilities (see Facilities).
3. Follow `docs/inventory-enterprise-roadmap.md` for PM BOM auto-decrement **later** (P2).

### Scanner — `/kiosk/inventory-scanner`

**What it’s for:** Full-screen issue/receive. Sidebar only for scan-only accounts.

**Priority:** Keep. Next step: document the header “Scanner kiosk” button on Inventory so Josh finds it.

### Equipment — `/equipment`

**What it’s for:** Asset registry — PMs, parts, service history, facility link, QR.

**Strengths:** PM tasks + parts banners with **Create work request**; history merges replacements + WOs; Ask “Where do I add a PM for the ice plant?”; `?create=1&ops_facility_id=`. Backend PM due scan can auto-create WOs.

**Friction:** PM auto-WO is cron/`auto_create_work_order` — not obvious in UI. List is desktop-first. Pulse dashboard “equipment” beacons are a different concept (**Hypothesis:** naming collision in older dashboards).

**Modern methodology:** Asset history + PM on the record (already). QR on the chiller → history + new WR. Competency: only qualified assignees on ice-plant WRs (Copilot prompt `qualified-ice-plant` exists).

**Priority:** P0

**Next steps**

1. On the PM task, show **next due** and **last WO** in one line; explain auto-create in plain language.
2. Ice-plant asset: pin TSBC card + Emergency + contractor pack links (Codes & Guidance already points at Equipment).
3. Keep Equipment as the only place to create PMs (see Work Requests).

---

## Maps (Visuals rail)

| Module | Route | Notes |
|--------|-------|-------|
| Infrastructure maps | `/drawings?workspace=infrastructure` | Spatial engine; SSR off — blank flash |
| Facility drawings | `/drawings?workspace=facilities` | Drawings, not the Facilities master list (labels already split — Keep) |
| Live Map | `/live-map` | Hardware + demo tabs; honest empty |
| Zones & Devices | `/devices` | IoT setup; feels disconnected from Maps |

**Priority:** P2 until drawings are how Josh navigates the plant. Facility drawings are **Keep** as a label split.

**Next steps:** Don’t put Live Map on the morning board without beacons. Optional: “Open facility record” from a drawing.

---

## Administration

### Permissions — `/dashboard/permissions`

**What it’s for:** Roster, role matrix, per-worker feature toggles, access debug.

**Strengths:** Setup wizard, access debug, matrix slot labeling (Explicit / Inferred / Unresolved).

**Friction:** ~4,300-line `WorkersApp`. Wizard auto-opens until `permissions_setup_completed`. Inference noise for a one-person org. **Three people surfaces:** this page, Settings → Workers, Team Management People.

**Priority:** P0 to **quiet**, not to feature-add

**Next steps**

1. After first complete setup, never auto-reopen the wizard; a banner is enough.
2. Solo-admin preset: one role “Recreation coordinator” with the eight daily modules — hide unused matrix rows behind “Show all modules.”
3. Keep Access debug (Leif).

### Settings — `/settings` (header cog; **not** in the live sidebar)

**What it’s for:** Org config tabs: General, Work Requests, Schedule, Workers, Zones, Automation, Compliance, Notifications, Gamification. Per-section save. `?tab=` deep links.

**Friction:** Registry lists Settings under Administration, but `tenantSidebarNavItemsForLiveApp` **strips** `/settings`. Cog in the header is the real entry. Page requires `canAccessCompanyConfiguration` even though registry `rbacAnyOf` is empty. Gamification is not municipal ops.

**Priority:** P1 discoverability

**Next steps**

1. Either put Settings back in the Administration flyout **or** drop it from the registry so debug tools stop lying.
2. Hide Gamification on Vernon.
3. WR SLA / notification toggles: document which ones feed the header bell.

---

## Cross-cutting themes

### Ask / Search (`Ctrl/⌘K`)

**Keep.** Catalog is already written in Josh’s language (ice plant PM, seasonal checklist, contractor insurance, ammonia emergency vs TSBC). Access-filtered. Copilot citations are an enhancer.

**Friction:** Dual label “Ask / Search.” Copilot skip if Recreation is off. No-results copy is thin.

**Next steps:** Add examples for “expired first aid” → Attention/Training Compliance; “open WRs at the arena” → WR filtered by facility **when facility filter exists**.

### Tours

Dedicated walkthroughs: Dashboard, WR, Inspections, Inventory, Equipment, Regulations, Facilities (anchors restored in this PR), My Profile, Planner, Training (partly unreachable in milestone). Generic toolbar tours: Schedule, Projects.

**Friction:** Missing DOM anchors skip silently. Facilities **linked records** step is stale. Training Overview/Learning tours are dead while the milestone is on.

**Next steps:** Treat skipped steps as a CI lint for high-traffic modules. Don’t write tours for hidden Training routes until the milestone lifts.

### Dashboard widgets

WR quieter tiles are the right visual language (`frontend/docs/UI_SYSTEM.md`). Custom peek widgets still look older (**Hypothesis:** mixed chrome if both are on the board). Monitoring/pool widgets should stay off until live.

**Next steps:** One widget visual language; exception widgets over vanity KPIs.

### Loading / empty states

No shared `EmptyState`. Best: Facilities, Codes & Guidance, Flashcards (content), Projects `HintCallout`. Weak: WR list, generic “Loading…”, department dashboards, Flashcards CLI.

**Next steps:** Adopt Facilities-style empty states (what + one button) on WR, Equipment, Contractors.

### Permissions noise (solo admin)

Contract features + enabled_features + RBAC anyOf + department workspaces + PM user toggle + dashboard matrix keys. Full admin bypasses most checks **after** the contract is on — but the **UI still explains the matrix**.

**Next steps:** Vernon “coordinator” preset; stop showing Inferred/Unresolved on a one-row roster.

### Notifications

Header bell (90s poll) + Messaging inbox + product megaphone tip. Training alarms are toasts. No single digest for “your day.”

**Next steps:** Bell = Attention + WR overdue + low stock + cert/COI expiry. Don’t add Slack until that list is trusted.

### Create / edit consistency

| Pattern | Where |
|---------|--------|
| List + detail + Save | Facilities, Codes & Guidance, OpsModuleApp |
| Drawer create | WR, Inventory |
| In-tab form | Equipment |
| Blur-to-save | My Profile, Team Dev |
| Wizard | Inventory setup, Routines, Permissions |

Josh will feel this. **Don’t unify everything**; do unify **Ops Knowledge vs Codes & Guidance vs Procedures** copy so create intent is obvious: official URL vs local note vs acknowledgeable SOP.

### Facility-as-anchor

Direction is correct (`ops_facility_id` on equipment and inventory; Ask “assets at…”). Incomplete: WRs, inspections, contractors, schedule zones. Zones are still a parallel location model (WR Locations + Settings → Zones).

**Hypothesis:** Zone vs facility double entry will be Josh’s first data-quality fight.

**Next steps:** Map zones **onto** facilities (Arena ice, Arena plant, Pool deck) rather than a second building list.

### Mobile / kiosk / offline-ish

Plant-floor reality: phone or kiosk. Today: Inventory scanner kiosk is real; WR table is not; inspections are fill-modals; emergency print card is hidden; Live Map is hardware-dependent.

**Next steps (P1):** “My work” + inspection run + emergency card as the mobile three. QR on equipment/inventory already in product — use them for rounds before building a new app.

---

## Suggested 30 / 60 / 90 day roadmap

Sized for **Josh using Vernon** plus **small product slices** — not a platform rewrite.

### First 30 days — daily pain

1. **Home board:** Vernon default widgets = WR KPIs (fix Unassigned label) + overdue list, low stock, Attention/certs, important dates. Hide unused department rails if contract allows.
2. **PM path:** Remove/hide deprecated preventative rules on WR; Equipment is the only PM create surface; one sentence in Ask stays correct.
3. **Facility panel:** Open WRs + clickable inventory (small API/UI).
4. **Emergency:** Print card + ammonia pin on Emergency Response.
5. **Permissions:** Stop auto-wizard; coordinator preset or “show all” collapse.
6. **Copy:** Flashcards empty state without Python; Messaging → Ops inbox (label).
7. **Protect:** No regulatory auto-seed; keep Codes & Guidance disclaimer.

Josh’s own 30-day data (manual, as he prefers): Arena + Aquatic Centre facilities; ice plant + pool assets; refrigeration contractor pack; 3–5 Codes & Guidance cards he actually uses; seasonal checklist for the current season.

### Days 31–60 — weekly loops

1. Inspection persist/badge + WR filter “from inspection” + reinspect prompt.
2. Contractor expiry first in list + Attention/bell.
3. Training alarm sourced from rec certs **or** Compliance flyout row for expiries only.
4. Seasonal checklist incomplete → Attention.
5. Quick Note → Create WR.
6. Settings visible in Administration flyout **or** registry honesty.
7. Media assets 404 if Communications rail is on.

### Days 61–90 — modern methodology without a new product

1. QR round: scan asset → history / WR / inspection sheet (plumbing exists in pieces).
2. Facility = zones parent (stop double locations).
3. Knowledge decision tree implemented in empty states (not a new module).
4. Monitoring threshold → bell/WR **only if** hardware is real.
5. Mobile “My work today” for WR.
6. Re-evaluate Training milestone: if rec decks exist, lift Compliance into the rail; keep flashcards as study.

**Not in 90 days:** Communications suite, Live Map hardware program, Team Management hiring, Operational Improvements value-stream, Gantt PM expansion, auto-seeded demo buildings.

---

## What this PR changed in code

Audit-only, plus one **tiny, safe** fix found while verifying Facilities tours:

- Restored `data-tour` anchors on `FacilitiesApp` (`create`, `search`, `list`, `detail`, `contents`, `add-asset`) so the existing Facilities walkthrough can spotlight the real UI. The **Linked records** step still skips (graph not on this page).

No module redesigns.

---

## Appendix A — Nav-visible inventory (fully licensed admin)

Useful as a checklist against the Vernon contract. Hidden aliases omitted.

**Dashboards:** Leadership dashboard, Operations dashboard; department dashboards appear under Communications / Aquatics / Reception / Fitness / Racquets / Administration when those departments are on the tenant.

**Planning:** Schedule, Projects.

**Operations:** Work Requests, Logs & Inspections, Operational Improvements, Monitoring, Routines, Messaging.

**Recreation:** Daily Planner, Checklists, Emergency Response, Ops Copilot, My Profile, Ops Knowledge, Meetings, People, Contractors, Facilities, Quick Notes, Contacts.

**Codes & Guidance:** Codes & Guidance.

**Communications:** Social Planner, Arena Advertising, Xplor → InDesign, Media assets.

**Training:** Flashcards.

**Team Management:** Team Management.

**Assets:** Inventory, Scanner, Equipment.

**Maps:** Infrastructure maps, Facility drawings, Live Map, Zones & Devices.

**Administration:** Permissions (Settings stripped from live rail).

---

## Appendix B — Closed-loop map (as of this audit)

| From → To | Status |
|-----------|--------|
| Inspection fail → WR | **Live** (API + panel) |
| WR complete → re-inspection | Missing |
| Inspection → new PM | Missing |
| Equipment PM due → WR | Backend scan / flag; UI weak |
| WR complete → PM next due | Backend sync; confirm UI |
| Equipment part overdue → WR | Deep-link create |
| Inventory issue → WR | Manual “Use in WR” |
| Low stock → bell / dashboard | Live |
| Monitoring out of range → WR | Missing (mock data) |
| Routine miss → WR | Missing |
| Schedule assign → training alarm | Live (credential source TBD) |
| Facility → equipment / inventory | Live |
| Facility → open WRs | Missing |
| Codes & Guidance → Pulse pointers | Live |
| Ask → module + Copilot | Live |

---

## Appendix C — Evidence index (entry files)

| Area | Primary files |
|------|----------------|
| Registry / IA | `frontend/config/platform/master-feature-registry.ts`, `nav-domains.ts`, `frontend/lib/navigation/build-navigation-tree.ts`, `frontend/lib/rbac/tenant-nav.ts`, `session-access.ts` |
| Ask | `frontend/lib/search/ops-destination-catalog.ts`, `OpsAskPalette.tsx` |
| Dashboard / WR widget | `OperationalDashboard.tsx`, `NotificationsWorkOrdersOpsWidget.tsx`, `kpi-summary.ts` |
| Work Requests | `WorkRequestsApp.tsx`, `MaintenanceWorkHub.tsx`, `PreventativeMaintenanceApp.tsx` |
| Inspections | `InspectionsLogsApp.tsx`, `InspectionCorrectivePanel.tsx` |
| Schedule | `ScheduleApp.tsx`, `AssignmentTrainingAlarmBadge.tsx` |
| Facilities | `FacilitiesApp.tsx` |
| Codes & Guidance | `RegulatoryReferenceApp.tsx`, `backend/app/core/regulatory_reference_catalog.py` |
| Recreation hubs | `app/recreation/**`, `OpsModuleApp.tsx`, `ops-modules.ts` |
| Training milestone | `training-milestone.ts`, `FlashcardCoursePicker.tsx` |
| Inventory / Equipment | `InventoryApp.tsx`, `EquipmentDetailApp.tsx`, `inventory-workspace-nav.ts` |
| Tours | `feature-page-tour-steps.ts`, `tour-steps/facilities.ts` |
