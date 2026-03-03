"""
Tests for app/blueprints/connections/routes.py API logic (Phase 4A)
Covers connection requests, accept/reject, removal and validation.
"""
import pytest
from app.models import User, Connection, ConnectionRequest, Notification
from app.extensions import db

class TestAuthConnectionsWave1:
    """Wave 1 – Send Connection Request"""
    
    def test_send_request_success(self, auth_client_student, second_student, app):
        client, sender = auth_client_student
        receiver = second_student
        
        resp = client.post("/api/connections/request", json={"receiver_id": receiver.id})
        assert resp.status_code == 200
        
        with app.app_context():
            req = ConnectionRequest.query.filter_by(sender_id=sender.id, receiver_id=receiver.id).first()
            assert req is not None
            assert req.status == "pending"

    def test_send_request_self(self, auth_client_student):
        client, sender = auth_client_student
        resp = client.post("/api/connections/request", json={"receiver_id": sender.id})
        assert resp.status_code == 400
        assert "yourself" in resp.json["error"]

    def test_send_request_duplicate(self, auth_client_student, second_student, app):
        client, sender = auth_client_student
        receiver = second_student
        
        # First request
        client.post("/api/connections/request", json={"receiver_id": receiver.id})
        # Duplicate
        resp = client.post("/api/connections/request", json={"receiver_id": receiver.id})
        assert resp.status_code == 400
        assert "already sent" in resp.json["error"]

    def test_send_request_already_connected(self, auth_client_student, app):
        client, sender = auth_client_student
        with app.app_context():
            other = User(
                first_name="Other", last_name="User", email="other@example.com",
                enrollment_no="O001", university="U", major="CS", batch="2026",
                account_type="student", status="ACTIVE", is_password_set=True
            )
            db.session.add(other)
            db.session.commit()
            other_id = other.id
            
            conn = Connection(user_id=min(sender.id, other_id), connected_user_id=max(sender.id, other_id))
            db.session.add(conn)
            db.session.commit()
            
        resp = client.post("/api/connections/request", json={"receiver_id": other_id})
        assert resp.status_code == 400
        assert "Already connected" in resp.json["error"]

    def test_send_request_reactivate_rejected(self, client, app, pending_connection_request):
        sender, receiver, req = pending_connection_request
        # Login as receiver to reject
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": receiver.enrollment_no, "password": "pass"
        })
        client.post(f"/api/connections/reject/{req.id}")
        
        # Now login as sender to re-send
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": sender.enrollment_no, "password": "pass"
        })
        resp = client.post("/api/connections/request", json={"receiver_id": receiver.id})
        assert resp.status_code == 200
        
        with app.app_context():
            re_req = db.session.get(ConnectionRequest, req.id)
            assert re_req.status == "pending"

    def test_send_request_invalid_user(self, auth_client_student):
        client, sender = auth_client_student
        resp = client.post("/api/connections/request", json={"receiver_id": 99999})
        assert resp.status_code == 404

class TestAuthConnectionsWave2:
    """Wave 2 – Accept / Reject"""

    def test_accept_request_success(self, pending_connection_request, client, app):
        sender, receiver, req = pending_connection_request
        # We need to be logged in as receiver
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": receiver.enrollment_no, "password": "pass"
        })
        
        resp = client.post(f"/api/connections/accept/{req.id}")
        assert resp.status_code == 200
        
        with app.app_context():
            checked_req = db.session.get(ConnectionRequest, req.id)
            assert checked_req.status == "accepted"
            conn = Connection.query.filter(
                or_(
                    and_(Connection.user_id == sender.id, Connection.connected_user_id == receiver.id),
                    and_(Connection.user_id == receiver.id, Connection.connected_user_id == sender.id)
                )
            ).first()
            assert conn is not None

    def test_accept_request_nonexistent(self, auth_client_student):
        client, user = auth_client_student
        resp = client.post("/api/connections/accept/99999")
        assert resp.status_code == 404

    def test_accept_request_unauthorized(self, pending_connection_request, client, app):
        sender, receiver, req = pending_connection_request
        # Login as someone else
        with app.app_context():
            other = User(
                first_name="Other", last_name="User", email="other2@example.com",
                enrollment_no="O002", university="U", major="CS", batch="2026",
                account_type="student", status="ACTIVE", is_password_set=True
            )
            other.set_password("pass")
            db.session.add(other)
            db.session.commit()
            other_enrollment = other.enrollment_no
            
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": other_enrollment, "password": "pass"
        })
        
        resp = client.post(f"/api/connections/accept/{req.id}")
        assert resp.status_code == 403

    def test_reject_request_success(self, pending_connection_request, client, app):
        sender, receiver, req = pending_connection_request
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": receiver.enrollment_no, "password": "pass"
        })
        
        resp = client.post(f"/api/connections/reject/{req.id}")
        assert resp.status_code == 200
        
        with app.app_context():
            checked_req = db.session.get(ConnectionRequest, req.id)
            assert checked_req.status == "rejected"

    def test_reject_request_nonexistent(self, auth_client_student):
        client, user = auth_client_student
        resp = client.post("/api/connections/reject/99999")
        assert resp.status_code == 404

    def test_reject_request_unauthorized(self, pending_connection_request, client, second_student):
        # Already logged in via auth_client_student in fixture if used, but here we need specific setup
        sender, receiver, req = pending_connection_request
        # Login as sender (unauthorized to reject)
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": sender.enrollment_no, "password": "pass"
        })
        
        resp = client.post(f"/api/connections/reject/{req.id}")
        assert resp.status_code == 403

class TestAuthConnectionsWave3:
    """Wave 3 – Removal & Validation"""

    def test_remove_connection_success(self, two_connected_users, client, app):
        user1, user2 = two_connected_users
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": user1.enrollment_no, "password": "pass"
        })
        
        resp = client.delete(f"/api/connections/{user2.id}")
        assert resp.status_code == 200
        
        with app.app_context():
            conn = Connection.query.filter(
                or_(
                    and_(Connection.user_id == user1.id, Connection.connected_user_id == user2.id),
                    and_(Connection.user_id == user2.id, Connection.connected_user_id == user1.id)
                )
            ).first()
            assert conn is None

    def test_remove_connection_nonexistent(self, auth_client_student):
        client, user = auth_client_student
        resp = client.delete("/api/connections/99999")
        assert resp.status_code == 404

    def test_missing_payload(self, auth_client_student):
        client, user = auth_client_student
        resp = client.post("/api/connections/request", json={})
        assert resp.status_code == 400

    def test_invalid_id_type(self, auth_client_student):
        client, user = auth_client_student
        # Flask usually handles <int:id> but for JSON bodies it's up to us
        resp = client.post("/api/connections/request", json={"receiver_id": "not-an-int"})
        # The code does db.session.get(User, receiver_id). If receiver_id is "abc", get() might return None or error.
        # In connections/routes.py: receiver = db.session.get(User, receiver_id)
        # SQLAlchemy get() handles various types but usually returns None if not found or incompatible.
        # However, many APIs expect 400 for bad types.
        assert resp.status_code in (400, 404)

class TestAuthConnectionsWave4:
    """Wave 4 – GET Routes"""

    def test_get_suggestions(self, auth_client_student, app):
        client, user = auth_client_student
        with app.app_context():
            # Add a user with same university/major to priority 1
            u1 = User(
                first_name="Sug1", last_name="U", email="sug1@example.com",
                enrollment_no="S1", university=user.university, major=user.major,
                batch="2026", account_type="student", status="ACTIVE"
            )
            db.session.add(u1)
            db.session.commit()

        resp = client.get("/api/suggestions")
        assert resp.status_code == 200
        assert len(resp.json["suggestions"]) > 0

    def test_get_pending_requests(self, pending_connection_request, client):
        sender, receiver, req = pending_connection_request
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": receiver.enrollment_no, "password": "pass"
        })
        
        resp = client.get("/api/connections/pending")
        assert resp.status_code == 200
        assert resp.json["count"] > 0
        assert resp.json["requests"][0]["request_id"] == req.id

    def test_get_sent_requests(self, pending_connection_request, client):
        sender, receiver, req = pending_connection_request
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": sender.enrollment_no, "password": "pass"
        })
        
        resp = client.get("/api/connections/sent")
        assert resp.status_code == 200
        assert resp.json["count"] > 0
        assert resp.json["requests"][0]["request_id"] == req.id

    def test_get_connections_list(self, two_connected_users, client):
        user1, user2 = two_connected_users
        client.post("/api/auth/login", json={
            "role": "student", "enrollment_no": user1.enrollment_no, "password": "pass"
        })
        
        resp = client.get("/api/connections/list")
        assert resp.status_code == 200
        assert resp.json["count"] > 0
        assert resp.json["connections"][0]["id"] == user2.id

from sqlalchemy import or_, and_
