"""Per-user modal onboarding completion (non-admin tour), distinct from org admin checklist."""
from alembic import op

from pathlib import Path
import sys

_BACK = Path(__file__).resolve().parents[2]
if str(_BACK) not in sys.path:
    sys.path.insert(0, str(_BACK))
import alembic_helpers as ah  # noqa: E402

import sqlalchemy as sa
revision = '0054'
down_revision = '0053'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    ah.safe_add_column(op, conn, 'users', sa.Column('user_onboarding_tour_completed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.execute(sa.text('\n            UPDATE users\n            SET user_onboarding_tour_completed = true\n            WHERE company_id IS NOT NULL\n              AND onboarding_seen IS true\n              AND COALESCE(is_system_admin, false) IS false\n            '))

def downgrade() -> None:
    conn = op.get_bind()
    ah.safe_drop_column(op, conn, 'users', 'user_onboarding_tour_completed')
