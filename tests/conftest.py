import os
import pytest
from datetime import datetime, timezone, timedelta
from app import create_app
from app.extensions import db
from app.models import User, Post, Connection, ConnectionRequest, Event, Notification
from sqlalchemy.pool import StaticPool
from sqlalchemy import event as sa_event

def pytest_configure(config):
    config.addinivalue_line("markers", "critical: Critical security tests")
    config.addinivalue_line("markers", "auth: Authorization tests")
    config.addinivalue_line("markers", "cascade: Cascading delete tests")

@pytest.fixture
def app():
    test_config = {
        "TESTING": True,
        "SECRET_KEY": "test-secret-key-super-secure",
        "SECURITY_PASSWORD_SALT": "test-salt-super-secure",
        "FRONTEND_URL": "http://localhost:3000",
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_ENGINE_OPTIONS": {
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False}
        },
        "WTF_CSRF_ENABLED": False,
        "RATELIMIT_ENABLED": False,
        "RATELIMIT_STORAGE_URI": "memory://",
        "REDIS_URL": None,
        "COMMENT_QUEUE_ENABLED": False
    }

    app = create_app(test_config)

    with app.app_context():
        # Enforce foreign keys for SQLite
        @sa_event.listens_for(db.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            if "sqlite" in str(db.engine.url):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()
                
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        
        # Shutdown comment queue if it accidentally started
        from app.services.comment_queue import comment_queue_service
        if hasattr(comment_queue_service, 'shutdown'):
            comment_queue_service.shutdown()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def unauthenticated_client(client):
    yield client

@pytest.fixture
def auth_client_student(client, app):
    with app.app_context():
        user = User(
            first_name="Test", last_name="Student", email="student@example.com",
            enrollment_no="STU001", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user.set_password("pass")
        db.session.add(user)
        db.session.commit()
        user_id = user.id
        
        response = client.post('/api/auth/login', json={
            "role": "student", "enrollment_no": "STU001", "password": "pass"
        })
        
        yield client, db.session.get(User, user_id)

@pytest.fixture
def auth_client_admin(client, app):
    with app.app_context():
        user = User(
            first_name="Admin", last_name="User", email="admin@example.com",
            enrollment_no="ADM001", university="Test U", major="CS", batch="2026",
            account_type="admin", status="ACTIVE", is_password_set=True
        )
        user.set_password("pass")
        db.session.add(user)
        db.session.commit()
        user_id = user.id
        
        response = client.post('/api/auth/login', json={
            "role": "admin", "enrollment_no": "ADM001", "password": "pass"
        })
        
        yield client, db.session.get(User, user_id)

@pytest.fixture
def user_with_5_posts(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        user_id = user.id
        for i in range(5):
            post = Post(user_id=user_id, caption=f"Post {i}")
            db.session.add(post)
        db.session.commit()
        yield client, db.session.get(User, user_id)

@pytest.fixture
def two_connected_users(app):
    with app.app_context():
        user1 = User(
            first_name="User", last_name="One", email="user1@example.com",
            enrollment_no="U001", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user2 = User(
            first_name="User", last_name="Two", email="user2@example.com",
            enrollment_no="U002", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user1.set_password("pass")
        user2.set_password("pass")
        db.session.add_all([user1, user2])
        db.session.commit()

        u1_id = user1.id
        u2_id = user2.id

        conn = Connection(user_id=u1_id, connected_user_id=u2_id)
        db.session.add(conn)
        db.session.commit()
        
        yield db.session.get(User, u1_id), db.session.get(User, u2_id)

@pytest.fixture
def event_full(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        future_date = datetime.now(timezone.utc) + timedelta(days=5)
        event = Event(
            user_id=user.id, title="Full Event",
            description="An event that is full",
            location="Test Room",
            event_date=future_date,
            total_seats=0
        )
        db.session.add(event)
        db.session.commit()
        yield event

@pytest.fixture
def event_with_capacity(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        future_date = datetime.now(timezone.utc) + timedelta(days=5)
        event = Event(
            user_id=user.id, title="Open Event",
            description="An event with capacity",
            location="Test Room",
            event_date=future_date,
            total_seats=10
        )
        db.session.add(event)
        db.session.commit()
        yield event

@pytest.fixture
def pending_connection_request(two_connected_users, app):
    user1, user2 = two_connected_users
    with app.app_context():
        user3 = User(
            first_name="User", last_name="Three", email="user3@example.com",
            enrollment_no="U003", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user3.set_password("pass")
        db.session.add(user3)
        db.session.commit()

        req = ConnectionRequest(sender_id=user1.id, receiver_id=user3.id, status="pending")
        db.session.add(req)
        db.session.commit()
        
        yield db.session.get(User, user1.id), db.session.get(User, user3.id), req

@pytest.fixture
def second_student(app):
    with app.app_context():
        user = User(
            first_name="Second", last_name="Student", email="second@example.com",
            enrollment_no="STU002", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user.set_password("pass")
        db.session.add(user)
        db.session.commit()
        yield db.session.get(User, user.id)

@pytest.fixture
def third_student(app):
    with app.app_context():
        user = User(
            first_name="Third", last_name="Student", email="third@example.com",
            enrollment_no="STU003", university="Test U", major="CS", batch="2026",
            account_type="student", status="ACTIVE", is_password_set=True
        )
        user.set_password("pass")
        db.session.add(user)
        db.session.commit()
        yield db.session.get(User, user.id)