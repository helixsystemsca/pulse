"""Optional matrix display override for procedure training assignments (company admin)."""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

revision = '0111_training_matrix_override'
down_revision = '0110_procedure_verification'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'pulse_procedure_training_assignments', sa.Column('matrix_admin_override', sa.String(length=20), nullable=True))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'pulse_procedure_training_assignments', 'matrix_admin_override')
