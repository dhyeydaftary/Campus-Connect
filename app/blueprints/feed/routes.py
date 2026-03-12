from flask import request, jsonify, session, abort, current_app, send_file
from sqlalchemy import func
import os
from app.extensions import db
from app.models import (
    User, Post, Like, Comment, Notification
)
from app.utils.decorators import login_required

from app.utils.helpers import (
    get_clean_filename, save_uploaded_file,
    _format_post_for_api
)
from app.services.comment_queue import comment_queue_service

from . import feed_bp


# ==============================================================================

@feed_bp.route("/posts")
@login_required
def api_posts():
    """Fetches a paginated feed of posts, ranked by a simple algorithm."""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 5))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid pagination parameters"}), 400

    offset = (page - 1) * limit

    likes_subq = (
        db.session.query(
            Like.post_id,
            func.count(Like.id).label("likes")
        )
        .group_by(Like.post_id)
        .subquery()
    )

    comments_subq = (
        db.session.query(
            Comment.post_id,
            func.count(Comment.id).label("comments")
        )
        .group_by(Comment.post_id)
        .subquery()
    )

    db_posts = (
        db.session.query(
            Post,
            User,
            func.coalesce(likes_subq.c.likes, 0).label("likes"),
            func.coalesce(comments_subq.c.comments, 0).label("comments")
        )
        .join(User, Post.user_id == User.id)
        .outerjoin(likes_subq, likes_subq.c.post_id == Post.id)
        .outerjoin(comments_subq, comments_subq.c.post_id == Post.id)
        .order_by(
            # Simple ranking algorithm: prioritizes likes and comments,
            # while penalizing older posts to keep the feed fresh.
            # Weights: Likes=3, Comments=5, TimeDecay=1/hour.
            (
                func.coalesce(likes_subq.c.likes, 0) * 3 +
                func.coalesce(comments_subq.c.comments, 0) * 5 -
                func.extract("epoch", func.now() - Post.created_at) / 3600
            ).desc()
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    # --- N+1 Query Fix: Pre-fetch likes for the current user ---
    post_ids = [p.Post.id for p in db_posts]
    liked_post_ids = set()
    if post_ids and session.get("user_id"):
        user_likes = db.session.query(Like.post_id).filter(
            Like.user_id == session["user_id"],
            Like.post_id.in_(post_ids)
        ).all()
        liked_post_ids = {like.post_id for like in user_likes}
    # --- End Fix ---

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        # Pass the pre-fetched set of liked post IDs to the formatter
        "posts": [_format_post_for_api(p, session["user_id"], liked_post_ids) for p in db_posts]
    })


@feed_bp.route("/posts/<int:post_id>")
@login_required
def get_single_post_api(post_id):
    """Fetches the data for a single, specific post."""
    likes_subq = (
        db.session.query(Like.post_id, func.count(Like.id).label("likes"))
        .filter(Like.post_id == post_id)
        .group_by(Like.post_id)
        .subquery()
    )

    comments_subq = (
        db.session.query(Comment.post_id, func.count(Comment.id).label("comments"))
        .filter(Comment.post_id == post_id)
        .group_by(Comment.post_id)
        .subquery()
    )

    post_data = (
        db.session.query(
            Post,
            User,
            func.coalesce(likes_subq.c.likes, 0).label("likes"),
            func.coalesce(comments_subq.c.comments, 0).label("comments")
        )
        .join(User, Post.user_id == User.id)
        .outerjoin(likes_subq, likes_subq.c.post_id == Post.id)
        .outerjoin(comments_subq, comments_subq.c.post_id == Post.id)
        .filter(Post.id == post_id)
        .first()
    )

    if not post_data:
        return jsonify({"error": "Post not found"}), 404

    post, user, likes_count, comments_count = post_data

    formatted_post = _format_post_for_api(post_data, session["user_id"])  # Uses fallback logic

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": [formatted_post]  # Keep as a list for frontend consistency
    })


@feed_bp.route("/posts/create", methods=["POST"])
@login_required
def create_post_with_file():
    """Creates a new post, supporting text, photo, and document uploads."""
    post_type = request.form.get("post_type")  # 'photo', 'document', 'text'
    caption = request.form.get("caption", "").strip()

    if post_type not in ['photo', 'document', 'text']:
        return jsonify({"error": "Invalid post type"}), 400

    file_path = None
    file_type = None

    # Handle file uploads for photo and document
    if post_type in ['photo', 'document']:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # Validate file type
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''

        if post_type == 'photo':
            if ext not in current_app.config['ALLOWED_IMAGE_EXTENSIONS']:
                return jsonify({
                    "error": (
                        "Invalid image format. "
                        f"Allowed: {', '.join(current_app.config['ALLOWED_IMAGE_EXTENSIONS'])}"
                    )
                }), 400
            file_type = 'image'

        if post_type == 'document':
            if ext not in current_app.config['ALLOWED_DOC_EXTENSIONS']:
                return jsonify({
                    "error": (
                        "Invalid document format. "
                        f"Allowed: {', '.join(current_app.config['ALLOWED_DOC_EXTENSIONS'])}"
                    )
                }), 400
            file_type = 'document'

        # Save file
        try:
            file_path = save_uploaded_file(file, file_type)
            if not file_path:
                return jsonify({"error": "Failed to save file"}), 500
        except Exception as e:
            return jsonify({"error": f"File upload failed: {str(e)}"}), 500

    elif post_type == 'text':
        if not caption:
            return jsonify({"error": "Text posts require content"}), 400
        file_type = 'text'

    # Create post
    try:
        post = Post(
            user_id=session["user_id"],
            caption=caption,
            image_url=f"/{file_path}" if file_path else "",
            file_path=file_path,
            file_type=file_type,
            post_type="normal"
        )

        db.session.add(post)
        db.session.commit()

        return jsonify({
            "message": "Post created successfully",
            "post_id": post.id
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create post: {str(e)}"}), 500


@feed_bp.route("/posts/<int:post_id>/download")
@login_required
def download_post_attachment(post_id):
    """Allows users to download a document attached to a post."""
    post = db.session.get(Post, post_id)
    if not post or not post.file_path:
        abort(404)

    # Construct absolute path
    file_path = os.path.join(current_app.root_path, 'static', post.file_path)

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    clean_name = get_clean_filename(post.file_path)

    return send_file(
        file_path,
        as_attachment=True,
        download_name=clean_name
    )


@feed_bp.route("/posts/<int:post_id>/like", methods=["POST"])
@login_required
def toggle_like(post_id):
    """Toggles a user's 'like' on a post and creates/removes notifications."""
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    user_id = session["user_id"]

    existing = Like.query.filter_by(
        user_id=user_id,
        post_id=post_id
    ).first()

    if existing:
        db.session.delete(existing)

        # Remove associated notification if it exists
        notif = Notification.query.filter_by(
            type='post_like',
            actor_id=user_id,
            reference_id=post_id
        ).first()
        if notif:
            db.session.delete(notif)

        db.session.commit()
        liked = False
    else:
        like = Like(user_id=user_id, post_id=post_id)
        db.session.add(like)

        # Create notification if not liking own post
        post = db.session.get(Post, post_id)
        if post and post.user_id != user_id:
            liker = db.session.get(User, user_id)
            notification = Notification(
                user_id=post.user_id,
                type='post_like',
                message=f"{liker.full_name} liked your post",
                reference_id=post.id,
                actor_id=user_id
            )
            db.session.add(notification)

        db.session.commit()
        liked = True

    likes_count = Like.query.filter_by(post_id=post_id).count()

    return jsonify({
        "liked": liked,
        "likesCount": likes_count
    })


@feed_bp.route("/posts/<int:post_id>/comments")
def get_comments(post_id):
    """Fetches all comments for a given post."""
    comments = (
        db.session.query(Comment, User)
        .join(User, Comment.user_id == User.id)
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )

    return jsonify([
        {
            "username": user.full_name,
            "text": comment.text,
            "createdAt": comment.created_at.isoformat()
        }
        for comment, user in comments
    ])


@feed_bp.route("/posts/<int:post_id>/comments", methods=["POST"])
@login_required
def add_comment(post_id):
    """Adds a new comment to a post and enqueues a background job for processing."""
    post = db.session.get(Post, post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    text = request.json.get("text")
    if not text:
        return jsonify({"error": "Empty comment"}), 400

    comment = Comment(
        user_id=session["user_id"],
        post_id=post_id,
        text=text
    )

    db.session.add(comment)
    db.session.commit()

    # Offload notification creation and spam checks to a background worker.
    comment_queue_service.enqueue({
        'comment_id': comment.id,
        'text': comment.text,
        'user_id': session["user_id"],
        'post_id': post_id
    })

    return jsonify({"message": "Comment added (processing in background)"}), 201
