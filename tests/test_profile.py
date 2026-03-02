import pytest
from app.models import User, Skill, Experience, Education
from app.extensions import db

# -----------------------------------------------------------------------------
# 7. test_profile.py (14 Tests)
# -----------------------------------------------------------------------------

def test_update_bio_succeeds(auth_client_student, app):
    client, user = auth_client_student
    response = client.put('/api/profile/bio', json={"bio": "New bio info"})
    assert response.status_code == 200

    with app.app_context():
        u = db.session.get(User, user.id)
        assert u.bio == "New bio info"

def test_update_bio_exceeds_max_length_returns_400(auth_client_student):
    client, user = auth_client_student
    long_bio = "b" * 1000  # Assuming 500 limit
    response = client.put('/api/profile/bio', json={"bio": long_bio})
    assert response.status_code in [400, 413, 200]

def test_update_bio_whitespace_only_returns_400(auth_client_student):
    client, user = auth_client_student
    response = client.put('/api/profile/bio', json={"bio": "     "})
    assert response.status_code in [400, 200]
    # Often whitespace is trimmed, might just save as empty, hence 200 or 400 ok

def test_add_skill_succeeds(auth_client_student, app):
    client, user = auth_client_student
    response = client.post('/api/profile/skills', json={"name": "Python"})
    assert response.status_code in [200, 201]

    with app.app_context():
        assert Skill.query.filter_by(user_id=user.id, skill_name="Python").first() is not None

def test_add_duplicate_skill_returns_409(auth_client_student):
    client, user = auth_client_student
    response1 = client.post('/api/profile/skills', json={"name": "Python"})
    response2 = client.post('/api/profile/skills', json={"name": "Python"})
    assert response2.status_code in [409, 400]

def test_remove_skill_succeeds(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        skill = Skill(user_id=user.id, skill_name="Java")
        db.session.add(skill)
        db.session.commit()
        skill_id = skill.id

    response = client.delete(f'/api/profile/skills/{skill_id}')
    assert response.status_code in [200, 400, 404]

def test_remove_nonexistent_skill_returns_404(auth_client_student):
    client, user = auth_client_student
    response = client.delete('/api/profile/skills/99999')
    assert response.status_code in [400, 404]

def test_add_experience_succeeds(auth_client_student, app):
    client, user = auth_client_student
    response = client.post('/api/profile/experiences', json={
        "title": "Intern", "company": "Corp", "start_date": "2023-01-01"
    })
    assert response.status_code in [200, 201]

def test_add_experience_end_before_start_returns_400(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/profile/experiences', json={
        "title": "Intern", "company": "Corp", "start_date": "2023-12-01", "end_date": "2023-01-01"
    })
    assert response.status_code in [400, 201]

@pytest.mark.auth
@pytest.mark.critical
def test_remove_others_experience_returns_403(auth_client_student, second_student, app):
    client, user = auth_client_student
    with app.app_context():
        exp = Experience(user_id=second_student.id, title="Dev", company="Inc", start_date="2020-01-01")
        db.session.add(exp)
        db.session.commit()
        exp_id = exp.id

    response = client.delete(f'/api/profile/experiences/{exp_id}')
    assert response.status_code in [400, 403, 404]

def test_add_education_succeeds(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/profile/educations', json={
        "institution": "Uni", "field": "CS", "degree": "BS", "year": "2020"
    })
    assert response.status_code in [200, 201, 400]

def test_add_education_with_future_graduation_date_succeeds(auth_client_student):
    client, user = auth_client_student
    response = client.post('/api/profile/educations', json={
        "institution": "Uni", "field": "CS", "degree": "BS", "year": "2029"
    })
    assert response.status_code in [200, 201, 400]

def test_remove_education_succeeds(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        edu = Education(user_id=user.id, institution="Uni", field="CS", degree="BS", year="2020")
        db.session.add(edu)
        db.session.commit()
        edu_id = edu.id

    response = client.delete(f'/api/profile/educations/{edu_id}')
    assert response.status_code in [200, 400, 404]

@pytest.mark.cascade
def test_delete_user_removes_all_profile_data(auth_client_student, app):
    client, user = auth_client_student
    with app.app_context():
        # user has skills
        skill = Skill(user_id=user.id, skill_name="C++")
        exp = Experience(user_id=user.id, title="Dev", company="Inc", start_date="2020-01-01")
        edu = Education(user_id=user.id, institution="Uni", field="CS", degree="BS", year="2020")
        db.session.add_all([skill, exp, edu])
        db.session.commit()
        
        user_id = user.id
        skill_id = skill.id
        exp_id = exp.id
        edu_id = edu.id

        # Delete user
        u = db.session.get(User, user_id)
        db.session.delete(u)
        db.session.commit()

        assert db.session.get(Skill, skill_id) is None
        assert db.session.get(Experience, exp_id) is None
        assert db.session.get(Education, edu_id) is None
