"""
Admin user seeder for Campus Connect.
Creates or updates the primary admin account from environment variables.
"""

import os
from flask import current_app
from app.extensions import db
from app.models import User


def seed_admin():
    """
    Seeds or updates the primary admin user from .env variables.
    This ensures the admin account is always available and credentials are
    synchronized with the environment configuration on startup.
    """
    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD")

    if not email or not password:
        return
    current_app.logger.info(f"[SEED] Seeding admin with email: {email}")

    # Find the specific admin by email to ensure we update the correct one.
    admin = User.query.filter_by(email=email.lower()).first()

    if admin:
        # Update existing admin to ensure credentials match .env and hash is correct
        admin.email = email.lower()
        admin.set_password(password)  # Use the model's method
        db.session.commit()
        current_app.logger.info("[OK] Admin account updated")
        return

    admin = User(
        first_name="Admin",
        last_name="User",
        email=email.lower(),
        university="Campus Connect University",
        major="Administration",
        batch="N/A",
        account_type="admin",
        is_verified=True,  # Admin is trusted by default
        enrollment_no="ADMIN001"
    )
    admin.set_password(password)

    db.session.add(admin)
    db.session.commit()
    current_app.logger.info("[OK] Default admin created")
