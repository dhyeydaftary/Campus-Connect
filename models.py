from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime

db = SQLAlchemy()
bcrypt = Bcrypt()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    university = db.Column(db.String(100), nullable=False)
    major = db.Column(db.String(100), nullable=False)
    batch = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    posts = db.relationship("Post", backref="user", lazy="select")
    events = db.relationship("Event", backref="author", lazy="select")
    event_registrations = db.relationship("EventRegistration", backref="user", lazy="select")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def set_password(self, password: str):
        if not password:
            raise ValueError("Password cannot be empty")
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    @classmethod
    def create_from_json(cls, data: dict):
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


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(100), nullable=False)
    event_date = db.Column(db.DateTime, nullable=False)
    total_seats = db.Column(db.Integer, nullable=False, default=100)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = db.relationship("EventRegistration", backref="event", lazy="select", cascade="all, delete-orphan")

    @property
    def available_seats(self):
        """Calculate available seats dynamically"""
        going_count = EventRegistration.query.filter_by(
            event_id=self.id,
            status='going'
        ).count()
        return max(0, self.total_seats - going_count)

    @property
    def going_count(self):
        """Number of users going"""
        return EventRegistration.query.filter_by(
            event_id=self.id,
            status='going'
        ).count()

    @property
    def interested_count(self):
        """Number of interested users"""
        return EventRegistration.query.filter_by(
            event_id=self.id,
            status='interested'
        ).count()


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
    status = db.Column(db.String(20), nullable=False)  # 'going' or 'interested'
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("event_id", "user_id", name="unique_event_user"),
    )


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    caption = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    file_type = db.Column(db.String(50), nullable=True)  # 'image', 'document', 'text'
    post_type = db.Column(db.String(20), default="normal")  # normal / event
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


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

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "post_id", name="unique_user_post_like"),
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

    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")