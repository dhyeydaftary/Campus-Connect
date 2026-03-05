import pytest
from app.models import User
from app.extensions import db

def test_chat_send_fuzz_payloads(auth_client_student):
    client, user = auth_client_student
    
    # Example payloads from Phase 8C requirements
    payloads = [
        {"message": None},
        {"message": 123},
        {"participants": ["bad", {}, []]},
        {"limit": "DROP TABLE"},
        {"room_id": "abc"},
        "not a json",
        None,
        [],
        {"extra_field": "value"},
    ]
    
    for payload in payloads:
        # We use various endpoints to test general robustness
        resp = client.post("/api/chat/send", json=payload)
        # 400 Bad Request or 422 Unprocessable Entity are acceptable, 500 is NOT.
        assert resp.status_code in (400, 422, 404, 415), f"Fuzz payload {payload} produced {resp.status_code}"

def test_connection_request_fuzz_payloads(auth_client_student):
    client, user = auth_client_student
    payloads = [
        {"receiver_id": None},
        {"receiver_id": "string-instead-of-int"},
        {"receiver_id": -1},
        {"receiver_id": 999999},
        {},
        {"garbage": "data"}
    ]
    
    for payload in payloads:
        resp = client.post("/api/connections/request", json=payload)
        assert resp.status_code in (400, 404, 422), f"Fuzz payload {payload} produced {resp.status_code}"

def test_event_registration_fuzz_payloads(auth_client_student):
    client, user = auth_client_student
    # No specific payload for registration usually besides the URL param, 
    # but let's check if sending a body where none is expected causes issues
    payloads = [
        {"event_id": "inject"},
        None,
        123
    ]
    
    for payload in payloads:
        # Assuming URL is /api/events/register/<int:event_id>
        resp = client.post("/api/events/register/999", json=payload)
        assert resp.status_code != 500, f"Fuzz payload {payload} produced 500 on event register"

def test_profile_update_fuzz_payloads(auth_client_student):
    client, user = auth_client_student
    payloads = [
        {"first_name": None},
        {"first_name": 123},
        {"major": ["not", "a", "string"]},
        {"university": {"nested": "object"}},
        {"batch": "too long" * 100}
    ]
    
    for payload in payloads:
        resp = client.put("/api/profile/update", json=payload)
        assert resp.status_code != 500, f"Fuzz payload {payload} produced 500 on profile update"
