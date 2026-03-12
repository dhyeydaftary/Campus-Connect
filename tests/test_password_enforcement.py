import pytest
from flask import url_for
from app.models import User
from app.extensions import db

def test_pending_user_enforcement(client, app):
    """Verify that a PENDING user without a password cannot access home."""
    # 1. Create a PENDING user
    with app.app_context():
        user = User(
            first_name="Pending", last_name="User", email="pending@example.com",
            enrollment_no="P001", university="U", major="CS", batch="2026",
            account_type="student", status="PENDING", is_password_set=False
        )
        db.session.add(user)
        db.session.commit()
        user_id = user.id

    # 2. Log them in (manually set session for speed in test)
    with client.session_transaction() as sess:
        sess["user_id"] = user_id
        sess["user_name"] = "Pending User"
        sess["account_type"] = "student"

    # 3. Try to access /home
    resp = client.get("/home")
    
    # 4. Success = Redirect to set-password
    assert resp.status_code == 302
    assert "/set-password" in resp.location

def test_active_user_no_redirect(client, app, auth_client_student):
    """Verify that an ACTIVE user can access home."""
    client_obj, user = auth_client_student
    
    resp = client_obj.get("/home")
    assert resp.status_code == 200
