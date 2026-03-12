import queue
import threading
import time
import logging
from flask import Flask

# Configure logging to see the queue in action
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CommentQueue")


class CommentProcessingQueue:
    """
    A thread-safe FIFO queue for processing comments asynchronously.
    Implements the Producer-Consumer pattern.
    """

    def __init__(self):
        # Thread-safe FIFO queue
        self._queue = queue.Queue()
        self._stop_event = threading.Event()
        self.app = None
        self._worker_thread = None

    def init_app(self, app: Flask):
        """Initialize with Flask app context"""
        self.app = app

        if app.config.get("TESTING"):
            logger.info("Comment worker NOT started (TESTING mode).")
            return

        if not app.config.get("COMMENT_QUEUE_ENABLED", True):
            logger.info("Comment worker NOT started (Disabled via config).")
            return

        self._start_worker()

    def _start_worker(self):
        """Start the background consumer thread"""
        if not self._worker_thread or not self._worker_thread.is_alive():
            self._stop_event.clear()
            self._worker_thread = threading.Thread(target=self._process_worker, daemon=True)
            self._worker_thread.start()
            logger.info("Comment processing worker thread started.")

    def shutdown(self):
        """Signal the worker to stop and wait for it."""
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            # Join the thread with a short timeout to prevent hanging the test suite or main process indefinitely.
            self._worker_thread.join(timeout=2.0)
            if not self._worker_thread.is_alive():
                logger.info("Comment processing worker thread shut down gracefully.")
            else:
                logger.warning("Comment processing worker thread did not shut down in time.")

    def enqueue(self, task_data):
        """
        Producer: Adds a comment task to the queue.
        Time Complexity: O(1)
        """
        self._queue.put(task_data)
        logger.info(f"Task enqueued for comment {task_data.get('comment_id')}")

    def _process_worker(self):
        """
        Consumer: continuously processes tasks from the queue.
        """
        while not self._stop_event.is_set():
            try:
                # Wait for a task (blocking with timeout to allow checking stop_event)
                task = self._queue.get(timeout=1)

                # Process the task
                self._perform_task_logic(task)

                # Mark as done
                self._queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in comment worker: {e}")

    def _perform_task_logic(self, task):
        """
        Simulates heavy processing (Spam check) and DB updates (Notifications).
        """
        if not self.app:
            return

        # SIMULATION: Artificial delay to represent heavy computation (e.g., AI API call)
        time.sleep(2)

        with self.app.app_context():
            # Import models inside context to avoid circular imports
            from app.models import db, Post, Notification, User

            comment_id = task.get('comment_id')
            user_id = task.get('user_id')
            post_id = task.get('post_id')

            # Logic: Create Notification for the post owner
            try:
                post = db.session.get(Post, post_id)
                if post and post.user_id != user_id:
                    commenter = db.session.get(User, user_id)
                    notif = Notification(
                        user_id=post.user_id,
                        type='post_comment',
                        message=f"{commenter.full_name} commented on your post",
                        reference_id=post.id,
                        actor_id=user_id
                    )
                    db.session.add(notif)
                    db.session.commit()
                    logger.info(f"Processed Comment {comment_id}: Notification sent to User {post.user_id}")
            except Exception as e:
                logger.error(f"Database error in worker: {e}")
                db.session.rollback()


# Singleton instance
comment_queue_service = CommentProcessingQueue()
