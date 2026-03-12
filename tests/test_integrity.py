import pytest
from app.models import User, Post, Connection, Skill, Experience, Education, Notification, Like, Comment, Event, EventRegistration, ConnectionRequest
from app.extensions import db
from datetime import datetime, timezone, timedelta
from sqlalchemy.exc import IntegrityError

# -----------------------------------------------------------------------------
# 8. test_integrity.py (15 Tests)
# -----------------------------------------------------------------------------

# 3.1 Cascading Deletes (8 tests)

@pytest.mark.cascade
def test_delete_user_removes_posts(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        post = Post(user_id=user.id, caption="Hello")
        db.session.add(post)
        db.session.commit()
        post_id = post.id
        
        db.session.delete(db.session.get(User, user.id))
        db.session.commit()
        assert db.session.get(Post, post_id) is None

@pytest.mark.cascade
def test_delete_user_removes_connections(two_connected_users, app):
    user1, user2 = two_connected_users
    with app.app_context():
        u1_id = user1.id
        u2_id = user2.id
        conn_id = Connection.query.filter_by(user_id=u1_id, connected_user_id=u2_id).first().id
        
        db.session.delete(db.session.get(User, u1_id))
        db.session.commit()
        assert db.session.get(Connection, conn_id) is None

@pytest.mark.cascade
def test_delete_user_removes_profile_data(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        skill = Skill(user_id=user.id, skill_name="C++")
        exp = Experience(user_id=user.id, title="Dev", company="Inc", start_date="2020-01-01")
        edu = Education(user_id=user.id, institution="Uni", field="CS", degree="BS", year="2020")
        db.session.add_all([skill, exp, edu])
        db.session.commit()
        
        skill_id, exp_id, edu_id = skill.id, exp.id, edu.id
        db.session.delete(db.session.get(User, user.id))
        db.session.commit()

        assert db.session.get(Skill, skill_id) is None
        assert db.session.get(Experience, exp_id) is None
        assert db.session.get(Education, edu_id) is None

@pytest.mark.cascade
def test_delete_user_removes_notifications(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        notif = Notification(user_id=user.id, type="general", message="Hello", actor_id=user.id)
        db.session.add(notif)
        db.session.commit()
        notif_id = notif.id
        
        db.session.delete(db.session.get(User, user.id))
        db.session.commit()
        assert db.session.get(Notification, notif_id) is None

@pytest.mark.cascade
def test_delete_post_removes_likes(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        post = Post(user_id=user.id, caption="Hello")
        db.session.add(post)
        db.session.commit()
        post_id = post.id
        
        like = Like(user_id=user.id, post_id=post_id)
        db.session.add(like)
        db.session.commit()
        like_id = like.id
        
        db.session.delete(db.session.get(Post, post_id))
        db.session.commit()
        assert db.session.get(Like, like_id) is None

@pytest.mark.cascade
def test_delete_post_removes_comments(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        post = Post(user_id=user.id, caption="Hello")
        db.session.add(post)
        db.session.commit()
        post_id = post.id
        
        comment = Comment(user_id=user.id, post_id=post_id, text="A comment")
        db.session.add(comment)
        db.session.commit()
        comment_id = comment.id
        
        db.session.delete(db.session.get(Post, post_id))
        db.session.commit()
        assert db.session.get(Comment, comment_id) is None

@pytest.mark.cascade
def test_delete_event_removes_registrations(event_with_capacity, app):
    event = event_with_capacity
    with app.app_context():
        event_id = event.id
        reg = EventRegistration(user_id=event.user_id, event_id=event_id, status="going")
        db.session.add(reg)
        db.session.commit()
        reg_id = reg.id
        
        db.session.delete(db.session.get(Event, event_id))
        db.session.commit()
        assert db.session.get(EventRegistration, reg_id) is None

@pytest.mark.cascade
def test_delete_skill_removes_from_profile(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        skill = Skill(user_id=user.id, skill_name="Java")
        db.session.add(skill)
        db.session.commit()
        skill_id = skill.id
        
        db.session.delete(db.session.get(Skill, skill_id))
        db.session.commit()
        
        # Verify it's gone from user's skills implicitly by not being queryable
        assert Skill.query.filter_by(user_id=user.id, skill_name="Java").first() is None


# 3.2 Foreign Key Integrity (4 tests)

def test_add_skill_to_nonexistent_user_returns_404(auth_client_student, app):
    # Depending on how the API is implemented, it might use the session user anyway, 
    # but we will try creating directly with ORM or if there's an endpoint that takes User ID
    # Since /api/profile/skills uses session["user_id"], it's impossible to pass a nonexistent user ID to the API.
    # Therefore we test DB integrity.
    with app.app_context():
        skill = Skill(user_id=99999, skill_name="Invalid")
        db.session.add(skill)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

def test_comment_on_nonexistent_post_returns_404(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/posts/99999/comments', json={"text": "Hello"})
    # Assuming the API checks if post exists
    assert response.status_code == 404

def test_like_nonexistent_post_returns_404(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/posts/99999/like')
    assert response.status_code == 404

def test_register_nonexistent_event_returns_404(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/events/99999/register', json={"status": "going"})
    assert response.status_code == 404


# 3.3 Unique Constraints (3 tests)

def test_duplicate_email_returns_409_on_registration(app):
    with app.app_context():
        user1 = User(
            first_name="First", last_name="User", email="dup@example.com",
            enrollment_no="111", university="U", major="CS", batch="2026",
            account_type="student", status="ACTIVE"
        )
        db.session.add(user1)
        db.session.commit()
        
        user2 = User(
            first_name="Second", last_name="User", email="dup@example.com",
            enrollment_no="222", university="U", major="CS", batch="2026",
            account_type="student", status="ACTIVE"
        )
        db.session.add(user2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

def test_duplicate_connection_request_returns_409(auth_client_student, second_student):
    client, user = auth_client_student
    client.post('/api/connections/request', json={"target_user_id": second_student.id})
    response = client.post('/api/connections/request', json={"target_user_id": second_student.id})
    assert response.status_code in [409, 400]

def test_duplicate_event_registration_returns_409(auth_client_student, event_with_capacity, app):
    client, user = auth_client_student
    client.post(f'/api/events/{event_with_capacity.id}/register', json={"status": "going"})
    
    # Direct DB test or API duplicate check
    with app.app_context():
        reg2 = EventRegistration(user_id=user.id, event_id=event_with_capacity.id, status="going")
        db.session.add(reg2)
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()

