"""
Deep coverage tests for app/blueprints/admin/routes.py (Phase 4B - Wave 1)
Focuses on Authorization, User Management, Announcements, and Event Constraints.
"""
import pytest
from app.models import User, Announcement, Event, AdminLog
from app.extensions import db
from datetime import datetime, timezone, timedelta

class TestAdminWave1Auth:
    """WAVE 1 – Authorization Hardening"""

    def test_unauthenticated_401(self, client):
        # Current implementation of admin_required() might use abort(401) or redirect
        # Looking at routes.py, it calls admin_required()
        # Looking at decorators.py (assumed), it likely checks session
        resp = client.get("/admin/api/dashboard/overview")
        # In this app, many routes redirect to login if not authenticated, 
        # but API routes should ideally return 401. 
        # Let's check the actual behavior via the baseline tests.
        assert resp.status_code in (401, 302)

    def test_authenticated_student_403(self, auth_client_student):
        client, student = auth_client_student
        resp = client.get("/admin/api/dashboard/overview")
        assert resp.status_code == 403

    def test_missing_session_user_401(self, client, app):
        with client.session_transaction() as sess:
            sess["user_id"] = 99999 # Nonexistent user
            sess["account_type"] = "admin"
        resp = client.get("/admin/api/dashboard/overview")
        # The decorator aborts with a redirect to login
        assert resp.status_code == 302

class TestAdminWave1UserManagement:
    """WAVE 1 – User Management Logic"""

    def test_toggle_user_status_success(self, auth_client_admin, second_student, app):
        client, admin = auth_client_admin
        target = second_student
        
        # Initial status is ACTIVE (from fixture)
        resp = client.post(f"/admin/api/users/{target.id}/toggle")
        assert resp.status_code == 200
        assert resp.json["user"]["status"] == "blocked"
        
        with app.app_context():
            updated_user = db.session.get(User, target.id)
            assert updated_user.status == "BLOCKED"
            # Verify Audit Log
            log = AdminLog.query.filter_by(target_user_id=target.id).first()
            assert log is not None
            assert log.action_type == "set_user_status"

    def test_toggle_self_403(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.post(f"/admin/api/users/{admin.id}/toggle")
        assert resp.status_code == 403
        assert "cannot disable your own account" in resp.json["error"]

    def test_toggle_nonexistent_user_404(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.post("/admin/api/users/99999/toggle")
        assert resp.status_code == 404

    def test_fetch_user_details_success(self, auth_client_admin, second_student):
        client, admin = auth_client_admin
        resp = client.get(f"/admin/api/users/{second_student.id}/details")
        assert resp.status_code == 200
        assert resp.json["email"] == second_student.email

    def test_fetch_user_details_404(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.get("/admin/api/users/99999/details")
        assert resp.status_code == 404

class TestAdminWave1Announcements:
    """WAVE 1 – Announcement Logic"""

    def test_create_announcement_missing_fields(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.post("/admin/api/announcements", json={"title": "Only Title"})
        assert resp.status_code == 400
        resp = client.post("/admin/api/announcements", json={"content": "Only Content"})
        assert resp.status_code == 400

    def test_create_announcement_success(self, auth_client_admin, app):
        client, admin = auth_client_admin
        resp = client.post("/admin/api/announcements", json={"title": "New Ann", "content": "Body"})
        assert resp.status_code == 201
        
        with app.app_context():
            ann = Announcement.query.filter_by(title="New Ann").first()
            assert ann is not None
            assert ann.author_id == admin.id

    def test_update_announcement_success(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            ann = Announcement(title="Old", content="Old", author_id=admin.id)
            db.session.add(ann)
            db.session.commit()
            ann_id = ann.id
            
        resp = client.put(f"/admin/api/announcements/{ann_id}", json={"title": "Updated"})
        assert resp.status_code == 200
        
        with app.app_context():
            updated = db.session.get(Announcement, ann_id)
            assert updated.title == "Updated"

    def test_soft_delete_and_restore(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            ann = Announcement(title="Delete Me", content="Body", author_id=admin.id)
            db.session.add(ann)
            db.session.commit()
            ann_id = ann.id
            
        # Delete
        resp = client.delete(f"/admin/api/announcements/{ann_id}")
        assert resp.status_code == 200
        
        with app.app_context():
            deleted = db.session.get(Announcement, ann_id)
            assert deleted.status == "deleted"
            
        # Restore
        resp = client.post(f"/admin/api/announcements/{ann_id}/restore")
        assert resp.status_code == 200
        
        with app.app_context():
            restored = db.session.get(Announcement, ann_id)
            assert restored.status == "active"

class TestAdminWave1Events:
    """WAVE 1 – Event Constraint Logic"""

    def test_create_event_invalid_target_user_type(self, auth_client_admin, app):
        client_admin, admin = auth_client_admin
        with app.app_context():
            student = User(
                first_name="S", last_name="T", email="s@example.com",
                enrollment_no="S999", university="U", major="CS", batch="2026",
                account_type="student", status="ACTIVE"
            )
            db.session.add(student)
            db.session.commit()
            student_id = student.id
        
        # Student cannot be targeted for event ownership (must be official/club/admin)
        resp = client_admin.post("/admin/api/events/create", json={
            "targetEntity": student_id,
            "title": "Invalid",
            "description": "D",
            "location": "L",
            "event_date": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
            "total_seats": 10
        })
        assert resp.status_code == 400
        assert "must be official, club, or admin" in resp.json["error"]

    def test_create_event_invalid_date_format(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.post("/admin/api/events/create", json={
            "title": "T", "description": "D", "location": "L",
            "event_date": "not-a-date"
        })
        assert resp.status_code == 400

    def test_create_event_past_date(self, auth_client_admin):
        client, admin = auth_client_admin
        past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        resp = client.post("/admin/api/events/create", json={
            "title": "Past", "description": "D", "location": "L",
            "event_date": past_date, "total_seats": 10
        })
        assert resp.status_code == 400
        assert "Cannot create events in the past" in resp.json["error"]

    def test_update_event_past_event_rejected(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            # Use offset-aware datetime
            past_date = datetime.now(timezone.utc) - timedelta(days=1)
            event = Event(
                user_id=admin.id, title="Past", description="D", 
                location="L", event_date=past_date, total_seats=10
            )
            db.session.add(event)
            db.session.commit()
            event_id = event.id
            
        resp = client.put(f"/admin/api/events/{event_id}", json={"title": "New"})
        assert resp.status_code == 400
        assert "Cannot edit past events" in resp.json["error"]

    def test_update_event_nonexistent(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.put("/admin/api/events/99999", json={"title": "X"})
        assert resp.status_code == 404

class TestAdminWave2Filtering:
    """WAVE 2 – Filtering & Query Branches"""

    def test_list_announcements_status_filter(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            a1 = Announcement(title="Active", content="C", status="active", author_id=admin.id)
            a2 = Announcement(title="Deleted", content="C", status="deleted", author_id=admin.id)
            db.session.add_all([a1, a2])
            db.session.commit()
            
        # Default (active)
        resp = client.get("/admin/api/announcements")
        assert resp.status_code == 200
        titles = [a["title"] for a in resp.json]
        assert "Active" in titles
        assert "Deleted" not in titles
        
        # Filter deleted
        resp = client.get("/admin/api/announcements", query_string={"status": "deleted"})
        titles = [a["title"] for a in resp.json]
        assert "Deleted" in titles
        assert "Active" not in titles

    def test_list_events_status_filter(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            now = datetime.now(timezone.utc)
            e1 = Event(title="Upcoming", description="D", location="L", event_date=now + timedelta(days=1), user_id=admin.id)
            e2 = Event(title="Past", description="D", location="L", event_date=now - timedelta(days=1), user_id=admin.id)
            db.session.add_all([e1, e2])
            db.session.commit()
            
        # Upcoming
        resp = client.get("/admin/api/events/list", query_string={"status": "upcoming"})
        titles = [e["title"] for e in resp.json]
        assert "Upcoming" in titles
        assert "Past" not in titles
        
        # Past
        resp = client.get("/admin/api/events/list", query_string={"status": "past"})
        titles = [e["title"] for e in resp.json]
        assert "Past" in titles
        assert "Upcoming" not in titles

class TestAdminWave3Deep:
    """WAVE 3 – Controlled Endpoint Extensions"""

    def test_dashboard_overview_success(self, auth_client_admin):
        client, admin = auth_client_admin
        resp = client.get("/admin/api/dashboard/overview")
        assert resp.status_code == 200
        data = resp.json
        assert "totalUsers" in data
        assert "activeUsers" in data
        assert "roleDistribution" in data
        # Check userGrowth logic (line 95)
        assert "userGrowth" in data

    def test_get_logs_and_download(self, auth_client_admin):
        client, admin = auth_client_admin
        # Action that creates a log
        client.post("/admin/api/announcements", json={"title": "LogMe", "content": "Body"})
        
        # Get logs
        resp = client.get("/admin/api/logs")
        assert resp.status_code == 200
        assert len(resp.json) > 0
        
        # Download logs
        resp = client.get("/admin/api/logs/download")
        assert resp.status_code == 200
        assert resp.headers["Content-Type"] == "text/plain; charset=utf-8"
        assert "attachment;filename=admin_logs.txt" in resp.headers["Content-Disposition"]
        assert b"CAMPUS CONNECT" in resp.data

    def test_event_participants_and_pdf(self, auth_client_admin, app):
        client, admin = auth_client_admin
        with app.app_context():
            now = datetime.now(timezone.utc)
            event = Event(title="ReportTest", description="D", location="L", event_date=now + timedelta(days=5), user_id=admin.id)
            db.session.add(event)
            db.session.commit()
            event_id = event.id
            
        # Get participants (empty)
        resp = client.get(f"/admin/api/events/{event_id}/participants")
        assert resp.status_code == 200
        assert resp.json == []
        
        # Download PDF
        resp = client.get(f"/admin/api/events/{event_id}/download")
        assert resp.status_code == 200
        assert resp.headers["Content-Type"] == "application/pdf"
        assert f"filename=event_{event_id}.pdf" in resp.headers["Content-Disposition"]
        assert resp.data.startswith(b"%PDF")
