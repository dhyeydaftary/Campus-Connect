from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime, timezone
from sqlalchemy import Index, CheckConstraint, and_, or_, DateTime
from sqlalchemy.exc import IntegrityError

db = SQLAlchemy()
bcrypt = Bcrypt()


# ═══════════════════════════════════════════════════════════════════════════
# CORE TABLES
# ═══════════════════════════════════════════════════════════════════════════

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    
    # Authentication
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Profile
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    profile_picture = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    
    # University info
    university = db.Column(db.String(100), nullable=False, index=True)
    major = db.Column(db.String(100), nullable=False, index=True)
    batch = db.Column(db.String(20), nullable=False)
    
    # Status
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    # Role-based access control
    account_type = db.Column(db.String(20), default="student", nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    posts = db.relationship("Post", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    events = db.relationship("Event", backref="author", lazy="dynamic")
    event_registrations = db.relationship("EventRegistration", backref="user", lazy="dynamic")
    
    # Connection relationships handled via queries (see Connection table)
    sent_requests = db.relationship("ConnectionRequest", 
                                    foreign_keys="ConnectionRequest.sender_id",
                                    backref="sender", 
                                    lazy="dynamic")
    received_requests = db.relationship("ConnectionRequest",
                                        foreign_keys="ConnectionRequest.receiver_id",
                                        backref="receiver",
                                        lazy="dynamic")

    @property
    def full_name(self):
        """User's full name"""
        return f"{self.first_name} {self.last_name}"

    def set_password(self, password: str):
        """Hash and set password"""
        if not password:
            raise ValueError("Password cannot be empty")
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Verify password"""
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def get_connection_count(self):
        """
        Get total number of ACCEPTED connections.
        
        Query pattern: Connection is bidirectional, stored as one row.
        Check both user_id and connected_user_id columns.
        """
        return Connection.query.filter(
            or_(
                Connection.user_id == self.id,
                Connection.connected_user_id == self.id
            )
        ).count()
    
    def get_post_count(self):
        """Get total number of posts by this user"""
        return Post.query.filter_by(user_id=self.id).count()
    
    def is_connected_with(self, other_user_id):
        """
        Check if this user is connected with another user.
        """
        return Connection.query.filter(
            or_(
                and_(Connection.user_id == self.id, Connection.connected_user_id == other_user_id),
                and_(Connection.user_id == other_user_id, Connection.connected_user_id == self.id)
            )
        ).first() is not None
    
    def get_connection_ids(self):
        """
        Get list of all user IDs this user is connected with.
        
        Used for: Post filtering, suggestion exclusion
        Returns: List[int]
        """
        # Optimization: Fetch only IDs to avoid loading full objects
        results = db.session.query(Connection.user_id, Connection.connected_user_id).filter(
            or_(
                Connection.user_id == self.id,
                Connection.connected_user_id == self.id
            )
        ).all()
        
        connection_ids = []
        for uid, connected_uid in results:
            if uid == self.id:
                connection_ids.append(connected_uid)
            else:
                connection_ids.append(uid)
        
        return connection_ids

    @classmethod
    def create_from_json(cls, data: dict):
        """Create user from JSON data (registration)"""
        email = data.get("email", "").strip().lower()
        password = data.get("password")

        if not email:
            raise ValueError("Email is required")
        if not password:
            raise ValueError("Password is required")

        user = cls(
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            email=email,
            university=data.get("university"),
            major=data.get("major"),
            batch=data.get("batch")
        )
        user.set_password(password)
        return user


# ═══════════════════════════════════════════════════════════════════════════
# SOCIAL GRAPH TABLES (🆕 NEW)
# ═══════════════════════════════════════════════════════════════════════════

class Connection(db.Model):
    """
    🆕 Represents ACCEPTED connections (friendships) between users.
    
    WHY THIS TABLE EXISTS:
    - Your UI shows connection counts: "245 Connections"
    - Need to filter posts to show only from connections
    - Need to power "Suggested for You" (exclude connected users)
    
    DESIGN DECISION: Bidirectional stored as single row
    
    When User A connects with User B, we store ONE row:
    - Option 1: (user_id=A, connected_user_id=B)
    - Option 2: (user_id=B, connected_user_id=A)
    
    We use Option 1 where user_id < connected_user_id (enforced in app logic)
    
    WHY NOT TWO ROWS?
    - Saves 50% storage
    - Prevents inconsistency (one row deleted, other remains)
    - Standard pattern for symmetric relationships
    
    QUERYING:
    To check if A and B are connected:
    WHERE (user_id = A AND connected_user_id = B) 
       OR (user_id = B AND connected_user_id = A)
    
    POSTGRESQL OPTIMIZATION:
    - Add CHECK constraint: user_id < connected_user_id
    - Add GIN index for array operations
    - Consider materialized view for connection counts
    """
    __tablename__ = "connections"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    connected_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    connected_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    __table_args__ = (
        # Prevent duplicate connections
        db.UniqueConstraint("user_id", "connected_user_id", name="unique_connection"),
        
        # Prevent self-connections
        CheckConstraint("user_id != connected_user_id", name="no_self_connection"),
        
        # Indexes for fast queries
        # Individual indexes for "get all connections of user X"
        Index("idx_connections_user", "user_id"),
        Index("idx_connections_connected_user", "connected_user_id"),
        
        # Composite index for "check if A and B are connected"
        Index("idx_connections_pair", "user_id", "connected_user_id"),
    )


class ConnectionRequest(db.Model):
    """
    🆕 Tracks connection requests between users.
    
    WHY THIS TABLE EXISTS:
    - Users need to send/receive connection requests
    - Need to track pending/accepted/rejected states
    - Powers notification system
    
    STATE MACHINE:
    1. User A sends request → status='pending'
    2. User B accepts → Create Connection record, update status='accepted'
    3. User B rejects → Update status='rejected'
    
    BUSINESS RULES:
    - Only ONE request allowed between two users at a time
    - Cannot send request if already connected
    - Cannot send request if you blocked them
    - Cannot send request if they blocked you
    
    WORKFLOW EXAMPLE:
    
    1. Check if connection exists:
       SELECT * FROM connections 
       WHERE (user_id=A AND connected_user_id=B) 
          OR (user_id=B AND connected_user_id=A)
       
    2. Check if request exists:
       SELECT * FROM connection_requests
       WHERE (sender_id=A AND receiver_id=B)
          OR (sender_id=B AND receiver_id=A)
       
    3. If neither exists, create request:
       INSERT INTO connection_requests 
       (sender_id, receiver_id, status) 
       VALUES (A, B, 'pending')
    
    4. On accept:
       - INSERT INTO connections (user_id, connected_user_id)
       - UPDATE connection_requests SET status='accepted', responded_at=NOW()
       - INSERT INTO notifications for sender
    
    INDEXES:
    - (receiver_id, status) for "show my pending requests"
    - (sender_id, receiver_id) for "already sent?" checks
    """
    __tablename__ = "connection_requests"
    
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    status = db.Column(
        db.String(20),
        nullable=False,
        default='pending'
    )  # 'pending', 'accepted', 'rejected'
    
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    responded_at = db.Column(db.DateTime(timezone=True), nullable=True)  # When accepted/rejected
    
    __table_args__ = (
        # Only one request between two users
        db.UniqueConstraint("sender_id", "receiver_id", name="unique_request"),
        
        # Cannot request self
        CheckConstraint("sender_id != receiver_id", name="no_self_request"),
        
        # Indexes
        # For "show my pending requests" query
        Index("idx_requests_receiver_status", "receiver_id", "status"),
        
        # For "have I already sent a request to X?" check
        Index("idx_requests_sender_receiver", "sender_id", "receiver_id"),
    )


class Notification(db.Model):
    """
    🆕 User notification system.
    
    WHY THIS TABLE EXISTS:
    - Users need alerts for likes, comments, connection requests
    - Real-time notification badge ("You have 5 new notifications")
    - Activity feed
    
    NOTIFICATION TYPES:
    - 'connection_request': Someone sent you a connection request
    - 'connection_accepted': Your request was accepted
    - 'post_like': Someone liked your post
    - 'post_comment': Someone commented on your post
    - 'event_reminder': Event you registered for is coming up
    - 'event_update': Event you registered for was updated
    - 'mention': Someone mentioned you (future feature)
    
    POLYMORPHIC DESIGN:
    - type + reference_id + actor_id = complete context
    - reference_id points to: request_id, post_id, comment_id, event_id
    - actor_id = who performed the action (null for system notifications)
    
    EXAMPLE:
    User B likes User A's post (post_id=123):
    
    INSERT INTO notifications (
        user_id=A,  -- recipient
        type='post_like',
        message='John Doe liked your post',
        reference_id=123,  -- post_id
        actor_id=B  -- who liked it
    )
    
    QUERY PATTERNS:
    
    1. Get unread count:
       SELECT COUNT(*) FROM notifications
       WHERE user_id = X AND is_read = false
    
    2. Get recent notifications:
       SELECT * FROM notifications
       WHERE user_id = X
       ORDER BY created_at DESC
       LIMIT 20
    
    3. Mark all as read:
       UPDATE notifications
       SET is_read = true
       WHERE user_id = X AND is_read = false
    
    CLEANUP STRATEGY:
    - Delete read notifications older than 30 days (cron job)
    - Keep unread notifications indefinitely
    - Archive important notifications (connection accepted)
    """
    __tablename__ = "notifications"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    type = db.Column(db.String(50), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    reference_id = db.Column(db.Integer, nullable=True)  # Polymorphic reference
    actor_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True
    )  # Who performed the action
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    user = db.relationship("User", foreign_keys=[user_id], backref="notifications")
    actor = db.relationship("User", foreign_keys=[actor_id])
    
    __table_args__ = (
        # For "show unread notifications" query
        Index("idx_notifications_user_unread", "user_id", "is_read"),
        
        # For "recent notifications" query
        Index("idx_notifications_user_created", "user_id", "created_at"),
        
        # For cleanup queries
        Index("idx_notifications_created_read", "created_at", "is_read"),
    )


class UserBlock(db.Model):
    """
    🆕 User blocking/reporting system.
    
    WHY THIS TABLE EXISTS:
    - Safety: Users can block abusive accounts
    - Privacy: Blocked users cannot see your content
    - Moderation: Track reported users
    
    BLOCKING BEHAVIOR:
    When User A blocks User B:
    - B cannot see A's posts
    - B cannot send connection request to A
    - B cannot comment on A's posts
    - Existing connection is removed
    - Pending request is rejected
    
    UNIDIRECTIONAL:
    A blocks B ≠ B blocks A
    Each requires separate row
    
    QUERY PATTERNS:
    
    1. Check if A blocked B:
       SELECT * FROM user_blocks
       WHERE blocker_id = A AND blocked_id = B
    
    2. Get all users I blocked:
       SELECT blocked_id FROM user_blocks
       WHERE blocker_id = A
    
    3. Filter posts (exclude blocked users):
       SELECT * FROM posts
       WHERE user_id NOT IN (
           SELECT blocked_id FROM user_blocks
           WHERE blocker_id = current_user
       )
    
    POSTGRESQL OPTIMIZATION:
    - Add partial index: WHERE is_active = true
    - Use array aggregation for batch checks
    """
    __tablename__ = "user_blocks"
    
    id = db.Column(db.Integer, primary_key=True)
    blocker_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )  # Who blocked
    blocked_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )  # Who was blocked
    reason = db.Column(db.String(50), nullable=True)  # 'spam', 'harassment', 'other'
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Can unblock
    blocked_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    blocker = db.relationship("User", foreign_keys=[blocker_id], backref="blocks_made")
    blocked = db.relationship("User", foreign_keys=[blocked_id], backref="blocked_by")
    
    __table_args__ = (
        # One block per user pair
        db.UniqueConstraint("blocker_id", "blocked_id", name="unique_block"),
        
        # Cannot block self
        CheckConstraint("blocker_id != blocked_id", name="no_self_block"),
        
        # Indexes
        Index("idx_blocks_blocker", "blocker_id"),
        Index("idx_blocks_blocked", "blocked_id"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# CONTENT TABLES (ENHANCED)
# ═══════════════════════════════════════════════════════════════════════════

class Post(db.Model):
    """
    User-generated content.
    
    CHANGES FROM ORIGINAL:
    - Added: visibility field (public/connections/private)
    - Added: Indexes for performance
    - Added: updated_at for edit tracking
    
    QUERY PATTERNS:
    
    1. Get user's posts:
       SELECT * FROM posts
       WHERE user_id = X
       ORDER BY created_at DESC
    
    2. Get feed (posts from connections):
       SELECT p.* FROM posts p
       JOIN connections c ON (
           (c.user_id = current_user AND p.user_id = c.connected_user_id)
           OR (c.connected_user_id = current_user AND p.user_id = c.user_id)
       )
       WHERE p.visibility IN ('public', 'connections')
       ORDER BY p.created_at DESC
    
    3. Get public posts:
       SELECT * FROM posts
       WHERE visibility = 'public'
       ORDER BY created_at DESC
    """
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Content
    caption = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    file_type = db.Column(db.String(50), nullable=True)  # 'image', 'document', 'text'
    post_type = db.Column(db.String(20), default="normal")  # 'normal', 'event'
    
    # Privacy
    visibility = db.Column(
        db.String(20), 
        default='connections', 
        nullable=False
    )  # 🆕 'public', 'connections', 'private'
    
    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))  # 🆕
    
    __table_args__ = (
        # For "get user's posts" query
        Index("idx_posts_user_created", "user_id", "created_at"),
        
        # For "get public posts" query
        Index("idx_posts_visibility_created", "visibility", "created_at"),
    )


class Like(db.Model):
    """
    Post engagement tracking.
    
    CHANGES FROM ORIGINAL:
    - Added: Index on post_id for counting
    
    QUERY PATTERNS:
    
    1. Count likes on post:
       SELECT COUNT(*) FROM likes WHERE post_id = X
    
    2. Check if user liked post:
       SELECT * FROM likes WHERE user_id = A AND post_id = X
    
    3. Get users who liked post:
       SELECT u.* FROM users u
       JOIN likes l ON l.user_id = u.id
       WHERE l.post_id = X
    """
    __tablename__ = "likes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    post_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False
    )
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        # Prevent double-likes
        db.UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),
        
        # For counting likes per post
        Index("idx_likes_post", "post_id"),  # 🆕
        
        # For getting user's liked posts
        Index("idx_likes_user", "user_id"),  # 🆕
    )


class Comment(db.Model):
    """
    Post discussions.
    
    CHANGES FROM ORIGINAL:
    - Added: parent_comment_id for threaded replies
    - Added: Indexes for performance
    
    QUERY PATTERNS:
    
    1. Get top-level comments:
       SELECT * FROM comments
       WHERE post_id = X AND parent_comment_id IS NULL
       ORDER BY created_at DESC
    
    2. Get replies to comment:
       SELECT * FROM comments
       WHERE parent_comment_id = Y
       ORDER BY created_at ASC
    
    3. Count comments on post:
       SELECT COUNT(*) FROM comments WHERE post_id = X
    """
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    post_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False
    )
    parent_comment_id = db.Column(
        db.Integer,
        db.ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=True
    )  # 🆕 For threaded replies
    
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = db.relationship("User")
    replies = db.relationship(
        "Comment",
        backref=db.backref("parent", remote_side=[id]),
        lazy="dynamic",
        cascade="all, delete-orphan"
    )  # 🆕
    
    __table_args__ = (
        # For getting comments on a post
        Index("idx_comments_post_created", "post_id", "created_at"),  # 🆕
        
        # For getting replies to a comment
        Index("idx_comments_parent", "parent_comment_id"),  # 🆕
    )


# ═══════════════════════════════════════════════════════════════════════════
# EVENT TABLES (ENHANCED)
# ═══════════════════════════════════════════════════════════════════════════

class Event(db.Model):
    """
    Event management.
    
    CHANGES FROM ORIGINAL:
    - Added: Indexes for date queries
    - Added: is_cancelled field
    """
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(100), nullable=False)
    event_date = db.Column(DateTime(timezone=True), nullable=False)
    total_seats = db.Column(db.Integer, nullable=False, default=100)
    is_cancelled = db.Column(db.Boolean, default=False, nullable=False)  # 🆕

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))  # 🆕
    
    # Relationships
    registrations = db.relationship(
        "EventRegistration", 
        backref="event", 
        lazy="dynamic",
        cascade="all, delete-orphan"
    )

    @property
    def available_seats(self):
        """Calculate available seats dynamically"""
        going_count = self.registrations.filter_by(status='going').count()
        return max(0, self.total_seats - going_count)

    @property
    def going_count(self):
        """Number of users going"""
        return self.registrations.filter_by(status='going').count()

    @property
    def interested_count(self):
        """Number of interested users"""
        return self.registrations.filter_by(status='interested').count()
    
    @classmethod
    def get_active_count(cls):
        """Count of upcoming, non-cancelled events"""
        return cls.query.filter(cls.event_date >= datetime.now(timezone.utc), cls.is_cancelled == False).count()

    __table_args__ = (
        # For "upcoming events" query
        Index("idx_events_date", "event_date"),  # 🆕
        
        # For "my events" query
        Index("idx_events_user_date", "user_id", "event_date"),  # 🆕
    )


class EventRegistration(db.Model):
    """
    User event participation.
    
    CHANGES FROM ORIGINAL:
    - Added: Index on (event_id, status) for seat counting
    """
    __tablename__ = "event_registrations"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    status = db.Column(db.String(20), nullable=False)  # 'going', 'interested'
    registered_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        # One registration per user per event
        db.UniqueConstraint("event_id", "user_id", name="unique_event_user"),
        
        # For counting going/interested users
        Index("idx_registrations_event_status", "event_id", "status"),  # 🆕
    )


# ═══════════════════════════════════════════════════════════════════════════
# PROFILE ENHANCEMENT TABLES - ADD THESE TO THE END OF models.py
# ═══════════════════════════════════════════════════════════════════════════

class Skill(db.Model):
    """
    User skills for profile display.
    
    USAGE:
    - Display user's technical and soft skills
    - Skills shown as tags/badges on profile
    """
    __tablename__ = "skills"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    skill_name = db.Column(db.String(100), nullable=False)
    skill_level = db.Column(db.String(20), nullable=True)  # 'beginner', 'intermediate', 'advanced', 'expert'
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship
    user = db.relationship("User", backref=db.backref("skills", lazy="dynamic", cascade="all, delete-orphan"))
    
    __table_args__ = (
        # Prevent duplicate skills for same user
        db.UniqueConstraint("user_id", "skill_name", name="unique_user_skill"),
        Index("idx_skills_user", "user_id"),
    )


class Experience(db.Model):
    """
    User work experience, internships, and projects.
    
    USAGE:
    - Display professional experience on profile
    - Shows timeline of user's career/academic journey
    """
    __tablename__ = "experiences"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Experience details
    title = db.Column(db.String(100), nullable=False)  # e.g., "Software Engineer Intern"
    company = db.Column(db.String(100), nullable=False)  # e.g., "Google"
    location = db.Column(db.String(100), nullable=True)  # e.g., "Mountain View, CA"
    start_date = db.Column(db.String(20), nullable=False)  # e.g., "Jan 2024"
    end_date = db.Column(db.String(20), nullable=True)  # e.g., "Present" or "Jun 2024"
    description = db.Column(db.Text, nullable=True)  # Brief description of role
    is_current = db.Column(db.Boolean, default=False)  # Currently working here?
    
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationship
    user = db.relationship("User", backref=db.backref("experiences", lazy="dynamic", cascade="all, delete-orphan"))
    
    __table_args__ = (
        Index("idx_experiences_user", "user_id"),
    )


class Education(db.Model):
    """
    User education history.

    USAGE:
    - Display educational background on profile
    - Shows degrees, institutions, and graduation years
    """
    __tablename__ = "educations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    # Education details
    degree = db.Column(db.String(100), nullable=False)  # e.g., "Bachelor of Science"
    field = db.Column(db.String(100), nullable=False)  # e.g., "Computer Science"
    institution = db.Column(db.String(100), nullable=False)  # e.g., "Harvard University"
    year = db.Column(db.String(20), nullable=False)  # e.g., "2024 - 2028" or "2028"

    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    user = db.relationship("User", backref=db.backref("educations", lazy="dynamic", cascade="all, delete-orphan"))

    __table_args__ = (
        Index("idx_educations_user", "user_id"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# ANNOUNCEMENTS TABLE (🆕 NEW)
# ═══════════════════════════════════════════════════════════════════════════

class Announcement(db.Model):
    """
    System-wide announcements created by admins.
    """
    __tablename__ = "announcements"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='active', nullable=False)  # 'active', 'deleted'
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    author = db.relationship("User", backref="announcements")


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN LOG TABLE - ADD THIS TO models.py
# ═══════════════════════════════════════════════════════════════════════════

class AdminLog(db.Model):
    """
    Tracks admin actions for audit trail.
    
    USAGE:
    - Log when admin toggles user status
    - Log when admin creates events on behalf of others
    - Provides accountability and audit trail
    """
    __tablename__ = "admin_logs"
    
    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True  # In case admin account is deleted later
    )
    action_type = db.Column(db.String(50), nullable=False)  # 'toggle_user', 'create_event'
    target_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True  # User affected by the action
    )
    target_event_id = db.Column(
        db.Integer,
        db.ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True  # Event created by admin
    )
    details = db.Column(db.Text, nullable=True)  # JSON or text details about the action
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    admin = db.relationship("User", foreign_keys=[admin_id], backref="admin_actions")
    target_user = db.relationship("User", foreign_keys=[target_user_id])
    
    __table_args__ = (
        # For querying admin's action history
        Index("idx_admin_logs_admin", "admin_id", "created_at"),
        
        # For querying actions on a specific user
        Index("idx_admin_logs_target_user", "target_user_id", "created_at"),
        
        # For querying by action type
        Index("idx_admin_logs_action_type", "action_type", "created_at"),
    )


"""
═══════════════════════════════════════════════════════════════════════════
DIRECT MESSAGING MODELS
Add these classes to the end of models.py
═══════════════════════════════════════════════════════════════════════════
"""

class Conversation(db.Model):
    """
    Represents a one-to-one conversation between two users.
    
    DESIGN DECISIONS:
    - user1_id < user2_id enforced to prevent duplicate conversations
    - updated_at is automatically updated when new messages are sent (via trigger)
    - CASCADE delete: If user is deleted, all their conversations are deleted
    
    USAGE:
    - Get all conversations for a user
    - Find existing conversation between two users
    - Sort conversations by last activity
    """
    __tablename__ = "conversations"
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Participants (always user1_id < user2_id)
    user1_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    user2_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Timestamps
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    messages = db.relationship(
        "Message",
        backref="conversation",
        lazy="dynamic",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )
    
    user1 = db.relationship("User", foreign_keys=[user1_id])
    user2 = db.relationship("User", foreign_keys=[user2_id])
    
    __table_args__ = (
        # Prevent duplicate conversations
        db.UniqueConstraint("user1_id", "user2_id", name="unique_conversation"),
        
        # Prevent self-conversations
        CheckConstraint("user1_id != user2_id", name="no_self_conversation"),
        
        # Ensure user1_id < user2_id
        CheckConstraint("user1_id < user2_id", name="ordered_users"),
        
        # Indexes
        Index("idx_conversations_user1", "user1_id"),
        Index("idx_conversations_user2", "user2_id"),
        Index("idx_conversations_updated", "updated_at"),
    )
    
    def get_other_user_id(self, current_user_id):
        """Get the ID of the other participant in the conversation"""
        return self.user2_id if self.user1_id == current_user_id else self.user1_id
    
    def get_unread_count(self, user_id):
        """Get number of unread messages for a specific user"""
        return Message.query.filter_by(
            conversation_id=self.id,
            receiver_id=user_id,
            is_read=False
        ).count()
    
    def get_last_message(self):
        """Get the most recent message in this conversation"""
        return self.messages.order_by(Message.created_at.desc()).first()
    
    @classmethod
    def get_or_create(cls, user1_id, user2_id):
        """
        Get existing conversation or create new one.
        Automatically handles user ordering.
        
        Returns: (conversation, was_created)
        """
        # Ensure user1_id < user2_id
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id
        
        conversation = cls.query.filter_by(
            user1_id=user1_id,
            user2_id=user2_id
        ).first()
        
        if conversation:
            return conversation, False
        
        # Create new conversation
        try:
            conversation = cls(user1_id=user1_id, user2_id=user2_id)
            db.session.add(conversation)
            db.session.commit()
            return conversation, True
        except IntegrityError:
            db.session.rollback()
            conversation = cls.query.filter_by(
                user1_id=user1_id,
                user2_id=user2_id
            ).first()
            return conversation, False
    
    @classmethod
    def get_user_conversations(cls, user_id):
        """
        Get all conversations for a user, ordered by last activity.
        
        Returns: List of conversations sorted by updated_at DESC
        """
        return cls.query.filter(
            or_(
                cls.user1_id == user_id,
                cls.user2_id == user_id
            )
        ).order_by(cls.updated_at.desc()).all()


class Message(db.Model):
    """
    Individual message within a conversation.
    
    DESIGN DECISIONS:
    - Stores both sender_id and receiver_id for easy querying
    - is_read flag for read receipts
    - read_at timestamp for when message was read
    - CASCADE delete: If conversation is deleted, all messages are deleted
    
    USAGE:
    - Send new messages
    - Mark messages as read
    - Get conversation history
    - Count unread messages
    """
    __tablename__ = "messages"
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Conversation reference
    conversation_id = db.Column(
        db.Integer,
        db.ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Participants
    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Content
    content = db.Column(db.Text, nullable=False)
    
    # Status
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)
    
    # Timestamp
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
    
    __table_args__ = (
        # Prevent self-messages
        CheckConstraint("sender_id != receiver_id", name="no_self_message"),
        
        # Indexes
        Index("idx_messages_conversation", "conversation_id", "created_at"),
        Index("idx_messages_sender", "sender_id"),
        Index("idx_messages_receiver", "receiver_id"),
        # Partial index for unread messages (PostgreSQL optimization)
        Index(
            "idx_messages_unread",
            "receiver_id",
            "is_read",
            postgresql_where=(db.Column("is_read") == False)
        ),
        # Optimization for fetching last message in conversation
        Index("idx_messages_conversation_id_id", "conversation_id", "id"),
    )
    
    def mark_as_read(self):
        """Mark this message as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = datetime.now(timezone.utc)
            db.session.commit()
    
    def to_dict(self):
        """Convert message to dictionary for JSON response"""
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "content": self.content,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat(),
            "sender_name": self.sender.full_name if self.sender else "Unknown",
            "sender_avatar": self.sender.profile_picture if self.sender else None
        }
    
    @classmethod
    def mark_conversation_as_read(cls, conversation_id, user_id):
        """
        Mark all unread messages in a conversation as read for a specific user.
        
        Args:
            conversation_id: The conversation ID
            user_id: The user who is marking messages as read (receiver)
        """
        now = datetime.now(timezone.utc)
        
        # Bulk update for performance
        count = cls.query.filter_by(
            conversation_id=conversation_id,
            receiver_id=user_id,
            is_read=False
        ).update({'is_read': True, 'read_at': now}, synchronize_session=False)
        
        if count > 0:
            db.session.commit()
        
        return count