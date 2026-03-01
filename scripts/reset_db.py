import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    print("🗑️  Dropping all tables...")
    db.drop_all()
    print("✨ Creating all tables with new schema...")
    db.create_all()
    print("✅ Database reset complete!")
