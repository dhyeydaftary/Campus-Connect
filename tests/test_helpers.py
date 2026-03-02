import pytest
from datetime import datetime, timezone, timedelta
from app.utils.helpers import get_clean_filename, _get_user_avatar, save_uploaded_file, _format_post_for_api, get_content_activity, _format_admin_event
from app.models import User, Post, Event
from app.extensions import db
import os

# -----------------------------------------------------------------------------
# 1.2 test_helpers.py (Utility & Decorators Phase 1)
# -----------------------------------------------------------------------------

def test_get_clean_filename_with_typical_pattern():
    path = "123_20260303_120000_photo.jpg"
    assert get_clean_filename(path) == "photo.jpg"

def test_get_clean_filename_handles_none_and_empty():
    assert get_clean_filename(None) is None
    assert get_clean_filename("") is None

def test_get_clean_filename_fallback_no_pattern():
    # When pattern fails, returns base name
    path = "/static/images/unknown.jpg"
    assert get_clean_filename(path) == "unknown.jpg"

def test_get_user_avatar_with_none_user():
    assert _get_user_avatar(None) is None

def test_get_user_avatar_with_custom_pic():
    class DummyUser:
        profile_picture = "custom.jpg"
        full_name = "test"
    assert _get_user_avatar(DummyUser()) == "custom.jpg"

def test_get_user_avatar_fallback_default():
    class DummyUser:
        profile_picture = None
        full_name = "Jane Doe"
    assert _get_user_avatar(DummyUser()) == "https://ui-avatars.com/api/?name=Jane Doe"

def test_save_uploaded_file_handles_invalid_file():
    # Empty file obj simulation
    assert save_uploaded_file(None, "image") is None

    class InvalidFile:
        filename = ""
    # Empty filename simulation
    assert save_uploaded_file(InvalidFile(), "image") is None


def test_format_post_for_api_single_post_fallback_query(app):
    with app.app_context():
        user = User(
            first_name="Jane", last_name="Doe", email="jane@test.com", password_hash="hash",
            enrollment_no="123", account_type="student", status="ACTIVE", major="CS", batch="2026",
            university="U"
        )
        db.session.add(user)
        db.session.commit()

        post = Post(user_id=user.id, caption="Hello")
        db.session.add(post)
        db.session.commit()

        # The helper needs a tuple format: (Post, User, likes_count, comments_count)
        post_tuple = (post, user, 5, 2)
        
        # Test 1: pre-fetched `liked_post_ids` fast-path evaluation
        result_liked = _format_post_for_api(post_tuple, user.id, liked_post_ids={post.id})
        assert result_liked["isLiked"] is True

        # Test 2: fallback explicit query evaluation
        result_unliked = _format_post_for_api(post_tuple, user.id, liked_post_ids=None)
        assert result_unliked["isLiked"] is False
        assert result_unliked["likesCount"] == 5
        assert result_unliked["commentsCount"] == 2
        assert result_unliked["username"] == "Jane Doe"
        assert result_unliked["postImages"] == []


from unittest.mock import patch

def test_get_content_activity_groups_by_day(app):
    with app.app_context():
        user = User(
            first_name="Jane", last_name="Doe", email="jane3@test.com", password_hash="hash",
            enrollment_no="12345", account_type="student", status="ACTIVE", major="CS", batch="2026",
            university="U"
        )
        db.session.add(user)
        db.session.commit()
        
        today = datetime.now(timezone.utc)
        yesterday = today - timedelta(days=1)
        
        # Add 1 active post yesterday, 2 active events today
        p1 = Post(user_id=user.id, caption="Yesterday's post", created_at=yesterday)
        db.session.add(p1)

        e1 = Event(user_id=user.id, title="Today's event 1", description="desc", location="Room", total_seats=10, event_date=today)
        e2 = Event(user_id=user.id, title="Today's event 2", description="desc", location="Room", total_seats=10, event_date=today)
        db.session.add_all([e1, e2])

        db.session.commit()

        # Mock the entire `db.session.query()` chain for posts and events
        with patch('app.utils.helpers.db.session.query') as mock_query:
            # We mock the return of .all() deeply nested on the sqlalchemy filter chain
            import unittest.mock
            mock_filter_chain = unittest.mock.MagicMock()
            mock_filter_chain.join.return_value.filter.return_value.filter.return_value.group_by.return_value.all.side_effect = [
                # First .all() call is for posts
                [(today.date() - timedelta(days=1), 1)],
                # Second .all() call is for events
                [(today.date(), 2)]
            ]
            mock_query.return_value = mock_filter_chain
            stats = get_content_activity()
        
        # Verify lists exist and represent a 7-day span
        assert len(stats["labels"]) == 7
        assert len(stats["posts"]) == 7
        assert len(stats["events"]) == 7

        # Last item in the array is "Today"
        assert stats["events"][-1] >= 2 # Depending on what other tests inserted
        # Second to last item is "Yesterday"
        assert stats["posts"][-2] >= 1

def test_format_admin_event_maps_schema():
    class DummyEvent:
        id = 99
        title = "Study"
        event_date = datetime(2026, 3, 3, tzinfo=timezone.utc)
        location = "Web"
        description = "Hello"
        total_seats = 10
        interested_count = 5
        going_count = 2
    
    event = DummyEvent()
    result = _format_admin_event(event)

    assert result["id"] == 99
    assert result["title"] == "Study"
    assert "2026-03-03" in result["date"]
    assert "is_past" in result
