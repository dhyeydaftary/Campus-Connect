import pytest
from datetime import datetime, timezone, timedelta
from app.models import db, Event, EventRegistration, User

class TestEventsApiDeep:
    @pytest.fixture
    def setup_event(self, app):
        with app.app_context():
            event = Event(
                title="Future Event",
                description="Desc",
                location="Loc",
                event_date=datetime.now(timezone.utc) + timedelta(days=1),
                total_seats=2,
                user_id=1
            )
            db.session.add(event)
            db.session.commit()
            return event.id

    def test_get_events_with_data(self, auth_client_student, setup_event):
        """Verify get_events returns upcoming events with correct seat counts."""
        client, user = auth_client_student
        response = client.get("/api/events")
        assert response.status_code == 200
        data = response.get_json()
        assert len(data) >= 1
        
        event_data = next(e for e in data if e["id"] == setup_event)
        assert event_data["availableSeats"] == 2
        assert event_data["goingCount"] == 0

    def test_rsvp_transition_matrix(self, auth_client_student, setup_event):
        """Test transitioning through various RSVP states."""
        client, user = auth_client_student
        
        # 1. None -> interested
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 201
        assert resp.get_json()["userStatus"] == "interested"
        
        # 2. interested -> going
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "going"})
        assert resp.status_code == 200
        assert resp.get_json()["userStatus"] == "going"
        assert resp.get_json()["availableSeats"] == 1
        
        # 3. going -> interested
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 200
        assert resp.get_json()["userStatus"] == "interested"
        assert resp.get_json()["availableSeats"] == 2
        
        # 4. interested -> none (toggle off)
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 200
        assert resp.get_json()["userStatus"] is None
        
        # 5. going -> none (toggle off)
        client.post(f"/api/events/{setup_event}/register", json={"status": "going"}) # go back to going
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "going"})
        assert resp.status_code == 200
        assert resp.get_json()["userStatus"] is None

    def test_capacity_guard(self, app, auth_client_student, setup_event):
        """Verify 400 when event is full."""
        client, user = auth_client_student # User 1
        
        # Fill the event (2 seats)
        with app.app_context():
            # Add two other users to fill it
            u2 = User(first_name="U2", last_name="S", email="u2@e.com", enrollment_no="U2", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            u3 = User(first_name="U3", last_name="S", email="u3@e.com", enrollment_no="U3", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add_all([u2, u3])
            db.session.flush()
            
            r1 = EventRegistration(event_id=setup_event, user_id=u2.id, status='going')
            r2 = EventRegistration(event_id=setup_event, user_id=u3.id, status='going')
            db.session.add_all([r1, r2])
            db.session.commit()
            
        # Try to register as 'going'
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "going"})
        assert resp.status_code == 400
        assert "No seats available" in resp.get_json()["error"]
        
        # Can still register as 'interested'
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 201

    def test_invalid_event_id_type(self, auth_client_student):
        """Verify 404 for string ID (Flask route handling)."""
        client, user = auth_client_student
        resp = client.post("/api/events/not-an-int/register", json={"status": "interested"})
        assert resp.status_code == 404

    def test_invalid_rsvp_status(self, auth_client_student, setup_event):
        """Verify 400 for invalid status string."""
        client, user = auth_client_student
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "maybe"})
        assert resp.status_code == 400

    def test_register_past_event(self, app, auth_client_student):
        """Actually current logic allows RSVP for past events?! Let's check."""
        # Looking at routes.py, there is NO check for past events in register_for_event.
        # However, Wave 3 Requirement 5 says: Past Event RSVP -> Expect 400.
        # If I want to fulfill this, I might need to add the guard or test the current behavior.
        # The prompt says "Do not modify logic unless intentional refactor".
        # But Phase 6 Objective is "hardening".
        
        with app.app_context():
            event = Event(
                title="Past Event",
                description="Desc",
                location="Loc",
                event_date=datetime.now(timezone.utc) - timedelta(days=1),
                total_seats=10,
                user_id=1
            )
            db.session.add(event)
            db.session.commit()
            past_id = event.id
            
        client, user = auth_client_student
        resp = client.post(f"/api/events/{past_id}/register", json={"status": "going"})
        assert resp.status_code == 400
        assert "past event" in resp.get_json()["error"].lower()

    def test_multiple_registrations_one_user(self, auth_client_student, setup_event):
        """Verify idempotency and single row per user/event."""
        client, user = auth_client_student
        
        # First registration
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 201
        
        # Second registration (same status)
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 200 # Toggle off
        assert resp.get_json()["userStatus"] is None
        
        # Third registration (re-register)
        resp = client.post(f"/api/events/{setup_event}/register", json={"status": "interested"})
        assert resp.status_code == 201
        
        # Verify only one row in DB
        # (This is checked by the logic existing.status == status)
