"""
Main Blueprint - All non-auth, non-admin page and API routes.
"""

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort, current_app
from sqlalchemy import func, or_, and_
import os
import time
from app.extensions import db
from app.models import (
    User, Post, Like, Comment, Connection, ConnectionRequest, Announcement,
    Skill, Experience, Education
)

from app.utils.helpers import (
    _get_user_avatar, _format_post_for_api
)

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
    return render_template("main/messages.html", user=user, user_name=user.full_name)


@main_bp.route("/post/<int:post_id>")
def post_page(post_id):
    """Renders the detailed view for a single post."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))
    user = db.session.get(User, session["user_id"])
    return render_template("main/post.html", user=user, user_name=user.full_name, post_id=post_id)


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
# ANNOUNCEMENTS & SUGGESTIONS API
# ==============================================================================

@main_bp.route("/api/announcements", methods=["GET"])
def get_announcements():
    """Fetches active announcements for all users."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        limit = request.args.get("limit")
        if limit is not None:
            limit = int(limit)
            if limit < 1:
                limit = None  # Ignore invalid limits
    except (ValueError, TypeError):
        limit = None

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
            "text": ann.content,  # Backward compatibility for frontend
            "date": ann.created_at.strftime("%d %b %Y, %I:%M %p"),  # Human readable with time
            "iso_date": ann.created_at.isoformat(),
            "author": ann.author.full_name if ann.author else "Admin",
            "updated_at": ann.updated_at.strftime("%d %b %Y, %I:%M %p") if ann.updated_at else None
        })

    return jsonify(announcements_data)


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
        checklist.append({
            "label": "Connect with someone",
            "action": "document.getElementById('suggestions-container').scrollIntoView({behavior: 'smooth'})",
            "is_js": True
        })

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
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 5))
        if page < 1 or limit < 1:
            return jsonify({"error": "Invalid pagination parameters"}), 400
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
    elif not current_user_id:  # Not logged in
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
