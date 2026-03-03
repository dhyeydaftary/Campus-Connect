import pytest
from app.models import db, Notification, User

class TestNotificationsApiDeep:
    def test_get_unread_count(self, auth_client_student, app):
        """Verify unread-count endpoint returns correct count."""
        client, user = auth_client_student
        with app.app_context():
            # Clear existing
            Notification.query.filter_by(user_id=user.id).delete()
            # Add 3 unread
            for i in range(3):
                n = Notification(user_id=user.id, actor_id=1, type='post_comment', message=f"M{i}")
                db.session.add(n)
            db.session.commit()
            
        resp = client.get("/api/notifications/unread-count")
        assert resp.status_code == 200
        assert resp.get_json()["count"] == 3

    def test_mark_all_read_idempotent(self, auth_client_student, app):
        """Verify mark-all-read is idempotent and works when 0 unread."""
        client, user = auth_client_student
        # 1. Mark all read when there are some
        client.post("/api/notifications/mark-all-read")
        
        # 2. Mark all read when there are zero unread
        resp = client.post("/api/notifications/mark-all-read")
        assert resp.status_code == 200
        # routes.py returns {"success": True} for mark_all_notifications_read
        assert resp.get_json()["success"] is True

    def test_mark_notification_read_unauthorized(self, auth_client_student, app):
        """Verify user cannot mark someone else's notification as read."""
        client, user = auth_client_student
        with app.app_context():
            other_user = User(first_name="O", last_name="U", email="o@notif.com", enrollment_no="ON1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add(other_user)
            db.session.flush()
            n = Notification(user_id=other_user.id, actor_id=user.id, type='post_comment', message="Oth")
            db.session.add(n)
            db.session.commit()
            notif_id = n.id
            
        # The route is /api/notifications/mark-read/<id>
        resp = client.post(f"/api/notifications/mark-read/{notif_id}")
        assert resp.status_code == 403

    def test_get_notifications_unread_count_in_response(self, auth_client_student, app):
        """Verify the main list endpoint includes unread_count and actor info."""
        client, user = auth_client_student
        with app.app_context():
            # Create a notification where actor exists
            n = Notification(user_id=user.id, actor_id=user.id, type='post_comment', message="Info")
            db.session.add(n)
            db.session.commit()
            
        resp = client.get("/api/notifications")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "unread_count" in data
        # Check for actor info in one of the notifications
        assert any(n["actor"] is not None for n in data["notifications"])

    def test_mark_nonexistent_read(self, auth_client_student):
        """Verify 404 for non-existent notification read request."""
        client, user = auth_client_student
        resp = client.post("/api/notifications/mark-read/99999")
        assert resp.status_code == 404

    def test_mark_notification_read_success(self, auth_client_student, app):
        """Verify successful marking of a notification as read."""
        client, user = auth_client_student
        with app.app_context():
            n = Notification(user_id=user.id, actor_id=user.id, type='post_comment', message="Self")
            db.session.add(n)
            db.session.commit()
            notif_id = n.id
            
        resp = client.post(f"/api/notifications/mark-read/{notif_id}")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        
        with app.app_context():
            assert db.session.get(Notification, notif_id).is_read is True

    def test_clear_notifications(self, auth_client_student, app):
        """Verify clearing all notifications for a user."""
        client, user = auth_client_student
        with app.app_context():
            n = Notification(user_id=user.id, actor_id=user.id, type='post_comment', message="N")
            db.session.add(n)
            db.session.commit()
            
        resp = client.post("/api/notifications/clear")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True
        
        with app.app_context():
            assert Notification.query.filter_by(user_id=user.id).count() == 0
