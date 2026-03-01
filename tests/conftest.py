import os
import pytest
from app import create_app
from app.extensions import db
from app.models import User

@pytest.fixture
def app():
    os.environ["TESTING"] = "true"
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,        # Disable CSRF for easier testing
        "RATELIMIT_ENABLED": False,        # Disable rate limiting during tests
        "RATELIMIT_STORAGE_URI": "memory://",  # Use memory instead of Redis
        "REDIS_URL": None
    })
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()