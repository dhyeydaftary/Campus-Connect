"""
Deep coverage tests for app/blueprints/main/routes.py (Phase 4C - Wave 1)
Focuses on Pagination, Search, Profile Access, and Announcements.
"""
import pytest
from app.models import User, Announcement, Post, Skill, Experience, Education
from app.extensions import db

class TestMainPagination:
    """Wave 1 – Pagination Guard Branches"""

    def test_announcements_pagination_limits(self, auth_client_student):
        client, student = auth_client_student
        
        # Valid limit
        resp = client.get("/api/announcements", query_string={"limit": 5})
        assert resp.status_code == 200
        
        # Limit as 0 (valid in SQL, usually returns empty or ignored)
        # Looking at routes.py: limit = request.args.get("limit", type=int)
        # if limit: query.limit(limit)
        # if limit is 0, it evaluates to False, so it returns all. This is a branch.
        resp = client.get("/api/announcements", query_string={"limit": 0})
        assert resp.status_code == 200

        # Invalid limit type (string) -> request.args.get(..., type=int) returns None if invalid
        resp = client.get("/api/announcements", query_string={"limit": "abc"})
        assert resp.status_code == 200 # Should fall back to no limit

    def test_profile_posts_pagination(self, auth_client_student, second_student, app):
        client, student = auth_client_student
        
        # Create some posts for second_student
        with app.app_context():
            for i in range(3):
                post = Post(user_id=second_student.id, caption=f"Post {i}")
                db.session.add(post)
            db.session.commit()
            target_id = second_student.id

        # Valid page/limit
        resp = client.get(f"/api/profile/{target_id}/posts", query_string={"page": 1, "limit": 2})
        assert resp.status_code == 200
        assert len(resp.json["posts"]) == 2

        # Page 2
        resp = client.get(f"/api/profile/{target_id}/posts", query_string={"page": 2, "limit": 2})
        assert resp.status_code == 200
        assert len(resp.json["posts"]) == 1

        # Invalid types -> int(request.args.get("page", 1)) will raise ValueError if invalid
        # Let's check routes.py line 235: int(request.args.get("page", 1))
        # This will actually 400 or 500 if not handled.
        resp = client.get(f"/api/profile/{target_id}/posts", query_string={"page": "abc"})
        assert resp.status_code == 400

class TestMainSearch:
    """Wave 1 – Search Guard Branches"""

    def test_search_unauthorized(self, client):
        resp = client.get("/api/search", query_string={"q": "test"})
        assert resp.status_code == 401

    def test_search_empty_or_short_query(self, auth_client_student):
        client, student = auth_client_student
        # Empty
        resp = client.get("/api/search", query_string={"q": ""})
        assert resp.status_code == 200
        assert resp.json["users"] == []
        
        # Short
        resp = client.get("/api/search", query_string={"q": "a"})
        assert resp.status_code == 200
        assert resp.json["users"] == []

    def test_search_success(self, auth_client_student, second_student):
        client, student = auth_client_student
        resp = client.get("/api/search", query_string={"q": second_student.first_name})
        assert resp.status_code == 200
        assert any(u["id"] == second_student.id for u in resp.json["users"])

    def test_search_special_chars_and_injection(self, auth_client_student):
        client, student = auth_client_student
        # Special chars
        resp = client.get("/api/search", query_string={"q": "!!!@@@#$%"})
        assert resp.status_code == 200
        
        # SQL Injection attempt (should be safe due to SQLAlchemy)
        resp = client.get("/api/search", query_string={"q": "' OR 1=1 --"})
        assert resp.status_code == 200

class TestMainProfileAccess:
    """Wave 1 – Profile Access & Data Branches"""

    def test_get_profile_data_own(self, auth_client_student):
        client, student = auth_client_student
        resp = client.get(f"/api/profile/{student.id}")
        assert resp.status_code == 200
        assert resp.json["is_own_profile"] is True

    def test_get_profile_data_not_found(self, auth_client_student):
        client, student = auth_client_student
        resp = client.get("/api/profile/99999")
        assert resp.status_code == 404

    def test_profile_completion_logic(self, auth_client_student):
        client, student = auth_client_student
        resp = client.get("/api/profile/completion")
        assert resp.status_code == 200
        assert "percentage" in resp.json
        assert isinstance(resp.json["missing_fields"], list)

    def test_get_my_profile_success(self, auth_client_student):
        client, student = auth_client_student
        resp = client.get("/api/profile/me")
        assert resp.status_code == 200
        assert resp.json["email"] == student.email

class TestMainAnnouncements:
    """Wave 1 – Announcement Branches"""

    def test_get_announcements_unauthorized(self, client):
        resp = client.get("/api/announcements")
        assert resp.status_code == 401

    def test_get_announcements_success(self, auth_client_student, app):
        client, student = auth_client_student
        with app.app_context():
            admin = User.query.filter_by(account_type='admin').first()
            if not admin:
                admin = User(
                    first_name="Admin", last_name="User", email="admin_test@example.com",
                    enrollment_no="ADM999", university="Test U", major="CS", batch="2026",
                    account_type="admin", status="ACTIVE", is_password_set=True
                )
                admin.set_password("pass")
                db.session.add(admin)
                db.session.commit()
                # Reload from DB
                admin = User.query.filter_by(email="admin_test@example.com").first()

            if not Announcement.query.filter_by(status='active').first():
                ann = Announcement(title="T", content="C", status='active', author_id=admin.id)
                db.session.add(ann)
                db.session.commit()
                
        resp = client.get("/api/announcements")
        assert resp.status_code == 200
        assert len(resp.json) > 0

class TestMainWave2CRUD:
    """Wave 2 – Profile Detail Management (Skills, Experience, Education)"""

    def test_manage_skills_full_cycle(self, auth_client_student):
        client, student = auth_client_student
        
        # Create
        resp = client.post("/api/profile/skills", json={"name": "Python", "level": "Expert"})
        assert resp.status_code == 201
        skill_id = resp.json["id"]
        
        # Create Duplicate (should 400)
        resp = client.post("/api/profile/skills", json={"name": "Python", "level": "Beginner"})
        assert resp.status_code == 400
        
        # Update
        resp = client.put("/api/profile/skills", json={"id": skill_id, "name": "Pythonic", "level": "Advanced"})
        assert resp.status_code == 200
        assert resp.json["name"] == "Pythonic"
        
        # Get
        resp = client.get("/api/profile/skills")
        assert resp.status_code == 200
        assert any(s["id"] == skill_id for s in resp.json)
        
        # Delete
        resp = client.delete(f"/api/profile/skills?id={skill_id}")
        assert resp.status_code == 200
        
        # Delete non-existent
        resp = client.delete("/api/profile/skills?id=99999")
        assert resp.status_code == 404

    def test_manage_experiences_full_cycle(self, auth_client_student):
        client, student = auth_client_student
        
        data = {
            "title": "Engineer",
            "company": "Google",
            "location": "Remote",
            "start_date": "2023-01-01",
            "description": "Coding",
            "is_current": True
        }
        
        # Create
        resp = client.post("/api/profile/experiences", json=data)
        assert resp.status_code == 201
        exp_id = resp.json["id"]
        
        # Update
        data["id"] = exp_id
        data["title"] = "Senior Engineer"
        resp = client.put("/api/profile/experiences", json=data)
        assert resp.status_code == 200
        
        # Delete
        resp = client.delete(f"/api/profile/experiences?id={exp_id}")
        assert resp.status_code == 200

    def test_manage_educations_full_cycle(self, auth_client_student):
        client, student = auth_client_student
        
        data = {
            "degree": "B.Tech",
            "field": "CS",
            "institution": "MIT",
            "year": "2026"
        }
        
        # Create
        resp = client.post("/api/profile/educations", json=data)
        assert resp.status_code == 201
        edu_id = resp.json["id"]
        
        # Delete
        resp = client.delete(f"/api/profile/educations?id={edu_id}")
        assert resp.status_code == 200

class TestMainWave2ProfileUpdates:
    """Wave 2 – Bio and Photo Updates"""

    def test_update_bio_success(self, auth_client_student, app):
        client, student = auth_client_student
        resp = client.put("/api/profile/bio", json={"bio": "New Bio"})
        assert resp.status_code == 200
        
        with app.app_context():
            updated = db.session.get(User, student.id)
            assert updated.bio == "New Bio"

    def test_upload_photo_validation(self, auth_client_student):
        client, student = auth_client_student
        
        # No file
        resp = client.post("/api/profile/photo")
        assert resp.status_code == 400
        
        # Invalid ext
        from io import BytesIO
        data = {'file': (BytesIO(b"fake image content"), "test.txt")}
        resp = client.post("/api/profile/photo", data=data, content_type='multipart/form-data')
        assert resp.status_code == 400
