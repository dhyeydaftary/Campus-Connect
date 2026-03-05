import pytest

def test_health_check_success(client):
    """
    Test the /health endpoint when the application and DB are healthy.
    """
    response = client.get('/health')
    assert response.status_code == 200
    
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "Campus Connect"
    assert data["database"] == "ok"

def test_health_check_db_failure(client, monkeypatch):
    """
    Test the /health endpoint handles database connection errors gracefully.
    """
    from sqlalchemy.exc import OperationalError
    
    # Mock the db.session.execute method to raise an error
    def mock_execute(*args, **kwargs):
        raise OperationalError("Connection failed", None, None)
        
    from app.blueprints.health import db
    monkeypatch.setattr(db.session, "execute", mock_execute)
    
    response = client.get('/health')
    assert response.status_code == 503
    
    data = response.get_json()
    assert data["status"] == "error"
    assert data["service"] == "Campus Connect"
    assert data["database"] == "down"
    assert "message" in data
