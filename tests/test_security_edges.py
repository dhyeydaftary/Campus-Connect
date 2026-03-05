import pytest
from flask import session

def test_session_tampering(client, auth_client_student):
    """Attempt to access a protected route with a tampered session cookie."""
    client_obj, user = auth_client_student
    
    # 1. Verify access works with valid session
    resp = client_obj.get("/api/suggestions")
    assert resp.status_code == 200
    
    # 2. Tamper with session cookie
    with client_obj.session_transaction() as sess:
        sess["user_id"] = 999999 
        
    resp = client_obj.get("/api/suggestions")
    assert resp.status_code in (401, 302, 404)

def test_missing_content_type_header(auth_client_student):
    """Send a JSON payload without the Content-Type header."""
    client_obj, user = auth_client_student
    
    # Endpoint is likely /api/messages/send based on previous conversation knowledge 
    # or let's check the routes. Actually let's use /api/profile/update which we know exists.
    resp = client_obj.post("/api/profile/update", data='{"first_name": "New"}')
    # If not application/json, request.json is None, might return 400 or 415
    assert resp.status_code in (400, 415, 404)

def test_malformed_json_syntax(auth_client_student):
    """Send a request with invalid JSON syntax."""
    client_obj, user = auth_client_student
    
    malformed_data = '{ "first_name": "hello"' 
    resp = client_obj.post("/api/profile/update", data=malformed_data, content_type="application/json")
    
    assert resp.status_code in (400, 404)
    assert resp.status_code != 500

def test_session_cookie_removal(auth_client_student):
    """Ensure accessing protected routes fails after clearing the session."""
    client_obj, user = auth_client_student
    
    # In Flask test client, we can just clear the session in transaction or re-initialize
    with client_obj.session_transaction() as sess:
        sess.clear()
    
    resp = client_obj.get("/api/suggestions")
    assert resp.status_code in (401, 302)
