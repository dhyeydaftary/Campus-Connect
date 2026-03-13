"""add personal_email to users

Revision ID: 00d9af6fcc09
Revises: b97bff486393
Create Date: 2026-03-14 00:13:30.591031

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '00d9af6fcc09'
down_revision = 'b97bff486393'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('personal_email', sa.String(length=120), nullable=True))


def downgrade():
    op.drop_column('users', 'personal_email')