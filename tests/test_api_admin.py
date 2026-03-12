"""
API/route coverage for admin blueprint.
"""
import pytest
from flask import url_for
from app import create_app
from app.models import User, Announcement, Event
from app.extensions import db

import os

@pytest.fixture
def admin_user(app):
    user = User(
        first_name="Admin", last_name="User", email="admin@admin.com",
        enrollment_no="ADM001", university="Test U", major="CS", batch="2026",
        account_type="admin", status="ACTIVE", is_verified=True, is_password_set=True
    )
    user.set_password("pass")
    db.session.add(user)
    db.session.commit()
    return user

@pytest.fixture
def student_user(app):
    user = User(
        first_name="Student", last_name="User", email="student@user.com",
        enrollment_no="STU001", university="Test U", major="CS", batch="2026",
        account_type="student", status="ACTIVE", is_verified=True, is_password_set=True
    )
    user.set_password("pass")
    db.session.add(user)
    db.session.commit()
    return user

class TestAdminAuthorization:
    def test_unauthenticated_redirect(self, client):
        resp = client.get("/admin/api/dashboard/overview")
        assert resp.status_code in (401, 302)

    def test_student_forbidden(self, client, student_user):
        with client.session_transaction() as sess:
            sess["user_id"] = student_user.id
        resp = client.get("/admin/api/dashboard/overview")
        assert resp.status_code == 403

    def test_admin_success(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.get("/admin/api/dashboard/overview")
        print(resp.data)
        assert resp.status_code == 200
        assert "totalUsers" in resp.get_json()

class TestAdminCRUD:
    def test_create_announcement(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.post("/admin/api/announcements", json={"title": "T1", "content": "C1"})
        assert resp.status_code == 201
        assert Announcement.query.filter_by(title="T1").first() is not None

    def test_update_announcement(self, client, admin_user):
        ann = Announcement(title="T2", content="C2", author_id=admin_user.id)
        db.session.add(ann)
        db.session.commit()
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.put(f"/admin/api/announcements/{ann.id}", json={"title": "T2-upd"})
        assert resp.status_code == 200
        assert db.session.get(Announcement, ann.id).title == "T2-upd"

    def test_delete_announcement(self, client, admin_user):
        ann = Announcement(title="T3", content="C3", author_id=admin_user.id)
        db.session.add(ann)
        db.session.commit()
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.delete(f"/admin/api/announcements/{ann.id}")
        assert resp.status_code == 200
        assert db.session.get(Announcement, ann.id).status == "deleted"

    def test_create_event_invalid_target(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.post("/admin/api/events/create", json={"targetEntity": 9999, "title": "E1", "description": "D1", "location": "L1", "event_date": "2026-03-03T12:00:00Z", "total_seats": 10})
        assert resp.status_code == 404

    def test_create_event_missing_field(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.post("/admin/api/events/create", json={"title": "E2"})
        assert resp.status_code == 400

class TestAdminValidation:
    def test_create_announcement_empty_body(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.post("/admin/api/announcements", json={})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_update_announcement_not_found(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.put("/admin/api/announcements/9999", json={"title": "X"})
        assert resp.status_code == 404

    def test_delete_announcement_not_found(self, client, admin_user):
        with client.session_transaction() as sess:
            sess["user_id"] = admin_user.id
            sess["account_type"] = "admin"
        resp = client.delete("/admin/api/announcements/9999")
        assert resp.status_code == 404
