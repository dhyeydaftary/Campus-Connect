import pytest
from sqlalchemy.exc import IntegrityError
from app.models import User
from app.extensions import db

def test_user_model_creates_correctly(app):
    """Test that a User model can be created with required fields."""
    with app.app_context():
        user = User(
            first_name="Test",
            last_name="User",
            email="test@example.com",
            enrollment_no="123456",
            university="Test University",
            major="Computer Science",
            batch="2026",
            account_type="student"
        )
        db.session.add(user)
        db.session.commit()
        
        saved_user = User.query.filter_by(email="test@example.com").first()
        assert saved_user is not None
        assert saved_user.first_name == "Test"
        assert saved_user.last_name == "User"
        assert saved_user.enrollment_no == "123456"

def test_password_is_hashed(app):
    """Test that setting a password hashes it and it is not stored as plain text."""
    with app.app_context():
        user = User(
            first_name="Hash",
            last_name="Test",
            email="hash@example.com",
            enrollment_no="999999",
            university="Test University",
            major="CS",
            batch="2026"
        )
        
        plain_password = "MySuperSecretPassword123"
        user.set_password(plain_password)
        
        # Verify the hash is set and does not equal the plain password
        assert user.password_hash is not None
        assert user.password_hash != plain_password
        
        # Verify the password checking method works
        assert user.check_password(plain_password) is True
        assert user.check_password("WrongPassword") is False

def test_unique_email_constraint(app):
    """Test that two users cannot have the same email address."""
    with app.app_context():
        user1 = User(
            first_name="First",
            last_name="User",
            email="duplicate@example.com",
            enrollment_no="111111",
            university="Test U",
            major="CS",
            batch="2026"
        )
        db.session.add(user1)
        db.session.commit()
        
        user2 = User(
            first_name="Second",
            last_name="User",
            email="duplicate@example.com",  # Same email
            enrollment_no="222222",         # Different enrollment
            university="Test U",
            major="CS",
            batch="2026"
        )
        db.session.add(user2)
        
        # Committing the duplicate email should raise an IntegrityError
        with pytest.raises(IntegrityError):
            db.session.commit()
        
        db.session.rollback()
