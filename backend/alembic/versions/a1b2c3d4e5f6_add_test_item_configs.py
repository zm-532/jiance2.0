"""add test_item_configs and photo incremental fields

Revision ID: a1b2c3d4e5f6
Revises: 8595a3a51bd4
Create Date: 2026-06-22 09:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8595a3a51bd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 新建 test_item_configs 表
    op.create_table('test_item_configs',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('device_name', sa.String(length=100), nullable=False),
        sa.Column('device_key', sa.String(length=50), nullable=False),
        sa.Column('sample_name', sa.String(length=100), nullable=False),
        sa.Column('material_spec', sa.String(length=200), nullable=True),
        sa.Column('judgment_standard', sa.String(length=100), nullable=True),
        sa.Column('group_key', sa.String(length=100), nullable=False),
        sa.Column('group_item_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('test_item', sa.String(length=200), nullable=False),
        sa.Column('sub_item', sa.String(length=200), nullable=True),
        sa.Column('judgment_indicator', sa.String(length=200), nullable=True),
        sa.Column('test_standard', sa.String(length=100), nullable=True),
        sa.Column('extraction_rule', sa.JSON(), nullable=False),
        sa.Column('aggregation_method', sa.String(length=20), nullable=False, server_default='average'),
        sa.Column('sample_count', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('needs_subtable', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('report_section', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_test_item_configs_device_key', 'test_item_configs', ['device_key'])
    op.create_index('ix_test_item_configs_group_key', 'test_item_configs', ['group_key'])
    op.create_index('ix_test_item_configs_sample_name', 'test_item_configs', ['sample_name'])

    # photos 表增量字段（全部 nullable，向后兼容）
    op.add_column('photos', sa.Column('device_key', sa.String(length=50), nullable=True))
    op.add_column('photos', sa.Column('group_id', sa.String(length=50), nullable=True))
    op.add_column('photos', sa.Column('config_id', sa.String(length=50), nullable=True))
    op.add_column('photos', sa.Column('result_values', sa.JSON(), nullable=True))
    op.add_column('photos', sa.Column('frequency_data', sa.JSON(), nullable=True))
    op.create_index('ix_photos_device_key', 'photos', ['device_key'])
    op.create_index('ix_photos_group_id', 'photos', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_photos_group_id', table_name='photos')
    op.drop_index('ix_photos_device_key', table_name='photos')
    op.drop_column('photos', 'frequency_data')
    op.drop_column('photos', 'result_values')
    op.drop_column('photos', 'config_id')
    op.drop_column('photos', 'group_id')
    op.drop_column('photos', 'device_key')

    op.drop_index('ix_test_item_configs_sample_name', table_name='test_item_configs')
    op.drop_index('ix_test_item_configs_group_key', table_name='test_item_configs')
    op.drop_index('ix_test_item_configs_device_key', table_name='test_item_configs')
    op.drop_table('test_item_configs')
