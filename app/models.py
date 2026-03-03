from app.extensions import db, bcrypt
from datetime import datetime, timezone
from sqlalchemy import Index, CheckConstraint, and_, or_, DateTime, event as sa_event
from sqlalchemy.exc import IntegrityError


def get_status_default(context):
    """Sets default for status based on account type."""
    if context.get_current_parameters().get('account_type') == 'admin':
        return "ACTIVE"
    return "PENDING"





# ═══════════════════════════════════════════════════════════════════════════
# CORE TABLES
# ═══════════════════════════════════════════════════════════════════════════

class User(db.Model):
    """Represents a user in the system. This is the central model for authentication, profile information, and relationships."""
    
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    
    # Authentication
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    is_password_set = db.Column(db.Boolean, default=False, nullable=False)
    
    # OTP & Student Details
    enrollment_no = db.Column(db.String(50), unique=True, nullable=False, index=True)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    
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
    status = db.Column(db.String(20), default=get_status_default, nullable=False)
    
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
    notifications = db.relationship("Notification", 
                                    foreign_keys="Notification.user_id",
                                    backref="user", 
                                    lazy="dynamic", 
                                    cascade="all, delete-orphan")

    __table_args__ = (
        db.CheckConstraint(status.in_(['PENDING', 'ACTIVE', 'BLOCKED']), name='user_status_check'),
    )

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
        if not self.password_hash:
            return False
        try:
            return bcrypt.check_password_hash(self.password_hash, password)
        except ValueError:
            return False
    
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


class OTPVerification(db.Model):
    """
    Stores One-Time Passwords (OTPs) for user verification and password resets.
    Linked to User via enrollment_no.
    """

    __tablename__ = "otp_verifications"

    id = db.Column(db.Integer, primary_key=True)
    enrollment_no = db.Column(
        db.String(50),
        db.ForeignKey("users.enrollment_no", ondelete="CASCADE"),
        nullable=False
    )
    otp = db.Column(db.String(6), nullable=False)
    expiry_time = db.Column(db.DateTime(timezone=True), nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_otp_enrollment", "enrollment_no"),
        Index("idx_otp_expiry", "expiry_time"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# SOCIAL GRAPH TABLES
# ═══════════════════════════════════════════════════════════════════════════

class Connection(db.Model):
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
    
    # Relationships defined in parent models via backref
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
    )  # 'public', 'connections', 'private'
    
    # Timestamps
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))  # 🆕
    
    __table_args__ = (
        # For "get user's posts" query
        Index("idx_posts_user_created", "user_id", "created_at"),
        
        # For "get public posts" query
        Index("idx_posts_visibility_created", "visibility", "created_at"),
    )

    # Relationships
    likes = db.relationship("Like", backref="post", cascade="all, delete-orphan", lazy="dynamic")
    comments = db.relationship("Comment", backref="post", cascade="all, delete-orphan", lazy="dynamic")


class Like(db.Model):

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
        Index("idx_likes_post", "post_id"),
        
        # For getting user's liked posts
        Index("idx_likes_user", "user_id"),
    )


class Comment(db.Model):

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
    )
    
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = db.relationship("User")
    replies = db.relationship(
        "Comment",
        backref=db.backref("parent", remote_side=[id]),
        lazy="dynamic",
        cascade="all, delete-orphan"
    )
    
    # Relationships to User and Post are handled by parent models
    
    __table_args__ = (
        # For getting comments on a post
        Index("idx_comments_post_created", "post_id", "created_at"),
        
        # For getting replies to a comment
        Index("idx_comments_parent", "parent_comment_id"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# EVENT TABLES 
# ═══════════════════════════════════════════════════════════════════════════

class Event(db.Model):

    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(100), nullable=False)
    event_date = db.Column(DateTime(timezone=True), nullable=False)
    total_seats = db.Column(db.Integer, nullable=False, default=100)
    is_cancelled = db.Column(db.Boolean, default=False, nullable=False)

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
        Index("idx_events_date", "event_date"), 
        
        # For "my events" query
        Index("idx_events_user_date", "user_id", "event_date"),
    )


class EventRegistration(db.Model):

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
        Index("idx_registrations_event_status", "event_id", "status"),  
    )


# ═══════════════════════════════════════════════════════════════════════════
# PROFILE ENHANCEMENT TABLES - ADD THESE TO THE END OF models.py
# ═══════════════════════════════════════════════════════════════════════════

class Skill(db.Model):

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
# ANNOUNCEMENTS TABLE
# ═══════════════════════════════════════════════════════════════════════════

class Announcement(db.Model):
    """
    Represents a system-wide announcement created by an administrator.
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
# ADMIN LOG TABLE
# ═══════════════════════════════════════════════════════════════════════════

class AdminLog(db.Model):

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


# ═══════════════════════════════════════════════════════════════════════════
# DIRECT MESSAGING MODELS
# ═══════════════════════════════════════════════════════════════════════════

class Conversation(db.Model):
    """
    Represents a one-to-one conversation between two users.
    
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
    Represents an individual message sent within a conversation.
    
    Includes sender/receiver IDs, content, and read-receipt status.
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
# 
# EVENT LISTENERS (POLYMORPHIC CLEANUP)
# 

@sa_event.listens_for(Post, 'after_delete')
def delete_post_notifications(mapper, connection, target):
    """Clean up polymorphic notifications when a post is deleted."""
    from sqlalchemy import and_
    connection.execute(
        Notification.__table__.delete().where(
            and_(
                Notification.reference_id == target.id,
                Notification.type.like('post_%')
            )
        )
    )

@sa_event.listens_for(Event, 'after_delete')
def delete_event_notifications(mapper, connection, target):
    """Clean up polymorphic notifications when an event is deleted."""
    from sqlalchemy import and_
    connection.execute(
        Notification.__table__.delete().where(
            and_(
                Notification.reference_id == target.id,
                Notification.type.like('event_%')
            )
        )
    )
