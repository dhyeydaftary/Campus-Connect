import pytest
from app.models import db, User, Conversation, Message
import io

class TestChatApiDeep:
    @pytest.fixture
    def other_user(self, app):
        with app.app_context():
            user = User(
                first_name="Other",
                last_name="User",
                email="other@chat.com",
                enrollment_no="CHAT2",
                university="U",
                major="CS",
                batch="26",
                account_type="student",
                status="ACTIVE",
                is_password_set=True
            )
            db.session.add(user)
            db.session.commit()
            return user.id

    @pytest.fixture
    def setup_conversation(self, auth_client_student, other_user, app):
        client, user = auth_client_student
        with app.app_context():
            u1, u2 = sorted([user.id, other_user])
            conv = Conversation(user1_id=u1, user2_id=u2)
            db.session.add(conv)
            db.session.commit()
            return conv.id

    # 1. Create Chat Room
    def test_create_chat_room_success(self, auth_client_student, app):
        client, user = auth_client_student
        with app.app_context():
            u2 = User(first_name="U2", last_name="L2", email="u2@chat.com", enrollment_no="U2", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add(u2)
            db.session.commit()
            u2_id = u2.id
            
        resp = client.post("/api/chats/start", json={"recipient_id": u2_id})
        assert resp.status_code == 201
        assert resp.get_json()["status"] == "created"

    def test_create_chat_room_duplicate(self, auth_client_student, other_user, setup_conversation):
        client, user = auth_client_student
        # Existing conversation returns 409 (Requirement)
        resp = client.post("/api/chats/start", json={"recipient_id": other_user})
        # Currently returns 200, but requirement says 409. We expect failure until hardened.
        assert resp.status_code == 409

    def test_create_chat_room_missing_payload(self, auth_client_student):
        client, user = auth_client_student
        resp = client.post("/api/chats/start", json={})
        assert resp.status_code == 400

    def test_create_chat_room_invalid_id(self, auth_client_student):
        client, user = auth_client_student
        resp = client.post("/api/chats/start", json={"recipient_id": "not-an-id"})
        assert resp.status_code == 400

    def test_create_chat_room_unauthorized(self, client):
        resp = client.post("/api/chats/start", json={"recipient_id": 1})
        assert resp.status_code == 401

    # 2. Fetch Chat History
    def test_get_messages_success(self, auth_client_student, other_user, setup_conversation, app):
        client, user = auth_client_student
        with app.app_context():
            # Add a message
            msg = Message(conversation_id=setup_conversation, sender_id=user.id, receiver_id=other_user, content="Hello")
            db.session.add(msg)
            db.session.commit()
            
        resp = client.get(f"/api/messages/{setup_conversation}")
        assert resp.status_code == 200
        assert len(resp.get_json()) == 1

    def test_get_messages_not_participant(self, auth_client_student, app):
        client, user = auth_client_student
        with app.app_context():
            # Create two real users
            u1_obj = User(first_name="U1", last_name="L1", email="u1_np@chat.com", enrollment_no="UNP1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            u2_obj = User(first_name="U2", last_name="L2", email="u2_np@chat.com", enrollment_no="UNP2", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add_all([u1_obj, u2_obj])
            db.session.commit()
            
            u1_id, u2_id = sorted([u1_obj.id, u2_obj.id])
            c = Conversation(user1_id=u1_id, user2_id=u2_id)
            db.session.add(c)
            db.session.commit()
            cid = c.id
            
        resp = client.get(f"/api/messages/{cid}")
        assert resp.status_code == 403

    def test_get_messages_nonexistent(self, auth_client_student):
        client, user = auth_client_student
        resp = client.get("/api/messages/99999")
        assert resp.status_code == 404

    # 3. Send Message via REST
    def test_send_message_rest_success(self, auth_client_student, other_user):
        client, user = auth_client_student
        resp = client.post("/api/chats/send_message", json={
            "recipient_id": other_user,
            "content": "REST Message"
        })
        assert resp.status_code == 201

    def test_send_message_rest_empty_content(self, auth_client_student, other_user):
        client, user = auth_client_student
        resp = client.post("/api/chats/send_message", json={"recipient_id": other_user, "content": ""})
        assert resp.status_code == 400

    def test_send_message_rest_too_long(self, auth_client_student, other_user):
        client, user = auth_client_student
        long_content = "A" * 5001
        resp = client.post("/api/chats/send_message", json={"recipient_id": other_user, "content": long_content})
        assert resp.status_code == 400
        assert "too long" in resp.get_json()["error"].lower()

    def test_send_message_rest_not_participant(self, auth_client_student):
        # In send_message_http, it creates a conversation if it doesn't exist.
        # So "not participant" is hard to trigger unless we block self-chat.
        client, user = auth_client_student
        resp = client.post("/api/chats/send_message", json={"recipient_id": user.id, "content": "Self"})
        assert resp.status_code == 400

    # 4. Delete Message (Hardening requirement)
    def test_delete_message_success(self, auth_client_student, other_user, setup_conversation, app):
        client, user = auth_client_student
        with app.app_context():
            m = Message(conversation_id=setup_conversation, sender_id=user.id, receiver_id=other_user, content="To delete")
            db.session.add(m)
            db.session.commit()
            mid = m.id
            
        resp = client.delete(f"/api/messages/{mid}")
        # This will fail 404 until implemented.
        assert resp.status_code == 200

    def test_delete_message_unauthorized(self, auth_client_student, app):
        client, user = auth_client_student
        with app.app_context():
            u1_obj = User(first_name="U1", last_name="L1", email="u1_del@chat.com", enrollment_no="UDEL1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            u2_obj = User(first_name="U2", last_name="L2", email="u2_del@chat.com", enrollment_no="UDEL2", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add_all([u1_obj, u2_obj])
            db.session.commit()
            
            u1_id, u2_id = sorted([u1_obj.id, u2_obj.id])
            c = Conversation(user1_id=u1_id, user2_id=u2_id)
            db.session.add(c)
            db.session.commit()
            
            m = Message(conversation_id=c.id, sender_id=u1_obj.id, receiver_id=u2_obj.id, content="Other's")
            db.session.add(m)
            db.session.commit()
            mid = m.id
            
        resp = client.delete(f"/api/messages/{mid}")
        assert resp.status_code == 403

    def test_delete_message_nonexistent(self, auth_client_student):
        client, user = auth_client_student
        resp = client.delete("/api/messages/99999")
        assert resp.status_code == 404

    # Other coverage gaps
    def test_get_chats_list(self, auth_client_student, other_user, setup_conversation, app):
        client, user = auth_client_student
        with app.app_context():
            # Need a message to show in get_chats
            m = Message(conversation_id=setup_conversation, sender_id=user.id, receiver_id=other_user, content="Show me")
            db.session.add(m)
            db.session.commit()
            
        resp = client.get("/api/chats")
        assert resp.status_code == 200
        assert len(resp.get_json()) > 0

    def test_mark_read_success(self, auth_client_student, other_user, setup_conversation, app):
        client, user = auth_client_student
        with app.app_context():
            m = Message(conversation_id=setup_conversation, sender_id=other_user, receiver_id=user.id, content="Unread")
            db.session.add(m)
            db.session.commit()
            
        resp = client.post(f"/api/messages/{setup_conversation}/mark-read")
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

    def test_upload_attachment_success(self, auth_client_student):
        client, user = auth_client_student
        data = {
            'file': (io.BytesIO(b"dummy image"), 'test.png')
        }
        resp = client.post("/api/chat/upload", data=data, content_type='multipart/form-data')
        assert resp.status_code == 200
        assert "url" in resp.get_json()

    def test_search_users(self, auth_client_student, app):
        client, user = auth_client_student
        with app.app_context():
            u = User(first_name="SearchMe", last_name="User", email="search@chat.com", enrollment_no="S1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add(u)
            db.session.commit()
            
        resp = client.get("/api/users/search?q=SearchMe")
        assert resp.status_code == 200
        assert len(resp.get_json()) > 0
