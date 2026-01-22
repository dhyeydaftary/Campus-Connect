from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from datetime import datetime

db = SQLAlchemy()
bcrypt = Bcrypt()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    batch = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One-to-many relationship
    events = db.relationship("Event", backref="author", lazy="select")

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
            full_name=data.get("full_name"),
            email=email,
            branch=data.get("branch"),
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

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    created_at = db.Column(db.DateTime, default=datetime.utcnow)