import pytest
from flask import session, jsonify, request
from werkzeug.exceptions import Forbidden, Unauthorized, HTTPException
from app.utils.decorators import admin_required, login_required, status_required
from app.models import User
from app.extensions import db

# -----------------------------------------------------------------------------
# 1.1 test_decorators.py (Utility & Decorators Phase 1)
# -----------------------------------------------------------------------------

def test_admin_required_no_session_redirects(app):
    with app.test_request_context('/'):
        session.clear() # Ensure empty session
        try:
            admin_required()
        except HTTPException as e:
            assert e.response.status_code == 302
            assert "/login" in e.response.headers.get("Location", "")
            
def test_admin_required_student_aborts_403(app):
    with app.test_request_context('/'):
        session["user_id"] = 1
        session["account_type"] = "student"
        with pytest.raises(Forbidden):
            admin_required()

def test_admin_required_admin_passes(app):
    with app.test_request_context('/'):
        session["user_id"] = 1
        session["account_type"] = "admin"
        # Should not raise any exceptions
        assert admin_required() is None

def test_login_required_no_session_redirects(app):
    @login_required
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        session.clear()
        response = dummy_func()
        assert response.status_code == 302
        assert "/login" in response.headers["Location"]

def test_login_required_has_session_passes(app):
    @login_required
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        session["user_id"] = 1
        assert dummy_func() == "OK"

def test_status_required_no_session_redirects(app):
    @status_required(["ACTIVE"])
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        session.clear()
        response = dummy_func()
        assert response.status_code == 302
        assert "/login" in response.headers["Location"]

def test_status_required_deleted_user_redirects(app, auth_client_student):
    client, user = auth_client_student
    
    @status_required(["ACTIVE"])
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        # Valid session, but user is deleted from DB
        session["user_id"] = user.id
        db.session.delete(db.session.get(User, user.id))
        db.session.commit()
        
        response = dummy_func()
        assert response.status_code == 302
        assert "/login" in response.headers["Location"]

def test_status_required_blocked_user_redirects_and_flashes(app, auth_client_student):
    client, user = auth_client_student
    
    @status_required(["ACTIVE"])
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        u = db.session.get(User, user.id)
        u.status = "BLOCKED"
        db.session.commit()
        
        # Manually populate session to trigger logic
        session["user_id"] = user.id
        
        response = dummy_func()
        
        assert response.status_code == 302
        assert "user_id" not in session
        # flashes are stored internally
        assert "_flashes" in session

def test_status_required_banned_user_returns_403(app, auth_client_student):
    client, user = auth_client_student
    
    @status_required(["ACTIVE"])
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        # Instead of 'BANNED' which is not in the db.CheckConstraint('PENDING', 'ACTIVE', 'BLOCKED')
        # We simulate a state that is technically allowed by DB (e.g., PENDING) but not in allowed_statuses
        u = db.session.get(User, user.id)
        u.status = "PENDING"
        db.session.commit()
        
        session["user_id"] = user.id
        with pytest.raises(Forbidden):
            dummy_func()

def test_status_required_active_user_passes(app, auth_client_student):
    client, user = auth_client_student
    
    @status_required(["ACTIVE"])
    def dummy_func():
        return "OK"

    with app.test_request_context('/'):
        session["user_id"] = user.id
        assert dummy_func() == "OK"
