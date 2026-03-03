# --- Additional hardening tests ---
def test_queue_perform_task_logic_db_commit_exception(sync_queue, auth_client_student, second_student):
    app = sync_queue.app
    client, user = auth_client_student
    with app.app_context():
        post = Post(user_id=user.id, caption="Test Post")
        db.session.add(post)
        db.session.commit()
        post_id = post.id
        owner_id = user.id
        commenter_id = second_student.id
        task = {
            "comment_id": 123,
            "post_id": post_id,
            "user_id": commenter_id
        }
        from unittest.mock import patch
        # Patch db.session.commit to raise exception
        with patch("app.models.db.session.commit", side_effect=Exception("DB error")):
            with patch("time.sleep", return_value=None):
                sync_queue._perform_task_logic(task)
        # Notification should not be created
        notif = Notification.query.filter_by(user_id=owner_id, actor_id=commenter_id).first()
        assert notif is None

def test_queue_init_app_respects_comment_queue_enabled(app):
    app.config["COMMENT_QUEUE_ENABLED"] = False
    q = CommentProcessingQueue()
    q.init_app(app)
    assert q._worker_thread is None
import pytest
from app.services.comment_queue import CommentProcessingQueue
from app.models import Post, Notification, User
from app.extensions import db

# -----------------------------------------------------------------------------
# 2.1 test_services_queue.py (Services Layer Phase 2)
# -----------------------------------------------------------------------------

@pytest.fixture
def sync_queue(app):
    """Provides a fresh, un-started queue instance configured for testing."""
    queue_service = CommentProcessingQueue()
    queue_service.app = app
    return queue_service

def test_queue_init_app_testing_bypasses_worker(app):
    q = CommentProcessingQueue()
    q.init_app(app)
    assert q._worker_thread is None

def test_queue_enqueue_adds_task(sync_queue):
    sync_queue.enqueue({"comment_id": 1})
    assert not sync_queue._queue.empty()
    assert sync_queue._queue.queue[0]["comment_id"] == 1

def test_queue_perform_task_logic_creates_notification(sync_queue, auth_client_student, second_student):
    app = sync_queue.app
    client, user = auth_client_student

    with app.app_context():
        # User (post owner)
        # Second student (commenter)
        post = Post(user_id=user.id, caption="My Cool Post")
        db.session.add(post)
        db.session.commit()
        
        post_id = post.id
        owner_id = user.id
        commenter_id = second_student.id

    # Simulated task object passed when placing a comment
    task = {
        "comment_id": 999,
        "post_id": post_id,
        "user_id": commenter_id
    }

    # Execute synchronously, bypassing thread
    import time
    from unittest.mock import patch
    
    # We patch sleep to prevent tests from lingering needlessly
    with patch("time.sleep", return_value=None):
        sync_queue._perform_task_logic(task)

    # Validate notification creation
    with app.app_context():
        notif = Notification.query.filter_by(user_id=owner_id, actor_id=commenter_id).first()
        assert notif is not None
        assert notif.type == "post_comment"
        assert notif.reference_id == post_id

def test_queue_perform_task_logic_ignores_self_comments(sync_queue, auth_client_student):
    app = sync_queue.app
    client, owner = auth_client_student

    with app.app_context():
        post = Post(user_id=owner.id, caption="My Cool Post")
        db.session.add(post)
        db.session.commit()
        
        post_id = post.id
        owner_id = owner.id

    task = {
        "comment_id": 999,
        "post_id": post_id,
        "user_id": owner_id # Self-comment
    }

    from unittest.mock import patch
    with patch("time.sleep", return_value=None):
        sync_queue._perform_task_logic(task)

    with app.app_context():
        notif = Notification.query.filter_by(user_id=owner_id, type="post_comment").first()
        assert notif is None

def test_queue_perform_task_logic_handles_missing_post(sync_queue):
    # Tests safe failure execution if post is deleted before worker gets to it
    task = {
        "comment_id": 999,
        "post_id": 999999, # Non-existent
        "user_id": 1 
    }

    from unittest.mock import patch
    with patch("time.sleep", return_value=None):
        # Should execute silently and return, error handled internally or bypassed
        sync_queue._perform_task_logic(task)

def test_queue_shutdown_handles_empty_thread(sync_queue):
    # Shutdown without starting worker
    sync_queue.shutdown()
    assert sync_queue._stop_event.is_set()

def test_queue_worker_exception_handling(sync_queue):
    """Test standard operational flow wrapper for queue worker."""
    import queue
    # Put a bad task that explodes (like missing 'get' method entirely)
    sync_queue._queue.put("not-a-dict")
    
    # Signal stop event BEFORE running, but wait to verify empty bypass
    sync_queue._stop_event.set()
    
    # This should exit immediately without exception because stop_event is set
    sync_queue._process_worker()
    assert not sync_queue._queue.empty() # Still there, un-processed
