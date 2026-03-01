import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db, bcrypt
from app.models import User
import os

app = create_app()

with app.app_context():
    admin_email = os.getenv("ADMIN_EMAIL")
    
    if not admin_email:
        print("ADMIN_EMAIL not set in environment variables.")
    else:
        existing_admin = User.query.filter_by(email=admin_email).first()
        
        if existing_admin:
            print("Admin already exists. No action taken.")
        else:
            admin = User(
                first_name="Campus",
                last_name="Admin",
                email=admin_email,
                university="Campus Connect University",
                major="Administration",
                batch="N/A",
                account_type="admin",
                is_password_set=True,
                is_verified=True,
                enrollment_no="ADMIN"  # Required by User model
            )
            admin.set_password(os.getenv("ADMIN_PASSWORD", "admin123"))
            db.session.add(admin)
            db.session.commit()
            print("New admin created successfully.")