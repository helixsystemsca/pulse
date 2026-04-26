# Pulse · Architecture Contracts
> This is a RULEBOOK, not documentation.
> All AI tools and developers MUST follow these rules exactly.
> When in doubt: follow this file over assumptions.

---

## 1. BACKEND — ROUTE RULES

### File naming
- `backend/app/api/{resource}_routes.py`
- One router per resource domain
- Examples: `work_requests_routes.py`, `devices_routes.py`, `telemetry_positions_routes.py`

### Router declaration
```python
router = APIRouter(prefix="/resource-name", tags=["resource-name"])
```
- prefix: kebab-case
- tags: match prefix exactly

### Registration in main.py
```python
from app.api.{resource}_routes import router as {resource}_router
app.include_router({resource}_router, prefix="/api/v1")
```
- ALL routers use prefix `/api/v1`
- Exception: `public_router` → `/api/public`, `system_router` → `/api/system`

### Route handler rules
- NO business logic in route handlers
- Routes ONLY: validate input, call service/query, return response
- All DB queries that are more than a simple `.get()` belong in a service or inline async function within the route file — NOT in the handler body
- Max handler body: 30 lines. If longer, extract to service.

### Dependency injection — use ONLY these from `app.api.deps`:
```python
# Auth
get_current_user              # any authenticated user
get_current_company_user      # tenant users only (not system_admin)
require_company_admin         # company_admin OR system_admin
require_manager_or_above      # manager, supervisor, company_admin, system_admin
require_system_admin          # system_admin only

# Infrastructure
get_db                        # AsyncSession
```

### Annotated dependency pattern (MANDATORY):
```python
async def my_route(
    db:   Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> MyResponseSchema:
```
- NEVER use `user: User = Depends(get_current_user)` (old style)
- ALWAYS use `Annotated[Type, Depends(...)]`

### Company scoping (MANDATORY for all tenant data):
```python
company_id = str(user.company_id)
# Use company_id in EVERY query that touches tenant data
```

---

## 2. DATABASE — MODEL RULES

### Base class
```python
from app.models.base import Base
class MyModel(Base):
    __tablename__ = "my_models"
```

### Primary key (MANDATORY):
```python
def _uuid() -> str:
    return str(uuid4())

id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
```
- ALL PKs are UUID strings
- NEVER use integer PKs for new models

### Company FK (MANDATORY on all tenant-scoped models):
```python
company_id: Mapped[str] = mapped_column(
    UUID(as_uuid=False),
    ForeignKey("companies.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
)
```

### Timestamps:
```python
created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), nullable=False, server_default=text("now()")
)
updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), nullable=False, server_default=text("now()"),
    onupdate=lambda: datetime.now(timezone.utc),
)
```
- `created_at` is MANDATORY on all new models
- `updated_at` is MANDATORY on any model that gets PATCH/PUT endpoints

### Column annotations (MANDATORY style):
```python
# Use Mapped[] + mapped_column() — NEVER old Column() style
name: Mapped[str] = mapped_column(String(255), nullable=False)
notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
```

### Table naming:
- snake_case, plural: `work_requests`, `beacon_positions`, `automation_gateways`
- Module prefix for grouped tables: `pulse_*`, `automation_*`, `pm_*`

### Relationships: declare only when actively used in queries. No eager-loaded relationships on hot-path models.

---

## 3. SCHEMAS — PYDANTIC RULES

### File location: `backend/app/schemas/{resource}.py`

### Schema naming:
- Input (POST body): `{Resource}CreateIn` or `{Resource}In`
- Patch body: `{Resource}PatchIn`
- Response (single): `{Resource}Out` or `{Resource}DetailOut`
- Response (list row): `{Resource}RowOut`

### All response schemas MUST have:
```python
model_config = ConfigDict(from_attributes=True)
```

### Never expose internal fields in Out schemas:
- No `hashed_password`, `ingest_secret_hash`, or raw FK UUIDs unless explicitly needed

---

## 4. MIGRATIONS — ALEMBIC RULES

### File naming:
```
{NNNN}_{short_description}.py
```
- NNNN = next sequential number (check existing versions)
- Example: `0068_beacon_positions_zone_polygon.py`

### revision/down_revision MUST be set correctly:
```python
revision      = "0068_beacon_positions"
down_revision = "0067_proc_rev_kind"   # exact head from `alembic heads`
```

### Every migration MUST have both `upgrade()` and `downgrade()`

### Never use `alembic.autogenerate` in production — write explicit `op.create_table` / `op.add_column`

---

## 5. FRONTEND — COMPONENT RULES

### File location:
```
frontend/components/{module}/          # feature components
frontend/components/ui/               # shared primitives (PageHeader, DataTable, etc.)
frontend/app/{route}/page.tsx         # Next.js App Router pages
frontend/lib/                         # utilities, API service functions, types
frontend/hooks/                       # custom React hooks
```

### Page file pattern (MANDATORY — matches all existing module pages):
```tsx
"use client";
import { useEffect, useState } from "react";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

export default function MyPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSession();
    if (!s) { navigateToPulseLogin(); return; }
    if (isApiMode() && !s.access_token) { navigateToPulseLogin(); return; }
    setReady(true);
  }, []);

  if (!ready) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-ds-muted">Loading…</p>
    </div>
  );

  return <MyFeatureApp />;
}
```

### Page header (MANDATORY — every module page):
```tsx
import { PageHeader } from "@/components/ui/PageHeader";
import { MyIcon } from "lucide-react";

<PageHeader
  title="Module Name"
  description="One-line description of what this module does."
  icon={MyIcon}
/>
```

### Tab navigation (MANDATORY style — matches Equipment, Schedule, Work Requests):
```tsx
<nav className="flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1">
  <button
    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      tab === id
        ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
        : "border-b-2 border-transparent text-ds-muted hover:bg-ds-primary hover:text-ds-foreground"
    }`}
  >
    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
    Label
  </button>
</nav>
```

### API calls (MANDATORY):
```tsx
import { apiFetch } from "@/lib/api";

// Always async/await, always typed
const data = await apiFetch<MyResponseType>("/api/v1/resource");
const result = await apiFetch<MyOut>("/api/v1/resource", {
  method: "POST",
  body: JSON.stringify(payload),
});
```
- NEVER use `fetch()` directly
- NEVER use axios
- ALWAYS use `apiFetch` from `@/lib/api`

### State management:
- Local component state only (`useState`, `useCallback`, `useEffect`)
- No global state library (no Redux, Zustand, etc.)
- Shared data: pass as props or lift to nearest common ancestor
- Server state: fetch in component, store in `useState`

### Design tokens (MANDATORY — no hardcoded colors):
```
ds-foreground    ds-muted         ds-border        ds-primary
ds-secondary     ds-success       ds-accent        ds-bg
ds-btn-solid-primary              ds-btn-secondary
app-field        app-badge-emerald  app-badge-amber  app-badge-slate
```
- NEVER use hardcoded colors like `bg-slate-950`, `text-gray-600`, `border-zinc-200`
- NEVER use custom dark backgrounds inside pages — the app shell handles theming

### Button classes:
```tsx
const PRIMARY_BTN   = "ds-btn-solid-primary px-5 py-2.5 text-sm disabled:opacity-50";
const SECONDARY_BTN = "ds-btn-secondary px-5 py-2.5 text-sm disabled:opacity-50";
```

### Module settings gear (add to every module page that has settings):
```tsx
import { ModuleSettingsGear } from "@/components/module-settings/ModuleSettingsGear";
<ModuleSettingsGear moduleId="assets" label="Equipment organization settings" />
```

---

## 6. NAMING CONVENTIONS

### Backend
| Thing | Convention | Example |
|-------|-----------|---------|
| Route file | `{resource}_routes.py` | `work_requests_routes.py` |
| Service file | `{resource}_service.py` | `pm_task_service.py` |
| Schema file | `{resource}.py` in schemas/ | `work_requests.py` |
| Model class | PascalCase | `PulseWorkRequest` |
| Table name | snake_case plural | `pulse_work_requests` |
| Router prefix | kebab-case | `/work-requests` |
| Endpoint path | kebab-case | `/api/v1/ble-devices/unknown` |
| Python variable | snake_case | `company_id`, `work_request` |

### Frontend
| Thing | Convention | Example |
|-------|-----------|---------|
| Component file | PascalCase.tsx | `EquipmentApp.tsx` |
| Page file | always `page.tsx` | `app/equipment/page.tsx` |
| Hook file | camelCase, `use` prefix | `usePulseWs.ts` |
| Lib file | camelCase | `equipmentService.ts` |
| Type/interface | PascalCase | `FacilityEquipmentRow` |
| CSS class | kebab-case | `ds-btn-solid-primary` |
| Route path | kebab-case | `/live-map`, `/work-requests` |

---

## 7. FILE / FOLDER STRUCTURE

```
backend/
  app/
    api/              # HTTP layer — routes only
      deps.py         # ONLY place for dependency injection helpers
    core/             # Platform infrastructure (event bus, auth, inference, config)
      auth/
      events/
      features/
      inference/
    models/           # SQLAlchemy ORM models only
    schemas/          # Pydantic in/out schemas only
    services/         # Business logic
      automation/
      devices/
    modules/          # Feature-flagged product modules
  alembic/
    versions/         # One file per migration, numbered sequentially

frontend/
  app/                # Next.js App Router pages (page.tsx only)
  components/
    ui/               # Shared primitives (PageHeader, DataTable, Card, etc.)
    {module}/         # Feature-specific components
  hooks/              # Custom React hooks
  lib/                # Utilities, API clients, type definitions
  providers/          # React context providers

hardware/             # ESP32 firmware (.ino files)
rpi5/                 # Raspberry Pi position engine scripts
_cursor_prompts/      # Cursor execution queue files
handoff/              # integration.md for current session
architecture/         # This file and future architecture docs
```

---

## 8. INTEGRATION RULES

### Adding a new feature:
1. Create migration if DB changes needed
2. Add/update model in `models/`
3. Add schema in `schemas/`
4. Add service logic in `services/` if non-trivial
5. Add route file in `api/`
6. Register router in `main.py`
7. Add frontend service function in `lib/`
8. Add page component in `components/{module}/`
9. Add page file in `app/{route}/page.tsx`
10. Add nav item in `lib/pulse-app.ts` if needed

### What MUST NOT be modified when adding a feature:
- `app/api/deps.py` — add new deps only if genuinely required; never modify existing ones
- `app/core/auth/` — no changes without explicit security review
- `app/models/base.py` — never modify
- Any existing migration file — only add new ones
- Existing schema Out classes — extend with Optional fields only; never remove fields

### Blast radius rule:
- A feature change touches AT MOST: its own route file, its own schema file, its own service file, its own model (additive only), and one migration
- If a change requires modifying more than 5 existing files: STOP and design differently

---

## 9. REUSE RULES

### MANDATORY reuse — never duplicate:
- Auth: always `deps.py` dependencies — never re-implement token parsing
- DB session: always `get_db` from deps — never create sessions manually
- API calls: always `apiFetch` from `@/lib/api` — never raw `fetch()`
- Config: always `ConfigService` from `app/services/config_service.py`
- Company scoping: always check `user.company_id` — never trust client-supplied company_id without verification
- Events: always `event_engine.publish(DomainEvent(...))` — never call service functions across module boundaries directly

### Before writing any utility: search for it first.
- `grep -rn "function_name" backend/app/`
- If it exists: reuse it

---

## 10. ERROR HANDLING RULES

### Backend — raise HTTPException only:
```python
raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="resource_not_found")
raise HTTPException(status_code=400, detail="Human-readable description of the problem")
raise HTTPException(status_code=403, detail="Permission description")
```
- `detail` is a string — NEVER a dict unless the route explicitly documents it
- Use `status.HTTP_*` constants for 4xx/5xx — not raw integers (exception: 400/422 may use raw)
- NEVER let unhandled exceptions propagate from route handlers — catch and re-raise as HTTPException

### Frontend — handle all apiFetch calls:
```tsx
try {
  const data = await apiFetch<T>("/api/v1/resource");
  setData(data);
} catch (err) {
  setError(err instanceof Error ? err.message : "Something went wrong");
}
```
- ALWAYS have a try/catch around apiFetch
- ALWAYS surface errors to the user via state (never swallow silently)
- Use `setError(string)` pattern consistently — renders as `text-ds-error` or similar

### Logging — backend only:
```python
log = logging.getLogger("pulse.{module_name}")
log.info("action company=%s entity=%s", company_id[:8], entity_id[:8])
log.warning("unexpected_state detail=%s", detail)
log.error("critical_failure: %s", str(e))
```
- Logger name: always `pulse.{module}` (e.g. `pulse.telemetry`, `pulse.inference`)
- NEVER log full UUIDs — truncate to `[:8]`
- NEVER log PII (names, emails, phone numbers)

---

## 11. DOMAIN EVENT RULES

### Publishing events:
```python
from app.core.events.engine import event_engine
from app.core.events.types import DomainEvent

await event_engine.publish(DomainEvent(
    event_type="module.action_past_tense",   # e.g. "ops.work_request_assigned"
    company_id=str(company_id),
    entity_id=str(entity_id),
    source_module="module_name",
    metadata={ ... },
))
```
- `id=` is NOT a valid field — DomainEvent uses `correlation_id` (auto-generated)
- `company_id` MUST be a string, not UUID object
- `event_type` format: `{module}.{verb_past_tense}`

---

## 12. AI ENFORCEMENT RULES

These rules apply to Claude, Cursor, and any AI tool working in this codebase.

### MUST follow:
- Follow this file (`architecture/contracts.md`) over any assumption or training pattern
- Reuse existing patterns — do NOT invent new ones
- Check if a utility/service/component exists before creating a new one
- Write `# TODO: {reason}` instead of guessing at implementation details
- Keep changes within the declared scope — no opportunistic refactoring

### MUST NOT do:
- Modify `deps.py`, `base.py`, any existing migration, or `app/core/auth/`
- Use `fetch()` directly in frontend — only `apiFetch`
- Add `id=` parameter to `DomainEvent()` — it does not exist
- Use hardcoded colors or custom dark themes in frontend pages
- Create new state management libraries or patterns
- Duplicate logic that already exists in a service
- Refactor code outside the scope of the current task
- Skip the auth guard pattern in new `page.tsx` files
- Commit code that does not pass `cd frontend && npm run build`

### BEFORE writing any new file:
1. Check if a similar file already exists
2. Check if an existing service can be extended
3. Check this contracts.md for the correct pattern
4. If the pattern is unclear: write `TODO: clarify pattern` and flag it

### integration.md rules:
- Every FILE CREATION block must specify the EXACT destination path
- Every MODIFY block must include a FIND + REPLACE or exact line reference
- Validation checklist MUST include `npm run build passes`
- Never reference a component that has not been confirmed to exist in the repo

---

*Pulse / Helix Systems · Last updated: 2026-04-26*
*Source of truth: this file supersedes any inline comments or AI assumptions*
