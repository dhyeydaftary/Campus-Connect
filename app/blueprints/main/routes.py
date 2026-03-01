"""
Main Blueprint - All non-auth, non-admin page and API routes.
"""

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort, current_app
from sqlalchemy import func, or_, and_
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timezone, timedelta
import time
from app.extensions import db, limiter
from app.models import (
    User, Post, Like, Comment, Event, EventRegistration,
    Connection, ConnectionRequest, Notification, Announcement,
    Skill, Experience, Education
)
from app.utils.decorators import admin_required, status_required
from app.utils.helpers import (
    get_clean_filename, _get_user_avatar, save_uploaded_file,
    _format_post_for_api, get_content_activity
)
from app.services.email_service import send_welcome_email
from app.services.comment_queue import comment_queue_service
from sqlalchemy.orm import joinedload

main_bp = Blueprint('main', __name__)


# ==============================================================================
# PAGE RENDERING ROUTES
# ==============================================================================

@main_bp.route("/")
def home():
    """Renders the public landing page."""
    return render_template("landing/landing.html")


@main_bp.route("/home")
def home_page():
    """Renders the main home feed for authenticated users."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))

    user = db.session.get(User, session["user_id"])

    if session.get("account_type") == "admin":
        return redirect(url_for("admin.admin_dashboard_page"))

    return render_template("main/home.html", user=user, user_name=user.full_name)


@main_bp.route("/messages")
def messages_page():
    """Renders the private messaging interface."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))
    user = db.session.get(User, session["user_id"])
    return render_template("main/messages.html", user=user)

@main_bp.route("/post/<int:post_id>")
def post_page(post_id):
    """Renders the detailed view for a single post."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))
    user = db.session.get(User, session["user_id"])
    return render_template("main/post.html", user=user, post_id=post_id)

@main_bp.route("/profile/<int:user_id>")
def profile_page(user_id):
    """Renders the user profile page."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))
    
    profile_user = db.session.get(User, user_id)
    if not profile_user:
        abort(404)
    
    current_user = db.session.get(User, session["user_id"])
    is_own_profile = (session["user_id"] == user_id)
    
    return render_template(
        "main/profile.html",
        profile_user=profile_user,
        user=current_user,
        user_name=current_user.full_name,
        is_own_profile=is_own_profile,
        current_user_id=session["user_id"]
    )

@main_bp.route('/favicon.ico')
def favicon():
    """Serves a 204 No Content response."""
    return '', 204


# ==============================================================================

@main_bp.route("/api/posts")
def api_posts():
    """Fetches a paginated feed of posts, ranked by a simple algorithm."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 5))
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


@main_bp.route("/api/posts/<int:post_id>")
def get_single_post_api(post_id):
    """Fetches the data for a single, specific post."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

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

    formatted_post = _format_post_for_api(post_data, session["user_id"]) # Uses fallback logic

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": [formatted_post] # Keep as a list for frontend consistency
    })


@main_bp.route("/api/posts/create", methods=["POST"])
def create_post_with_file():
    """Creates a new post, supporting text, photo, and document uploads."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
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
                return jsonify({"error": f"Invalid image format. Allowed: {', '.join(current_app.config['ALLOWED_IMAGE_EXTENSIONS'])}"}), 400
            file_type = 'image'
        
        if post_type == 'document':
            if ext not in current_app.config['ALLOWED_DOC_EXTENSIONS']:
                return jsonify({"error": f"Invalid document format. Allowed: {', '.join(current_app.config['ALLOWED_DOC_EXTENSIONS'])}"}), 400
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


@main_bp.route("/api/posts/<int:post_id>/download")
def download_post_attachment(post_id):
    """Allows users to download a document attached to a post."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

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


@main_bp.route("/api/posts/<int:post_id>/like", methods=["POST"])
def toggle_like(post_id):
    """Toggles a user's 'like' on a post and creates/removes notifications."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

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



@main_bp.route("/api/posts/<int:post_id>/comments")
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



@main_bp.route("/api/posts/<int:post_id>/comments", methods=["POST"])
def add_comment(post_id):
    """Adds a new comment to a post and enqueues a background job for processing."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

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


# ==============================================================================
# EVENTS API ROUTES
# ==============================================================================

@main_bp.route("/api/events")
def get_events():
    """Fetches all upcoming events and the current user's registration status for each."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    events = Event.query.filter(
        Event.event_date >= datetime.now(timezone.utc)
    ).order_by(Event.event_date.asc()).all()
    
    event_ids = [e.id for e in events]
    
    # Fetch all registrations for these events in one query
    registrations = EventRegistration.query.filter(
        EventRegistration.event_id.in_(event_ids)
    ).all() if event_ids else []
    
    # Pre-calculate counts in memory
    reg_data = {e_id: {'going': 0, 'interested': 0, 'user_status': None} for e_id in event_ids}
    for r in registrations:
        if r.status == 'going':
            reg_data[r.event_id]['going'] += 1
        elif r.status == 'interested':
            reg_data[r.event_id]['interested'] += 1
            
        if r.user_id == user_id:
            reg_data[r.event_id]['user_status'] = r.status
    
    events_data = []
    for event in events:
        data = reg_data[event.id]
        events_data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "eventDate": event.event_date.isoformat(),
            "totalSeats": event.total_seats,
            "availableSeats": max(0, event.total_seats - data["going"]),
            "goingCount": data["going"],
            "interestedCount": data["interested"],
            "userStatus": data["user_status"],
            "month": event.event_date.strftime("%b").upper(),
            "day": event.event_date.day,
            "time": event.event_date.strftime("%I:%M %p"),
            "dateTime": event.event_date.strftime("%B %d, %Y at %I:%M %p")
        })
    
    return jsonify(events_data)


@main_bp.route("/api/events/<int:event_id>/register", methods=["POST"])
def register_for_event(event_id):
    """Registers, unregisters, or updates a user's status for an event ('going' or 'interested')."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    data = request.json
    status = data.get("status")  # 'going' or 'interested'
    
    if status not in ['going', 'interested']:
        return jsonify({"error": "Invalid status. Must be 'going' or 'interested'"}), 400
    
    # Security: Use `with_for_update()` to lock the event row during the transaction.
    # This prevents race conditions where two users join the last seat simultaneously.
    event = db.session.query(Event).with_for_update().filter_by(id=event_id).first()
    
    if not event:
        return jsonify({"error": "Event not found"}), 404
    
    if event.is_cancelled:
        return jsonify({"error": "Cannot register for a cancelled event"}), 400
    
    # Check existing registration
    existing = EventRegistration.query.filter_by(
        event_id=event_id,
        user_id=user_id
    ).first()
    
    message = ""
    user_status = None
    status_code = 200

    if existing:
        # User wants to change status
        if existing.status == status:
            # Same status - remove registration (toggle off)
            db.session.delete(existing)
            message = "Registration cancelled"
            user_status = None
            status_code = 200
        else:
            # Different status - update
            # If changing from interested to going, check seats
            if status == 'going':                
                current_going = event.registrations.filter_by(status='going').count()
                if (event.total_seats - current_going) <= 0:
                    return jsonify({"error": "No seats available"}), 400
            
            existing.status = status
            message = f"Status updated to {status}"
            user_status = status
            status_code = 200
    else:
        # New registration
        if status == 'going':
            current_going = event.registrations.filter_by(status='going').count()
            if (event.total_seats - current_going) <= 0:
                return jsonify({"error": "No seats available"}), 400
        
        registration = EventRegistration(
            event_id=event_id,
            user_id=user_id,
            status=status
        )
        db.session.add(registration)
        message = f"Registered as {status}"
        user_status = status
        status_code = 201
    
    db.session.commit()
    
    # Re-query counts after the transaction to ensure the response is accurate.
    final_going = event.registrations.filter_by(status='going').count()
    final_interested = event.registrations.filter_by(status='interested').count()
    final_available = max(0, event.total_seats - final_going)
    
    return jsonify({
        "message": message,
        "userStatus": user_status,
        "availableSeats": final_available,
        "goingCount": final_going,
        "interestedCount": final_interested
    }), status_code


# ==============================================================================
# ANNOUNCEMENTS & SUGGESTIONS API
# ==============================================================================

@main_bp.route("/api/announcements", methods=["GET"])
def get_announcements():
    """Fetches active announcements for all users."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    limit = request.args.get("limit", type=int)
    query = Announcement.query.filter_by(status='active').order_by(Announcement.created_at.desc())
    
    if limit:
        announcements = query.limit(limit).all()
    else:
        announcements = query.all()
    
    announcements_data = []
    for ann in announcements:
        announcements_data.append({
            "id": ann.id,
            "title": ann.title,
            "content": ann.content,
            "text": ann.content, # Backward compatibility for frontend
            "date": ann.created_at.strftime("%d %b %Y, %I:%M %p"), # Human readable with time
            "iso_date": ann.created_at.isoformat(),
            "author": ann.author.full_name if ann.author else "Admin",
            "updated_at": ann.updated_at.strftime("%d %b %Y, %I:%M %p") if ann.updated_at else None
        })
    
    return jsonify(announcements_data)


@main_bp.route("/api/suggestions", methods=["GET"])
def get_suggestions():
    """Generates a list of connection suggestions for the current user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    current_user = db.session.get(User, current_user_id)
    
    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    # 1. Get IDs of users who are already connected.
    connected_ids = current_user.get_connection_ids()
    
    # 2. Get IDs of users with pending requests (both sent and received).
    pending_sent = [r.receiver_id for r in ConnectionRequest.query.filter_by(
        sender_id=current_user_id, 
        status='pending'
    ).all()]
    
    pending_received = [r.sender_id for r in ConnectionRequest.query.filter_by(
        receiver_id=current_user_id, 
        status='pending'
    ).all()]
    
    # 3. Combine all users to be excluded from suggestions.
    exclude_ids = set(connected_ids + pending_sent + pending_received + [current_user_id])
    
    # 4. Query for suggestions with a priority system.
    suggestions = []
    
    # Priority 1: Same university + same major
    suggestions = User.query.filter(
        User.id.notin_(exclude_ids),
        User.account_type != 'admin',
        User.university == current_user.university,
        User.major == current_user.major
    ).order_by(func.random()).limit(5).all()
    
    # Priority 2: If not enough, add same university (any major)
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions]),
            User.university == current_user.university
        ).order_by(func.random()).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Priority 3: If still not enough, add anyone else
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions])
        ).order_by(func.random()).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Step 5: Format response
    result = [] # Renamed from 'suggestions' to avoid confusion with the query result
    for user in suggestions:
        result.append({
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "university": user.university,
            "major": user.major,
            "batch": user.batch,
            "profile_picture": _get_user_avatar(user)
        })
    
    return jsonify({"suggestions": result})


# ==============================================================================
# CONNECTIONS API ROUTES
# ==============================================================================

@main_bp.route("/api/connections/request", methods=["POST"])
def send_connection_request():
    """Sends a connection request to another user or re-sends a rejected one."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    receiver_id = data.get("receiver_id")
    
    if not receiver_id:
        return jsonify({"error": "Receiver ID required"}), 400
    
    sender_id = session["user_id"]
    
    if sender_id == receiver_id:
        return jsonify({"error": "Cannot connect with yourself"}), 400
    
    # Check if receiver exists
    receiver = db.session.get(User, receiver_id)
    if not receiver:
        return jsonify({"error": "User not found"}), 404
    
    # Check if already connected
    existing_connection = Connection.query.filter(
        or_(
            and_(Connection.user_id == sender_id, Connection.connected_user_id == receiver_id),
            and_(Connection.user_id == receiver_id, Connection.connected_user_id == sender_id)
        )
    ).first()
    
    if existing_connection:
        return jsonify({"error": "Already connected"}), 400
    
    # Check if I already sent a request (any status)
    my_request = ConnectionRequest.query.filter_by(
        sender_id=sender_id,
        receiver_id=receiver_id
    ).first()
    
    if my_request:
        if my_request.status == 'pending':
            return jsonify({"error": "Request already sent"}), 400
        elif my_request.status == 'accepted':
            return jsonify({"error": "Already connected"}), 400
        elif my_request.status == 'rejected':
            # Reactivate rejected request
            my_request.status = 'pending'
            my_request.created_at = datetime.now(timezone.utc)
            my_request.responded_at = None
            
            # Create notification for receiver
            sender = db.session.get(User, sender_id)
            notification = Notification(
                user_id=receiver_id,
                type='connection_request',
                message=f"{sender.full_name} sent you a connection request",
                reference_id=my_request.id,
                actor_id=sender_id
            )
            
            db.session.add(notification)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Connection request sent",
                "request_id": my_request.id
            })

    # Check if they sent me a request
    their_request = ConnectionRequest.query.filter_by(
        sender_id=receiver_id,
        receiver_id=sender_id
    ).first()
    
    if their_request:
        if their_request.status == 'pending':
            return jsonify({"error": "This user already sent you a request"}), 400
        elif their_request.status == 'accepted':
            return jsonify({"error": "Already connected"}), 400
        # If rejected, we allow sending a new request from me to them
    
    # Create new connection request
    new_request = ConnectionRequest(
        sender_id=sender_id,
        receiver_id=receiver_id,
        status='pending'
    )
    
    db.session.add(new_request)
    
    # Create notification for receiver
    sender = db.session.get(User, sender_id)
    notification = Notification(
        user_id=receiver_id,
        type='connection_request',
        message=f"{sender.full_name} sent you a connection request",
        reference_id=new_request.id,
        actor_id=sender_id
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request sent",
        "request_id": new_request.id
    })


@main_bp.route("/api/connections/accept/<int:request_id>", methods=["POST"])
def accept_connection_request(request_id):
    """Accepts a pending connection request."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Get the request
    conn_request = db.session.get(ConnectionRequest, request_id)
    
    if not conn_request:
        return jsonify({"error": "Request not found"}), 404
    
    # Verify you're the receiver
    if conn_request.receiver_id != current_user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    # Check if already accepted
    if conn_request.status == 'accepted':
        return jsonify({"error": "Already accepted"}), 400
    
    # Update request status
    conn_request.status = 'accepted'
    conn_request.responded_at = datetime.now(timezone.utc)
    
    # Create connection (store smaller ID first for consistency)
    user_a = min(conn_request.sender_id, conn_request.receiver_id)
    user_b = max(conn_request.sender_id, conn_request.receiver_id)
    
    new_connection = Connection(
        user_id=user_a,
        connected_user_id=user_b
    )
    
    db.session.add(new_connection)
    db.session.flush()
    
    # Create notification for sender
    receiver = db.session.get(User, current_user_id)
    notification = Notification(
        user_id=conn_request.sender_id,
        type='connection_accepted',
        message=f"{receiver.full_name} accepted your connection request",
        reference_id=new_connection.id,
        actor_id=current_user_id
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request accepted"
    })


@main_bp.route("/api/connections/reject/<int:request_id>", methods=["POST"])
def reject_connection_request(request_id):
    """Rejects a pending connection request."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Get the request
    conn_request = db.session.get(ConnectionRequest, request_id)
    
    if not conn_request:
        return jsonify({"error": "Request not found"}), 404
    
    # Verify you're the receiver
    if conn_request.receiver_id != current_user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    # Update request status
    conn_request.status = 'rejected'
    conn_request.responded_at = datetime.now(timezone.utc)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request rejected"
    })


@main_bp.route("/api/connections/pending", methods=["GET"])
def get_pending_requests():
    """Fetches all connection requests received by the current user that are pending."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Get requests where current user is the receiver
    pending_requests = ConnectionRequest.query.filter_by(
        receiver_id=current_user_id,
        status='pending'
    ).order_by(ConnectionRequest.created_at.desc()).all()
    
    result = []
    for req in pending_requests:
        sender = db.session.get(User, req.sender_id)
        if sender:
            result.append({
                "request_id": req.id,
                "sender": {
                    "id": sender.id,
                    "name": sender.full_name,
                    "email": sender.email,
                    "university": sender.university,
                    "major": sender.major,
                    "profile_picture": _get_user_avatar(sender)
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})


@main_bp.route("/api/connections/sent", methods=["GET"])
def get_sent_requests():
    """Fetches all connection requests sent by the current user that are still pending."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Get requests where current user is the sender
    sent_requests = ConnectionRequest.query.filter_by(
        sender_id=current_user_id,
        status='pending'
    ).order_by(ConnectionRequest.created_at.desc()).all()
    
    result = []
    for req in sent_requests:
        receiver = db.session.get(User, req.receiver_id)
        if receiver:
            result.append({
                "request_id": req.id,
                "receiver": {
                    "id": receiver.id,
                    "name": receiver.full_name,
                    "email": receiver.email,
                    "university": receiver.university,
                    "major": receiver.major,
                    "profile_picture": _get_user_avatar(receiver)
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})


@main_bp.route("/api/connections/<int:user_id>", methods=["DELETE"])
def remove_connection(user_id):
    """Removes a connection between the current user and another user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Find connection (bidirectional check)
    connection = Connection.query.filter(
        or_(
            and_(Connection.user_id == current_user_id, Connection.connected_user_id == user_id),
            and_(Connection.user_id == user_id, Connection.connected_user_id == current_user_id)
        )
    ).first()
    
    if not connection:
        return jsonify({"error": "Connection not found"}), 404
        
    db.session.delete(connection)
    
    # Clean up associated connection requests to allow re-connecting
    requests = ConnectionRequest.query.filter(
        or_(
            and_(ConnectionRequest.sender_id == current_user_id, ConnectionRequest.receiver_id == user_id),
            and_(ConnectionRequest.sender_id == user_id, ConnectionRequest.receiver_id == current_user_id)
        )
    ).all()
    
    for req in requests:
        db.session.delete(req)
        
    db.session.commit()
    
    return jsonify({"success": True, "message": "Connection removed"})


# ==============================================================================
# NOTIFICATIONS API ROUTES
# ==============================================================================

@main_bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    """Fetches the latest notifications for the current user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    # Get all notifications, ordered by newest first
    notifications = Notification.query.filter_by(
        user_id=user_id
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    result = []
    for notif in notifications:
        # Get actor info if exists
        actor = None
        if notif.actor_id:
            actor_user = db.session.get(User, notif.actor_id)
            if actor_user:
                actor = {
                    "id": actor_user.id,
                    "name": actor_user.full_name,
                    "profile_picture": _get_user_avatar(actor_user)
                }
        
        result.append({
            "id": notif.id,
            "type": notif.type,
            "message": notif.message,
            "reference_id": notif.reference_id,
            "actor": actor,
            "is_read": notif.is_read,
            "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    # Add unread_count to response so frontend doesn't reset badge to 0
    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({"notifications": result, "unread_count": unread_count})


@main_bp.route("/api/notifications/unread-count", methods=["GET"])
@limiter.exempt
def get_unread_count():
    """Fetches only the count of unread notifications, for badge updates."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({"count": unread_count})


@main_bp.route("/api/connections/list", methods=["GET"])
def get_connections_list():
    """Fetches a simple list of all of the current user's connections."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    
    # Get all connections (bidirectional check)
    connections = Connection.query.filter(
        or_(
            Connection.user_id == current_user_id,
            Connection.connected_user_id == current_user_id
        )
    ).order_by(Connection.connected_at.desc()).all()
    
    result = []
    for conn in connections:
        # Get the OTHER user's ID
        other_user_id = conn.connected_user_id if conn.user_id == current_user_id else conn.user_id
        other_user = db.session.get(User, other_user_id)
        
        if other_user:
            result.append({
                "id": other_user.id,
                "name": other_user.full_name,
                "email": other_user.email,
                "university": other_user.university,
                "major": other_user.major,
                "batch": other_user.batch,
                "profile_picture": _get_user_avatar(other_user),
                "connected_since": conn.connected_at.strftime("%B %Y")
            })
    
    return jsonify({"connections": result, "count": len(result)})


@main_bp.route("/api/notifications/mark-read/<int:notification_id>", methods=["POST"])
def mark_notification_read(notification_id):
    """Marks a single notification as read."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    notification = db.session.get(Notification, notification_id)
    
    if not notification:
        return jsonify({"error": "Notification not found"}), 404
    
    if notification.user_id != user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({"success": True})


@main_bp.route("/api/notifications/mark-all-read", methods=["POST"])
def mark_all_notifications_read():
    """Marks all of the user's unread notifications as read."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).update({"is_read": True})
    
    db.session.commit()
    
    return jsonify({"success": True})


@main_bp.route("/api/notifications/clear", methods=["POST"])
def clear_notifications():
    """Deletes all notifications for the current user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    Notification.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    
    return jsonify({"success": True})

@main_bp.route("/api/profile/completion", methods=["GET"])
def get_profile_completion():
    """Calculates a profile completion score and suggests actions for improvement."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    user = db.session.get(User, user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    checklist = []
    
    # 1. Profile Picture
    has_pic = getattr(user, 'profile_picture', None) is not None
    if not has_pic:
        checklist.append({"label": "Add profile photo", "action": f"/profile/{user_id}", "is_js": False})
    
    # 2. Bio
    has_bio = user.bio is not None and len(user.bio.strip()) > 0
    if not has_bio:
        checklist.append({"label": "Add bio", "action": f"/profile/{user_id}", "is_js": False})
        
    # 3. Major (Department)
    has_major = user.major is not None and len(user.major.strip()) > 0
    if not has_major:
        checklist.append({"label": "Add major/department", "action": f"/profile/{user_id}", "is_js": False})

    # 4. Skills
    skill_count = Skill.query.filter_by(user_id=user_id).count()
    if skill_count == 0:
        checklist.append({"label": "Add skills", "action": f"/profile/{user_id}", "is_js": False})

    # 5. Post
    post_count = Post.query.filter_by(user_id=user_id).count()
    if post_count == 0:
        checklist.append({"label": "Create your first post", "action": "openCreatePost()", "is_js": True})

    # 6. Connection
    conn_count = Connection.query.filter(
        or_(Connection.user_id == user_id, Connection.connected_user_id == user_id)
    ).count()
    if conn_count == 0:
        checklist.append({"label": "Connect with someone", "action": "document.getElementById('suggestions-container').scrollIntoView({behavior: 'smooth'})", "is_js": True})

    total_items = 6
    completed_items = total_items - len(checklist)
    percentage = int((completed_items / total_items) * 100)

    return jsonify({
        "percentage": percentage,
        "missing_fields": checklist
    })


@main_bp.route("/api/profile/me", methods=["GET"])
def get_my_profile():
    """Fetches a lightweight summary of the current user's profile for the navbar."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = db.session.get(User, session["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Count posts
    post_count = Post.query.filter_by(user_id=user.id).count()
    
    # Count connections (bidirectional)
    connection_count = Connection.query.filter(
        or_(
            Connection.user_id == user.id,
            Connection.connected_user_id == user.id
        )
    ).count()
    
    return jsonify({
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "profile_picture": _get_user_avatar(user),
        "university": user.university,
        "major": user.major,
        "batch": user.batch,
        "stats": {
            "posts": post_count,
            "connections": connection_count
        }
    })



@main_bp.route("/api/profile/<int:user_id>/posts")
def api_profile_posts(user_id):
    """Fetches a paginated feed of posts created by a specific user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    # Check if profile user exists
    profile_user = db.session.get(User, user_id)
    if not profile_user:
        return jsonify({"error": "User not found"}), 404

    # Fetch posts for this specific user
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 5))
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
        .filter(Post.user_id == user_id)  # Filter by specific user
        .order_by(Post.created_at.desc())
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


@main_bp.route("/api/profile/<int:user_id>", methods=["GET"])
def get_profile_data(user_id):
    """Fetches a comprehensive dataset for a user's profile page."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    current_user_id = session.get("user_id", None)  # None if not logged in

    # Get the profile user
    profile_user = db.session.get(User, user_id)

    if not profile_user:
        return jsonify({"error": "User not found"}), 404

    # Check if viewing own profile
    is_own_profile = (current_user_id == user_id) if current_user_id else False

    # Get connection status
    connection_status = None
    pending_request_id = None

    if not is_own_profile and current_user_id:
        # Check if connected
        existing_connection = Connection.query.filter(
            or_(
                and_(Connection.user_id == current_user_id, Connection.connected_user_id == user_id),
                and_(Connection.user_id == user_id, Connection.connected_user_id == current_user_id)
            )
        ).first()

        if existing_connection:
            connection_status = 'connected'
        else:
            # Check for pending requests
            sent_request = ConnectionRequest.query.filter_by(
                sender_id=current_user_id,
                receiver_id=user_id,
                status='pending'
            ).first()

            received_request = ConnectionRequest.query.filter_by(
                sender_id=user_id,
                receiver_id=current_user_id,
                status='pending'
            ).first()

            if sent_request:
                connection_status = 'pending_sent'
            elif received_request:
                connection_status = 'pending_received'
                pending_request_id = received_request.id
            else:
                connection_status = 'not_connected'
    elif not current_user_id: # Not logged in
        connection_status = 'not_connected'

    # Get connection count and list
    connections_query = Connection.query.filter(
        or_(
            Connection.user_id == user_id,
            Connection.connected_user_id == user_id
        )
    )
    connection_count = connections_query.count()
    
    # Get counts for connection request tabs (only visible on own profile).
    received_count = 0
    sent_count = 0
    
    if is_own_profile:
        received_count = ConnectionRequest.query.filter_by(
            receiver_id=user_id,
            status='pending'
        ).count()
        
        sent_count = ConnectionRequest.query.filter_by(
            sender_id=user_id,
            status='pending'
        ).count()

    # Get connections list
    connections_data = []
    for conn in connections_query.all():
        other_user_id = conn.connected_user_id if conn.user_id == user_id else conn.user_id
        other_user = db.session.get(User, other_user_id)
        if other_user:
            connections_data.append({
                'id': other_user.id,
                'full_name': other_user.full_name,
                'email': other_user.email,
                'major': other_user.major,
                'university': other_user.university,
                'profile_picture': _get_user_avatar(other_user),
                'connected_since': conn.connected_at.strftime('%B %Y')
            })

    # Get mutual connections (if not own profile)
    mutual_connections = []
    mutual_connections_count = 0
    if not is_own_profile:
        # Get current user's connections
        current_user_connections = Connection.query.filter(
            or_(
                Connection.user_id == current_user_id,
                Connection.connected_user_id == current_user_id
            )
        ).all()

        current_user_connection_ids = set()
        for conn in current_user_connections:
            other_id = conn.connected_user_id if conn.user_id == current_user_id else conn.user_id
            current_user_connection_ids.add(other_id)

        # Get profile user's connections
        profile_user_connections = Connection.query.filter(
            or_(
                Connection.user_id == user_id,
                Connection.connected_user_id == user_id
            )
        ).all()

        profile_user_connection_ids = set()
        for conn in profile_user_connections:
            other_id = conn.connected_user_id if conn.user_id == user_id else conn.user_id
            profile_user_connection_ids.add(other_id)

        # Find mutual connections
        mutual_ids = current_user_connection_ids.intersection(profile_user_connection_ids)
        mutual_connections_count = len(mutual_ids)
        for mutual_id in mutual_ids:
            mutual_user = db.session.get(User, mutual_id)
            if mutual_user:
                mutual_connections.append({
                    'id': mutual_user.id,
                    'full_name': mutual_user.full_name,
                    'major': mutual_user.major,
                    'profile_picture': _get_user_avatar(mutual_user)
                })

    # Get user's posts with counts
    user_posts = Post.query.filter_by(user_id=user_id).order_by(Post.created_at.desc()).limit(20).all()
    post_count = Post.query.filter_by(user_id=user_id).count()

    # Format posts data
    posts_data = []
    for post in user_posts:
        likes_count = Like.query.filter_by(post_id=post.id).count()
        comments_count = Comment.query.filter_by(post_id=post.id).count()

        posts_data.append({
            'id': post.id,
            'caption': post.caption,
            'image_url': post.image_url,
            'created_at': post.created_at.strftime('%B %d, %Y at %I:%M %p'),
            'likes_count': likes_count,
            'comments_count': comments_count
        })

    skills_data = []
    user_skills = Skill.query.filter_by(user_id=user_id).all()
    for skill in user_skills:
        skills_data.append({
            'id': skill.id,
            'name': skill.skill_name,
            'level': skill.skill_level
        })

    # Get user's experiences (ordered by most recent first)
    experiences_data = []
    user_experiences = Experience.query.filter_by(user_id=user_id).order_by(Experience.start_date.desc()).all()
    for exp in user_experiences:
        experiences_data.append({
            'id': exp.id,
            'title': exp.title,
            'company': exp.company,
            'location': exp.location,
            'start_date': exp.start_date,
            'end_date': exp.end_date or 'Present',
            'description': exp.description,
            'is_current': exp.is_current
        })

    # Get user's educations
    educations_data = []
    user_educations = Education.query.filter_by(user_id=user_id).all()
    for edu in user_educations:
        educations_data.append({
            'id': edu.id,
            'degree': edu.degree,
            'field': edu.field,
            'institution': edu.institution,
            'year': edu.year
        })

    return jsonify({
        'user': {
            'id': profile_user.id,
            'full_name': profile_user.full_name,
            'email': profile_user.email,
            'university': profile_user.university,
            'major': profile_user.major,
            'batch': profile_user.batch,
            'bio': getattr(profile_user, 'bio', None),
            'profile_picture': _get_user_avatar(profile_user),
            'has_password': profile_user.password_hash is not None,
            'member_since': profile_user.created_at.strftime('%B %Y')
        },
        'is_own_profile': is_own_profile,
        'connection_status': connection_status,
        'pending_request_id': pending_request_id,
        'stats': {
            'connections_count': connection_count,
            'posts_count': post_count,
            'received_count': received_count,
            'sent_count': sent_count,
            'mutual_connections_count': mutual_connections_count
        },
        'posts': posts_data,
        'connections': connections_data,
        'mutual_connections': mutual_connections,
        'skills': skills_data,
        'experiences': experiences_data,
        'educations': educations_data
    })


@main_bp.route("/api/profile/photo", methods=["POST"])
def upload_profile_photo():
    """Handles the upload and update of a user's profile photo."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    # Validate file type (Images only)
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
        return jsonify({"error": "Invalid file type. Allowed: PNG, JPG, JPEG, WEBP"}), 400

    # Create directory if not exists
    upload_folder = os.path.join(current_app.root_path, 'static/uploads/profile_photos')
    os.makedirs(upload_folder, exist_ok=True)
    
    # Secure unique filename: user_{id}_{timestamp}.ext
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"user_{session['user_id']}_{int(time.time())}.{ext}"
    file_path = os.path.join(upload_folder, filename)
    
    file.save(file_path)
    
    # Update User in DB
    user = db.session.get(User, session["user_id"])
    user.profile_picture = f"/static/uploads/profile_photos/{filename}"
    db.session.commit()
    
    return jsonify({
        "message": "Profile photo updated", 
        "url": user.profile_picture
    })


# ==============================================================================
# PROFILE DETAIL MANAGEMENT API (Skills, Experience, etc.)
# ==============================================================================

@main_bp.route("/api/profile/skills", methods=["GET", "POST", "PUT", "DELETE"])
def manage_skills():
    """Provides full CRUD functionality for a user's skills."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]

    if request.method == "GET":
        skills = Skill.query.filter_by(user_id=user_id).all()
        return jsonify([{
            'id': skill.id,
            'name': skill.skill_name,
            'level': skill.skill_level
        } for skill in skills])

    elif request.method == "POST":
        data = request.json
        skill_name = data.get("name", "").strip()
        skill_level = data.get("level")

        # Allow empty skill name for new items that will be edited later
        # But prevent duplicates if name is provided
        if skill_name:
            existing = Skill.query.filter_by(user_id=user_id, skill_name=skill_name).first()
            if existing:
                return jsonify({"error": "Skill already exists"}), 400

        skill = Skill(
            user_id=user_id,
            skill_name=skill_name or "",  # Allow empty for new items
            skill_level=skill_level
        )
        db.session.add(skill)
        db.session.commit()

        return jsonify({
            'id': skill.id,
            'name': skill.skill_name,
            'level': skill.skill_level
        }), 201

    elif request.method == "PUT":
        data = request.json
        skill_id = data.get("id")
        skill_name = data.get("name", "").strip()
        skill_level = data.get("level")

        if not skill_id or not skill_name:
            return jsonify({"error": "Skill ID and name required"}), 400

        skill = Skill.query.filter_by(id=skill_id, user_id=user_id).first()
        if not skill:
            return jsonify({"error": "Skill not found"}), 404

        skill.skill_name = skill_name
        skill.skill_level = skill_level
        db.session.commit()

        return jsonify({
            'id': skill.id,
            'name': skill.skill_name,
            'level': skill.skill_level
        })

    elif request.method == "DELETE":
        skill_id = request.args.get("id")
        if not skill_id:
            return jsonify({"error": "Skill ID required"}), 400

        skill = Skill.query.filter_by(id=skill_id, user_id=user_id).first()
        if not skill:
            return jsonify({"error": "Skill not found"}), 404

        db.session.delete(skill)
        db.session.commit()

        return jsonify({"message": "Skill deleted"})


@main_bp.route("/api/profile/experiences", methods=["GET", "POST", "PUT", "DELETE"])
def manage_experiences():
    """Provides full CRUD functionality for a user's work experiences."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]

    if request.method == "GET":
        experiences = Experience.query.filter_by(user_id=user_id).order_by(Experience.start_date.desc()).all()
        return jsonify([{
            'id': exp.id,
            'title': exp.title,
            'company': exp.company,
            'location': exp.location,
            'start_date': exp.start_date,
            'end_date': exp.end_date,
            'description': exp.description,
            'is_current': exp.is_current
        } for exp in experiences])

    elif request.method == "POST":
        data = request.json
        title = data.get("title", "").strip()
        company = data.get("company", "").strip()
        location = data.get("location", "").strip()
        start_date = data.get("start_date", "").strip()
        end_date = data.get("end_date", "").strip() if data.get("end_date") else None
        description = data.get("description", "").strip()
        is_current = data.get("is_current", False)

        if not title or not company or not start_date:
            return jsonify({"error": "Title, company, and start date required"}), 400

        experience = Experience(
            user_id=user_id,
            title=title,
            company=company,
            location=location,
            start_date=start_date,
            end_date=end_date,
            description=description,
            is_current=is_current
        )
        db.session.add(experience)
        db.session.commit()

        return jsonify({
            'id': experience.id,
            'title': experience.title,
            'company': experience.company,
            'location': experience.location,
            'start_date': experience.start_date,
            'end_date': experience.end_date,
            'description': experience.description,
            'is_current': experience.is_current
        }), 201

    elif request.method == "PUT":
        data = request.json
        exp_id = data.get("id")
        title = data.get("title", "").strip()
        company = data.get("company", "").strip()
        location = data.get("location", "").strip()
        start_date = data.get("start_date", "").strip()
        end_date = data.get("end_date", "").strip() if data.get("end_date") else None
        description = data.get("description", "").strip()
        is_current = data.get("is_current", False)

        if not exp_id or not title or not company or not start_date:
            return jsonify({"error": "Experience ID, title, company, and start date required"}), 400

        experience = Experience.query.filter_by(id=exp_id, user_id=user_id).first()
        if not experience:
            return jsonify({"error": "Experience not found"}), 404

        experience.title = title
        experience.company = company
        experience.location = location
        experience.start_date = start_date
        experience.end_date = end_date
        experience.description = description
        experience.is_current = is_current
        db.session.commit()

        return jsonify({
            'id': experience.id,
            'title': experience.title,
            'company': experience.company,
            'location': experience.location,
            'start_date': experience.start_date,
            'end_date': experience.end_date,
            'description': experience.description,
            'is_current': experience.is_current
        })

    elif request.method == "DELETE":
        exp_id = request.args.get("id")
        if not exp_id:
            return jsonify({"error": "Experience ID required"}), 400

        experience = Experience.query.filter_by(id=exp_id, user_id=user_id).first()
        if not experience:
            return jsonify({"error": "Experience not found"}), 404

        db.session.delete(experience)
        db.session.commit()

        return jsonify({"message": "Experience deleted"})


@main_bp.route("/api/profile/educations", methods=["GET", "POST", "PUT", "DELETE"])
def manage_educations():
    """Provides full CRUD functionality for a user's education history."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]

    if request.method == "GET":
        educations = Education.query.filter_by(user_id=user_id).all()
        return jsonify([{
            'id': edu.id,
            'degree': edu.degree,
            'field': edu.field,
            'institution': edu.institution,
            'year': edu.year
        } for edu in educations])

    elif request.method == "POST":
        data = request.json
        degree = data.get("degree", "").strip()
        field = data.get("field", "").strip()
        institution = data.get("institution", "").strip()
        year = data.get("year", "").strip()

        if not degree or not field or not institution or not year:
            return jsonify({"error": "Degree, field, institution, and year required"}), 400

        education = Education(
            user_id=user_id,
            degree=degree,
            field=field,
            institution=institution,
            year=year
        )
        db.session.add(education)
        db.session.commit()

        return jsonify({
            'id': education.id,
            'degree': education.degree,
            'field': education.field,
            'institution': education.institution,
            'year': education.year
        }), 201

    elif request.method == "PUT":
        data = request.json
        edu_id = data.get("id")
        degree = data.get("degree", "").strip()
        field = data.get("field", "").strip()
        institution = data.get("institution", "").strip()
        year = data.get("year", "").strip()

        if not edu_id or not degree or not field or not institution or not year:
            return jsonify({"error": "Education ID, degree, field, institution, and year required"}), 400

        education = Education.query.filter_by(id=edu_id, user_id=user_id).first()
        if not education:
            return jsonify({"error": "Education not found"}), 404

        education.degree = degree
        education.field = field
        education.institution = institution
        education.year = year
        db.session.commit()

        return jsonify({
            'id': education.id,
            'degree': education.degree,
            'field': education.field,
            'institution': education.institution,
            'year': education.year
        })

    elif request.method == "DELETE":
        edu_id = request.args.get("id")
        if not edu_id:
            return jsonify({"error": "Education ID required"}), 400

        education = Education.query.filter_by(id=edu_id, user_id=user_id).first()
        if not education:
            return jsonify({"error": "Education not found"}), 404

        db.session.delete(education)
        db.session.commit()

        return jsonify({"message": "Education deleted"})


@main_bp.route("/api/profile/bio", methods=["PUT"])
def update_bio():
    """Updates the 'bio' field for the current user."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    user_id = session["user_id"]
    data = request.json
    bio = data.get("bio", "").strip()

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.bio = bio
    db.session.commit()

    return jsonify({"message": "Bio updated", "bio": bio})

@main_bp.route("/api/search", methods=["GET"])
def search_all():
    """Performs a global search across users and announcements."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    query = request.args.get("q", "").strip()
    
    if not query or len(query) < 2:
        return jsonify({"users": [], "posts": [], "announcements": []})
        
    search_term = f"%{query}%"
    
    # 1. Search Users (Name, Major)
    users = User.query.filter(
        or_(
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.major.ilike(search_term)
        ),
        User.status == 'ACTIVE'
    ).limit(5).all()
    
    # 2. Search Announcements (Title)
    announcements = Announcement.query.filter(
        Announcement.title.ilike(search_term),
        Announcement.status == 'active'
    ).limit(3).all()
    
    return jsonify({
        "users": [{
            "id": u.id,
            "name": u.full_name,
            "major": u.major,
            "profile_picture": _get_user_avatar(u)
        } for u in users],
        "announcements": [{
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "date": a.created_at.strftime("%d %b %Y, %I:%M %p"),
            "author": a.author.full_name if a.author else "Admin",
            "updated_at": a.updated_at.strftime("%d %b %Y, %I:%M %p") if a.updated_at else None
        } for a in announcements]
    })
