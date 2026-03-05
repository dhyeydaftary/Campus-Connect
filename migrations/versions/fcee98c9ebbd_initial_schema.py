"""initial_schema

Revision ID: fcee98c9ebbd
Revises: 
Create Date: 2026-03-05 16:41:08.545691

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fcee98c9ebbd'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # === USERS (root table — no FK dependencies) ===
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(120), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('is_password_set', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('enrollment_no', sa.String(50), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('first_name', sa.String(50), nullable=False),
        sa.Column('last_name', sa.String(50), nullable=False),
        sa.Column('profile_picture', sa.String(500), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('university', sa.String(100), nullable=False),
        sa.Column('major', sa.String(100), nullable=False),
        sa.Column('batch', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('account_type', sa.String(20), nullable=False, server_default='student'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('PENDING', 'ACTIVE', 'BLOCKED')", name='user_status_check'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('enrollment_no'),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_enrollment_no', 'users', ['enrollment_no'])
    op.create_index('ix_users_university', 'users', ['university'])
    op.create_index('ix_users_major', 'users', ['major'])

    # === OTP_VERIFICATIONS (FK → users.enrollment_no) ===
    op.create_table('otp_verifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('enrollment_no', sa.String(50), nullable=False),
        sa.Column('otp', sa.String(6), nullable=False),
        sa.Column('expiry_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['enrollment_no'], ['users.enrollment_no'], ondelete='CASCADE'),
    )
    op.create_index('idx_otp_enrollment', 'otp_verifications', ['enrollment_no'])
    op.create_index('idx_otp_expiry', 'otp_verifications', ['expiry_time'])

    # === CONNECTIONS (FK → users.id x2) ===
    op.create_table('connections',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('connected_user_id', sa.Integer(), nullable=False),
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['connected_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'connected_user_id', name='unique_connection'),
        sa.CheckConstraint('user_id != connected_user_id', name='no_self_connection'),
    )
    op.create_index('idx_connections_user', 'connections', ['user_id'])
    op.create_index('idx_connections_connected_user', 'connections', ['connected_user_id'])
    op.create_index('idx_connections_pair', 'connections', ['user_id', 'connected_user_id'])

    # === CONNECTION_REQUESTS (FK → users.id x2) ===
    op.create_table('connection_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('receiver_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('sender_id', 'receiver_id', name='unique_request'),
        sa.CheckConstraint('sender_id != receiver_id', name='no_self_request'),
    )
    op.create_index('idx_requests_receiver_status', 'connection_requests', ['receiver_id', 'status'])
    op.create_index('idx_requests_sender_receiver', 'connection_requests', ['sender_id', 'receiver_id'])

    # === NOTIFICATIONS (FK → users.id x2) ===
    op.create_table('notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('message', sa.String(255), nullable=False),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_notifications_user_unread', 'notifications', ['user_id', 'is_read'])
    op.create_index('idx_notifications_user_created', 'notifications', ['user_id', 'created_at'])
    op.create_index('idx_notifications_created_read', 'notifications', ['created_at', 'is_read'])

    # === USER_BLOCKS (FK → users.id x2) ===
    op.create_table('user_blocks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('blocker_id', sa.Integer(), nullable=False),
        sa.Column('blocked_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('blocked_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['blocker_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['blocked_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('blocker_id', 'blocked_id', name='unique_block'),
        sa.CheckConstraint('blocker_id != blocked_id', name='no_self_block'),
    )
    op.create_index('idx_blocks_blocker', 'user_blocks', ['blocker_id'])
    op.create_index('idx_blocks_blocked', 'user_blocks', ['blocked_id'])

    # === POSTS (FK → users.id) ===
    op.create_table('posts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_type', sa.String(50), nullable=True),
        sa.Column('post_type', sa.String(20), server_default='normal'),
        sa.Column('visibility', sa.String(20), nullable=False, server_default='connections'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_posts_user_created', 'posts', ['user_id', 'created_at'])
    op.create_index('idx_posts_visibility_created', 'posts', ['visibility', 'created_at'])

    # === LIKES (FK → users.id, posts.id) ===
    op.create_table('likes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'post_id', name='unique_user_post_like'),
    )
    op.create_index('idx_likes_post', 'likes', ['post_id'])
    op.create_index('idx_likes_user', 'likes', ['user_id'])

    # === COMMENTS (FK → users.id, posts.id, self-referencing) ===
    op.create_table('comments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('parent_comment_id', sa.Integer(), nullable=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_comment_id'], ['comments.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_comments_post_created', 'comments', ['post_id', 'created_at'])
    op.create_index('idx_comments_parent', 'comments', ['parent_comment_id'])

    # === EVENTS (FK → users.id) ===
    op.create_table('events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('location', sa.String(100), nullable=False),
        sa.Column('event_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_seats', sa.Integer(), nullable=False, server_default=sa.text('100')),
        sa.Column('is_cancelled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_events_date', 'events', ['event_date'])
    op.create_index('idx_events_user_date', 'events', ['user_id', 'event_date'])

    # === EVENT_REGISTRATIONS (FK → events.id, users.id) ===
    op.create_table('event_registrations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('registered_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('event_id', 'user_id', name='unique_event_user'),
    )
    op.create_index('idx_registrations_event_status', 'event_registrations', ['event_id', 'status'])

    # === SKILLS (FK → users.id) ===
    op.create_table('skills',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('skill_name', sa.String(100), nullable=False),
        sa.Column('skill_level', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'skill_name', name='unique_user_skill'),
    )
    op.create_index('idx_skills_user', 'skills', ['user_id'])

    # === EXPERIENCES (FK → users.id) ===
    op.create_table('experiences',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('company', sa.String(100), nullable=False),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('start_date', sa.String(20), nullable=False),
        sa.Column('end_date', sa.String(20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_current', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_experiences_user', 'experiences', ['user_id'])

    # === EDUCATIONS (FK → users.id) ===
    op.create_table('educations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('degree', sa.String(100), nullable=False),
        sa.Column('field', sa.String(100), nullable=False),
        sa.Column('institution', sa.String(100), nullable=False),
        sa.Column('year', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_educations_user', 'educations', ['user_id'])

    # === ANNOUNCEMENTS (FK → users.id) ===
    op.create_table('announcements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
    )

    # === ADMIN_LOGS (FK → users.id x2, events.id) ===
    op.create_table('admin_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('admin_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('target_user_id', sa.Integer(), nullable=True),
        sa.Column('target_event_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_event_id'], ['events.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_admin_logs_admin', 'admin_logs', ['admin_id', 'created_at'])
    op.create_index('idx_admin_logs_target_user', 'admin_logs', ['target_user_id', 'created_at'])
    op.create_index('idx_admin_logs_action_type', 'admin_logs', ['action_type', 'created_at'])

    # === CONVERSATIONS (FK → users.id x2) ===
    op.create_table('conversations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user1_id', sa.Integer(), nullable=False),
        sa.Column('user2_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user1_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user2_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user1_id', 'user2_id', name='unique_conversation'),
        sa.CheckConstraint('user1_id != user2_id', name='no_self_conversation'),
        sa.CheckConstraint('user1_id < user2_id', name='ordered_users'),
    )
    op.create_index('idx_conversations_user1', 'conversations', ['user1_id'])
    op.create_index('idx_conversations_user2', 'conversations', ['user2_id'])
    op.create_index('idx_conversations_updated', 'conversations', ['updated_at'])

    # === MESSAGES (FK → conversations.id, users.id x2) ===
    op.create_table('messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('receiver_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.CheckConstraint('sender_id != receiver_id', name='no_self_message'),
    )
    op.create_index('idx_messages_conversation', 'messages', ['conversation_id', 'created_at'])
    op.create_index('idx_messages_sender', 'messages', ['sender_id'])
    op.create_index('idx_messages_receiver', 'messages', ['receiver_id'])
    op.create_index('idx_messages_conversation_id_id', 'messages', ['conversation_id', 'id'])
    # Note: The partial index idx_messages_unread is PostgreSQL-specific.
    # It is safe to create here but will only be used on PostgreSQL.
    op.create_index(
        'idx_messages_unread', 'messages', ['receiver_id', 'is_read'],
        postgresql_where=sa.text('is_read = false')
    )


def downgrade():
    # Drop in reverse dependency order (leaf tables first)
    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('admin_logs')
    op.drop_table('announcements')
    op.drop_table('educations')
    op.drop_table('experiences')
    op.drop_table('skills')
    op.drop_table('event_registrations')
    op.drop_table('events')
    op.drop_table('comments')
    op.drop_table('likes')
    op.drop_table('posts')
    op.drop_table('user_blocks')
    op.drop_table('notifications')
    op.drop_table('connection_requests')
    op.drop_table('connections')
    op.drop_table('otp_verifications')
    op.drop_table('users')
