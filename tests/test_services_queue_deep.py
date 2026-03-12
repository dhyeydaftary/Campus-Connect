import pytest
import queue
from unittest.mock import MagicMock, patch
from app.services.comment_queue import CommentProcessingQueue
from app.models import db, Post, Notification, User, Comment
from flask import Flask

class TestCommentQueueDeep:
    @pytest.fixture
    def queue_service(self, app):
        service = CommentProcessingQueue()
        service.init_app(app)
        return service

    def test_enqueue_task(self, queue_service):
        """Test that enqueue adds to the internal queue object."""
        task = {"comment_id": 1, "user_id": 1, "post_id": 1}
        queue_service.enqueue(task)
        assert queue_service._queue.qsize() == 1
        assert queue_service._queue.get() == task

    def test_perform_task_logic_success(self, queue_service, auth_client_student, app):
        """Test successful notification creation via _perform_task_logic."""
        client, user = auth_client_student
        with app.app_context():
            # Create a post by another user
            other_user = User(
                first_name="Other", last_name="User", email="other@example.com",
                enrollment_no="O002", university="U", major="CS", batch="2026",
                account_type="student", status="ACTIVE", is_password_set=True
            )
            db.session.add(other_user)
            db.session.flush()
            
            post = Post(user_id=other_user.id, caption="Test Post", post_type="text")
            db.session.add(post)
            db.session.commit()
            
            task = {
                "comment_id": 1,
                "user_id": user.id,
                "post_id": post.id
            }
            
            # Manually trigger task logic (simulate worker thread)
            # Mock time.sleep to avoid 2s delay
            with patch('time.sleep', return_value=None):
                queue_service._perform_task_logic(task)
            
            # Verify notification created
            notif = Notification.query.filter_by(user_id=other_user.id, type='post_comment').first()
            assert notif is not None
            assert notif.actor_id == user.id
            assert notif.reference_id == post.id

    def test_perform_task_logic_self_comment_no_notif(self, queue_service, auth_client_student, app):
        """Ensure no notification is created when a user comments on their own post."""
        client, user = auth_client_student
        with app.app_context():
            post = Post(user_id=user.id, caption="My Post", post_type="text")
            db.session.add(post)
            db.session.commit()
            
            task = {
                "comment_id": 1,
                "user_id": user.id,
                "post_id": post.id
            }
            
            with patch('time.sleep', return_value=None):
                queue_service._perform_task_logic(task)
            
            # Verify no notification created for self-comment
            notif = Notification.query.filter_by(user_id=user.id, type='post_comment').first()
            assert notif is None

    def test_perform_task_logic_missing_post(self, queue_service, auth_client_student, app):
        """Ensure no notification is created if the post is missing."""
        client, user = auth_client_student
        task = {
            "comment_id": 1,
            "user_id": user.id,
            "post_id": 99999 # Non-existent post
        }
        
        with patch('time.sleep', return_value=None):
            queue_service._perform_task_logic(task)
        
        # Verify no notification created
        notif = Notification.query.filter_by(type='post_comment').first()
        assert notif is None

    def test_perform_task_logic_rollback_on_error(self, queue_service, auth_client_student, app):
        """Verify session.rollback is called on DB error."""
        client, user = auth_client_student
        with app.app_context():
            # Post owner must be different from commenter (user)
            owner = User(first_name="Owner", last_name="User", email="owner@err.com", enrollment_no="E1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add(owner)
            db.session.flush()
            post = Post(user_id=owner.id, caption="Post", post_type="text")
            db.session.add(post)
            db.session.commit()
            
            task = {"comment_id": 1, "user_id": user.id, "post_id": post.id}
            
            # Patch db.session.commit to fail
            with patch('app.models.db.session.commit', side_effect=Exception("DB Error")):
                with patch('app.models.db.session.rollback') as mock_rollback:
                    with patch('time.sleep', return_value=None):
                        queue_service._perform_task_logic(task)
                        mock_rollback.assert_called_once()

    def test_multiple_task_ordering_manual(self, queue_service, auth_client_student, app):
        """Verify multiple tasks are processed correctly in sequence."""
        client, user = auth_client_student
        with app.app_context():
            # Post owner
            other = User(first_name="O", last_name="U", email="o@e.com", enrollment_no="O1", university="U", major="CS", batch="26", account_type="student", status="ACTIVE", is_password_set=True)
            db.session.add(other)
            db.session.flush()
            post = Post(user_id=other.id, caption="P", post_type="text")
            db.session.add(post)
            db.session.commit()
            
            tasks = [
                {"comment_id": 1, "user_id": user.id, "post_id": post.id},
                {"comment_id": 2, "user_id": user.id, "post_id": post.id},
                {"comment_id": 3, "user_id": user.id, "post_id": post.id}
            ]
            
            with patch('time.sleep', return_value=None):
                for t in tasks:
                    queue_service._perform_task_logic(t)
            
            notifs = Notification.query.filter_by(user_id=other.id).order_by(Notification.created_at.asc()).all()
            assert len(notifs) == 3

    def test_init_app_disabled_config(self, app):
        """Verify worker doesn't start if COMMENT_QUEUE_ENABLED is False."""
        app.config["COMMENT_QUEUE_ENABLED"] = False
        # Mock TESTING to False so it would normally start
        app.config["TESTING"] = False 
        
        service = CommentProcessingQueue()
        with patch.object(service, '_start_worker') as mock_start:
            service.init_app(app)
            mock_start.assert_not_called()

    def test_shutdown_graceful(self, app):
        """Ensure shutdown sets stop event and joins thread."""
        service = CommentProcessingQueue()
        service.init_app(app)
        # Manually start a dummy worker thread to test shutdown
        service._worker_thread = MagicMock()
        service._worker_thread.is_alive.return_value = True
        
        service.shutdown()
        assert service._stop_event.is_set()
        service._worker_thread.join.assert_called_once()

    def test_perform_task_logic_no_app(self):
        """Verify _perform_task_logic returns early if app is not set."""
        service = CommentProcessingQueue()
        # No init_app
        assert service._perform_task_logic({"some": "task"}) is None

    def test_process_worker_covers_loop(self):
        """Manually trigger _process_worker once to cover loop logic."""
        service = CommentProcessingQueue()
        service._queue = MagicMock()
        
        # We want to run the loop at least once.
        # side_effect: first call returns task, second call sets stop event and returns task or raises Empty
        def get_side_effect(timeout=None):
            service._stop_event.set() # Set stop event after first check
            return {"comment_id": 1}
            
        service._queue.get.side_effect = get_side_effect
        
        with patch.object(service, '_perform_task_logic') as mock_logic:
            service._process_worker()
            mock_logic.assert_called_once()
            service._queue.task_done.assert_called_once()

    def test_process_worker_exception(self):
        """Verify worker loop handles exceptions."""
        service = CommentProcessingQueue()
        service._queue = MagicMock()
        
        # side_effect: first call raises error, then sets stop event
        def error_then_stop(timeout=None):
            if not service._stop_event.is_set():
                service._stop_event.set()
                raise Exception("Test Error")
            raise queue.Empty
            
        service._queue.get.side_effect = error_then_stop
        
        with patch('app.services.comment_queue.logger.error') as mock_log_error:
            service._process_worker()
            mock_log_error.assert_called_with("Error in comment worker: Test Error")

    def test_start_worker_new_thread(self):
        """Ensure _start_worker starts a new thread."""
        service = CommentProcessingQueue()
        with patch('threading.Thread') as mock_thread_class:
            mock_thread = MagicMock()
            mock_thread_class.return_value = mock_thread
            
            service._start_worker()
            
            mock_thread_class.assert_called_once()
            mock_thread.start.assert_called_once()
            assert service._stop_event.is_set() == False

    def test_init_app_starts_worker(self, app):
        """Verify init_app starts worker if config allows."""
        app.config["COMMENT_QUEUE_ENABLED"] = True
        app.config["TESTING"] = False
        
        service = CommentProcessingQueue()
        with patch.object(service, '_start_worker') as mock_start:
            service.init_app(app)
            mock_start.assert_called_once()

    def test_shutdown_logger_coverage(self, app):
        """Cover the logger warning in shutdown if join fails."""
        service = CommentProcessingQueue()
        service._worker_thread = MagicMock()
        service._worker_thread.is_alive.side_effect = [True, True] # Remains alive after join
        
        with patch('app.services.comment_queue.logger.warning') as mock_warn:
            service.shutdown()
            mock_warn.assert_called_with("Comment processing worker thread did not shut down in time.")
