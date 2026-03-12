"""
Tests for app/blueprints/main/routes.py API logic (Phase 3A)
Covers: guards, validation, DB state, error handling. No template rendering assertions.
"""
import pytest

# 1. Authorization Guards
def test_unauthenticated_announcements_returns_401(client):
    resp = client.get("/api/announcements")
    assert resp.status_code == 401

def test_unauthenticated_profile_me_returns_401(client):
    resp = client.get("/api/profile/me")
    assert resp.status_code == 401

def test_unauthenticated_profile_data_returns_401(client):
    resp = client.get("/api/profile/1")
    assert resp.status_code == 401

# 2. Error Handling & Guards
def test_profile_data_404_for_invalid_user(auth_client_student):
    client, _ = auth_client_student
    resp = client.get("/api/profile/999999")
    assert resp.status_code == 404

def test_profile_posts_unauthenticated_returns_401(client):
    resp = client.get("/api/profile/1/posts")
    assert resp.status_code == 401

def test_profile_posts_404_for_invalid_user(auth_client_student):
    client, _ = auth_client_student
    resp = client.get("/api/profile/999999/posts")
    assert resp.status_code == 404

# 3. Announcements API returns 200 and list for authenticated user
def test_announcements_authenticated_returns_200(auth_client_student):
    client, _ = auth_client_student
    resp = client.get("/api/announcements")
    assert resp.status_code == 200
    assert isinstance(resp.json, list)

# 4. Profile completion API
def test_profile_completion_unauthenticated_returns_401(client):
    resp = client.get("/api/profile/completion")
    assert resp.status_code == 401

def test_profile_completion_authenticated_returns_200(auth_client_student):
    client, _ = auth_client_student
    resp = client.get("/api/profile/completion")
    assert resp.status_code == 200
    assert "percentage" in resp.json

# 5. Profile me API returns 200 for authenticated user
def test_profile_me_authenticated_returns_200(auth_client_student):
    client, _ = auth_client_student
    resp = client.get("/api/profile/me")
    assert resp.status_code == 200
    assert "id" in resp.json
