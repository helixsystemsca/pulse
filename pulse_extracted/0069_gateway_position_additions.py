"""
Gateway position field additions
══════════════════════════════════
Two small code changes needed alongside migration 0069.
Paste these into Cursor on May 4.
"""

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1 — backend/app/models/device_hub.py
# Add two columns to AutomationGateway, after the ingest_secret_hash column:
# ─────────────────────────────────────────────────────────────────────────────

# Find this in AutomationGateway:
#     ingest_secret_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
#
# Add immediately after:

x_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
y_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

# Make sure Float is imported at the top of device_hub.py:
# from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, text


# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2 — backend/app/api/devices_routes.py  (or wherever GatewayOut is defined)
# Add x_norm and y_norm to the GatewayOut response schema:
# ─────────────────────────────────────────────────────────────────────────────

# Find the GatewayOut Pydantic schema (may be in devices_routes.py or a schemas file).
# Add two optional fields:

# x_norm: Optional[float] = None
# y_norm: Optional[float] = None

# This makes the position engine's bootstrap call work — it reads these fields
# from GET /api/v1/gateways to build its trilateration map.


# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3 — backend/app/api/devices_routes.py
# Add x_norm and y_norm to the PATCH /gateways/:id endpoint body:
# ─────────────────────────────────────────────────────────────────────────────

# Find the GatewayPatchBody (or whatever the PATCH body schema is called).
# Add:

# x_norm: Optional[float] = None
# y_norm: Optional[float] = None

# And in the patch handler, include them in the update:
# if body.x_norm is not None: gateway.x_norm = body.x_norm
# if body.y_norm is not None: gateway.y_norm = body.y_norm

# This lets the Devices tab UI (future: drag-to-place on floor plan) save
# gateway positions without needing to touch Supabase directly.


# ─────────────────────────────────────────────────────────────────────────────
# CURSOR PROMPT — paste this on May 4
# ─────────────────────────────────────────────────────────────────────────────

CURSOR_PROMPT = """
In backend/app/models/device_hub.py, find the AutomationGateway class and add
two new columns after the ingest_secret_hash column:

    x_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    y_norm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

Make sure Float is imported from sqlalchemy at the top of the file.

Then find wherever GatewayOut is defined as a Pydantic schema (check
devices_routes.py or a schemas/ folder). Add two optional fields to it:
    x_norm: Optional[float] = None
    y_norm: Optional[float] = None

Then find the PATCH /gateways/{gateway_id} endpoint. Add x_norm and y_norm
to its request body schema (both Optional[float] = None). In the handler body,
update the gateway row if these values are provided:
    if body.x_norm is not None: gateway.x_norm = body.x_norm
    if body.y_norm is not None: gateway.y_norm = body.y_norm

Do not change anything else.
"""
