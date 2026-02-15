from dotenv import load_dotenv
load_dotenv()

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    abort
)

from config import Config
from models import db, bcrypt, User, Post, Like, Comment, Event, EventRegistration, Connection, ConnectionRequest, Notification, Skill, Experience, Education, AdminLog, Announcement, Conversation, Message
from sqlalchemy import func, or_, and_, DateTime
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timezone, timedelta
import re
import time

from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from flask import send_file
from flask_socketio import SocketIO
from chat_routes import chat_bp
from chat_socket import init_socket_events

# --------------------------------------------------
# CREATE APP & LOAD CONFIGURATION
# --------------------------------------------------

app = Flask(__name__)
app.config.from_object(Config)  # This loads ALL config from config.py
START_TIME = datetime.now(timezone.utc)

if not app.secret_key:
    raise RuntimeError("SECRET_KEY not set. Check .env file.")

if not app.config["SQLALCHEMY_DATABASE_URI"]:
    raise RuntimeError("DATABASE_URL not set. Check .env file.")

# Initialize extensions
db.init_app(app)
bcrypt.init_app(app)

socketio = SocketIO(app, cors_allowed_origins="*", manage_session=False)

# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def admin_required():
    """
    Admin access guard function.
    Checks if the current user is an admin, otherwise aborts with 403.
    """
    if "user_id" not in session:
        abort(redirect(url_for("login_page")))  # Redirect to login if not authenticated
    
    if session.get("account_type") != "admin":
        abort(403)  # Forbidden - not an admin


def allowed_file(filename, allowed_extensions):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def save_uploaded_file(file, file_type):
    """Save uploaded file and return path"""
    if not file or file.filename == '':
        return None
    
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{session['user_id']}_{timestamp}_{secure_filename(file.filename)}"
    
    upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'post', 'post_images' if file_type == 'image' else 'post_docs')
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)
    
    return file_path.replace('static/', '')


def get_clean_filename(file_path):
    """Extract original filename from the unique system filename"""
    if not file_path:
        return None
    filename = os.path.basename(file_path)
    # Pattern: userID_YYYYMMDD_HHMMSS_ActualName
    match = re.match(r'^\d+_\d{8}_\d{6}_(.+)$', filename)
    if match:
        return match.group(1)
    return filename

def get_content_activity():
    today_utc = datetime.now(timezone.utc).date()
    days = [today_utc - timedelta(days=i) for i in range(6, -1, -1)]

    start_dt = datetime.combine(days[0], datetime.min.time(), tzinfo=timezone.utc)

    posts_counts = {day: 0 for day in days}
    events_counts = {day: 0 for day in days}

    posts_query = (
        db.session.query(
            func.date(func.timezone('UTC', Post.created_at)),
            func.count(Post.id)
        )
        .filter(Post.created_at >= start_dt)
        .group_by(func.date(func.timezone('UTC', Post.created_at)))
        .all()
    )

    for day, count in posts_query:
        if day in posts_counts:
            posts_counts[day] = count

    events_query = (
        db.session.query(
            func.date(func.timezone('UTC', Event.event_date)),
            func.count(Event.id)
        )
        .filter(Event.event_date >= start_dt)
        .group_by(func.date(func.timezone('UTC', Event.event_date)))
        .all()
    )

    for day, count in events_query:
        if day in events_counts:
            events_counts[day] = count

    return {
        "labels": [d.strftime("%b %d") for d in days],
        "posts": [posts_counts[d] for d in days],
        "events": [events_counts[d] for d in days],
    }

app.register_blueprint(chat_bp)
init_socket_events(socketio)


# --------------------------------------------------
# PAGE ROUTES (HTML)
# --------------------------------------------------

@app.route("/")
def home():
    return render_template("landing.html")

@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/signup")
def signup_page():
    return render_template("signup.html")


@app.route("/home")
def home_page():
    # Protect home route
    if "user_id" not in session:
        return redirect(url_for("login_page"))

    # Fetch current user to get profile picture
    user = db.session.get(User, session["user_id"])

    # Fix: Redirect admin to dashboard if they try to access student home
    if session.get("account_type") == "admin":
        return redirect(url_for("admin_dashboard_page"))

    return render_template(
        "home.html",
        user=user,
        user_name=session.get("user_name")
    )


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


@app.route("/messages")
def messages_page():
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    
    user = db.session.get(User, session["user_id"])
    return render_template("messages.html", user=user, user_name=session.get("user_name"))

@app.route("/post/<int:post_id>")
def post_page(post_id):
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    
    user = db.session.get(User, session["user_id"])
    return render_template("post.html", user=user, user_name=session.get("user_name"), post_id=post_id)


# --------------------------------------------------
# ADMIN PAGE ROUTES (HTML)
# --------------------------------------------------

@app.route("/admin/dashboard")
def admin_dashboard_page():
    admin_required()
    return render_template("admin/dashboard.html")

@app.route("/admin/users")
def admin_users_page():
    admin_required()
    return render_template("admin/users.html")

@app.route("/admin/events")
def admin_events_page():
    admin_required()
    return render_template("admin/events.html")

@app.route("/admin/announcements")
def admin_announcements_page():
    admin_required()
    return render_template("admin/announcements.html")

@app.route("/admin/logs")
def admin_logs_page():
    admin_required()
    return render_template("admin/logs.html")

@app.route("/profile/<int:user_id>")
def profile_page(user_id):
    """Profile page route - renders the profile HTML template"""
    if "user_id" not in session:
        return redirect(url_for("login_page"))
    
    # Get the user whose profile is being viewed
    profile_user = db.session.get(User, user_id)
    if not profile_user:
        abort(404)
    
    # Get current user for navbar
    current_user = db.session.get(User, session["user_id"])

    # Check if viewing own profile
    is_own_profile = (session["user_id"] == user_id)
    
    return render_template(
        "profile.html",
        profile_user=profile_user,
        user=current_user,
        user_name=session.get("user_name"),
        is_own_profile=is_own_profile,
        current_user_id=session["user_id"]
    )

# --------------------------------------------------
# API ROUTES (JSON)
# --------------------------------------------------

@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json

    required_fields = ["first_name", "last_name", "email", "password", "university", "major", "batch"]
    if not data or not all(k in data for k in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    email = data["email"].strip().lower()

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "User already exists"}), 409

    try:
        new_user = User.create_from_json(data)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500



@app.route("/api/login", methods=["POST"])
def login():
    data = request.json

    if not data:
        return jsonify({"error": "Invalid request"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Check if user account is active
    if not user.is_active:
        return jsonify({"error": "Account has been disabled. Please contact administrator."}), 403

    # Create session
    session["user_id"] = user.id
    session["user_name"] = user.full_name
    session["account_type"] = user.account_type

    # Redirect based on account type
    redirect_url = "/admin/dashboard" if user.account_type == "admin" else "/home"

    return jsonify({
        "message": "Login successful",
        "user_name": user.full_name,
        "redirect_url": redirect_url
    }), 200



@app.route("/api/posts")
def api_posts():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    # Fetch all posts from DB
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



    formatted_db_posts = []

    for post, user, likes_count, comments_count in db_posts:

        is_liked = Like.query.filter_by(
            post_id=post.id,
            user_id=session["user_id"]
        ).first() is not None

        formatted_db_posts.append({
            "id": post.id,
            "user_id": post.user_id,
            "username": user.full_name,
            "profileImage": f"https://ui-avatars.com/api/?name={user.full_name}",
            "postImages": [f"/static/{post.file_path}"] if post.file_path else ([post.image_url] if post.image_url else []),
            "currentImageIndex": 0,
            "caption": post.caption,
            "accountType": "student",
            "collegeName": user.major,  # FIXED: was user.branch
            "likesCount": likes_count,
            "commentsCount": comments_count,
            "comments": [],
            "isLiked": is_liked,
            "createdAt": post.created_at.isoformat(),
            "file_path": post.file_path,
            "file_type": post.file_type,
            "image_url": f"/static/{post.file_path}" if post.file_path else post.image_url,
            "original_filename": get_clean_filename(post.file_path)
        })

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": formatted_db_posts
    })


@app.route("/api/posts/<int:post_id>")
def get_single_post_api(post_id):
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

    is_liked = Like.query.filter_by(
        post_id=post.id,
        user_id=session["user_id"]
    ).first() is not None

    formatted_post = {
        "id": post.id,
        "user_id": post.user_id,
        "username": user.full_name,
        "profileImage": f"https://ui-avatars.com/api/?name={user.full_name}",
        "postImages": [f"/static/{post.file_path}"] if post.file_path else ([post.image_url] if post.image_url else []),
        "currentImageIndex": 0,
        "caption": post.caption,
        "accountType": "student",
        "collegeName": user.major,
        "likesCount": likes_count,
        "commentsCount": comments_count,
        "comments": [],
        "isLiked": is_liked,
        "createdAt": post.created_at.isoformat(),
        "file_path": post.file_path,
        "file_type": post.file_type,
        "image_url": f"/static/{post.file_path}" if post.file_path else post.image_url,
        "original_filename": get_clean_filename(post.file_path)
    }

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": [formatted_post]
    })

@app.route("/api/posts", methods=["POST"])
def create_post():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    caption = data.get("caption")
    image_url = data.get("image_url")

    if not caption or not image_url:
        return jsonify({"error": "Caption and image required"}), 400

    post = Post(
        user_id=session["user_id"],
        caption=caption,
        image_url=image_url
    )

    db.session.add(post)
    db.session.commit()

    return jsonify({"message": "Post created"}), 201


# --------------------------------------------------
# NEW FILE UPLOAD POST CREATION
# --------------------------------------------------

@app.route("/api/posts/create", methods=["POST"])
def create_post_with_file():
    """Create a post with file upload support"""
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
            if ext not in app.config['ALLOWED_IMAGE_EXTENSIONS']:
                return jsonify({"error": f"Invalid image format. Allowed: {', '.join(app.config['ALLOWED_IMAGE_EXTENSIONS'])}"}), 400
            file_type = 'image'
        
        if post_type == 'document':
            if ext not in app.config['ALLOWED_DOC_EXTENSIONS']:
                return jsonify({"error": f"Invalid document format. Allowed: {', '.join(app.config['ALLOWED_DOC_EXTENSIONS'])}"}), 400
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


@app.route("/api/posts/<int:post_id>/download")
def download_post_attachment(post_id):
    """Download post attachment with original filename"""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    post = db.session.get(Post, post_id)
    if not post or not post.file_path:
        abort(404)

    # Construct absolute path
    file_path = os.path.join(app.root_path, 'static', post.file_path)
    
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    
    clean_name = get_clean_filename(post.file_path)
    
    return send_file(
        file_path,
        as_attachment=True,
        download_name=clean_name
    )


@app.route("/api/posts/<int:post_id>/like", methods=["POST"])
def toggle_like(post_id):
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



@app.route("/api/posts/<int:post_id>/comments")
def get_comments(post_id):
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



@app.route("/api/posts/<int:post_id>/comments", methods=["POST"])
def add_comment(post_id):
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

    return jsonify({"message": "Comment added"}), 201


# --------------------------------------------------
# EVENTS API
# --------------------------------------------------

@app.route("/api/events")
def get_events():
    """Get all upcoming events with user registration status"""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    # Get all upcoming events
    events = Event.query.filter(
        Event.event_date >= datetime.now(timezone.utc)
    ).order_by(Event.event_date.asc()).all()
    
    events_data = []
    for event in events:
        # Check user's registration status
        registration = EventRegistration.query.filter_by(
            event_id=event.id,
            user_id=user_id
        ).first()
        
        events_data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "eventDate": event.event_date.isoformat(),
            "totalSeats": event.total_seats,
            "availableSeats": event.available_seats,
            "goingCount": event.going_count,
            "interestedCount": event.interested_count,
            "userStatus": registration.status if registration else None,
            "month": event.event_date.strftime("%b").upper(),
            "day": event.event_date.day,
            "time": event.event_date.strftime("%I:%M %p"),
            "dateTime": event.event_date.strftime("%B %d, %Y at %I:%M %p")
        })
    
    return jsonify(events_data)


@app.route("/api/events/<int:event_id>/register", methods=["POST"])
def register_for_event(event_id):
    """Register for an event (Going or Interested)"""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    data = request.json
    status = data.get("status")  # 'going' or 'interested'
    
    if status not in ['going', 'interested']:
        return jsonify({"error": "Invalid status. Must be 'going' or 'interested'"}), 400
    
    # HARDENING: Use with_for_update() to lock the event row.
    # This prevents race conditions where two users join the last seat simultaneously.
    # 1. Single locked query
    event = db.session.query(Event).with_for_update().filter_by(id=event_id).first()
    
    # 2. Null check immediately
    if not event:
        return jsonify({"error": "Event not found"}), 404
    
    # 3. Cancellation check
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
                # Optimization: Check seats efficiently without triggering extra queries if possible
                # event.available_seats triggers a query. We can do it manually or use the property.
                # Since we are inside a lock, we must be careful.
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
    
    # Calculate final counts for response
    # We query these to ensure accuracy after the transaction
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


@app.route("/api/announcements", methods=["GET"])
def get_announcements():
    """Get announcements for students and admin"""
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

# --------------------------------------------------
# DEVELOPMENT ROUTES
# --------------------------------------------------

@app.route("/dev/seed-post")
def seed_post():
    user = User.query.first()

    if not user:
        return "No users found. Signup first.", 400

    post = Post(
        user_id=user.id,
        caption="First post on Campus Connect 🚀",
        image_url="https://picsum.photos/600"
    )

    db.session.add(post)
    db.session.commit()

    return "Post created successfully"


@app.route("/dev/seed-events")
def seed_events():
    """Development route to seed sample events"""
    user = User.query.first()
    if not user:
        return "No users found. Signup first.", 400
    
    from datetime import timedelta
    
    # Clear existing events
    Event.query.delete()
    
    events = [
        Event(
            title="Tech Career Fair 2024",
            description="Meet top tech companies and explore internship opportunities. Leading tech giants will be present!",
            location="Main Auditorium",
            event_date=datetime.now(timezone.utc) + timedelta(days=1),
            total_seats=200,
            user_id=user.id
        ),
        Event(
            title="Hackathon 2024",
            description="48-hour coding marathon. Build innovative solutions and win amazing prizes!",
            location="CS Lab Building",
            event_date=datetime.now(timezone.utc) + timedelta(days=7),
            total_seats=100,
            user_id=user.id
        ),
        Event(
            title="Guest Lecture: AI & ML",
            description="Industry expert discusses latest trends in artificial intelligence and machine learning",
            location="Seminar Hall 3",
            event_date=datetime.now(timezone.utc) + timedelta(days=14),
            total_seats=150,
            user_id=user.id
        ),
        Event(
            title="Campus Placement Drive",
            description="Multiple companies conducting interviews. Dress formally!",
            location="Conference Room A",
            event_date=datetime.now(timezone.utc) + timedelta(days=21),
            total_seats=80,
            user_id=user.id
        ),
        Event(
            title="Workshop: Web Development",
            description="Hands-on workshop covering modern web technologies - React, Node.js, and more",
            location="Computer Lab 2",
            event_date=datetime.now(timezone.utc) + timedelta(days=10),
            total_seats=50,
            user_id=user.id
        )
    ]
    
    for event in events:
        db.session.add(event)
    
    db.session.commit()
    return f"Successfully seeded {len(events)} events!"


@app.route("/dev/reset-registrations")
def reset_registrations():
    """Development route to reset all event registrations"""
    EventRegistration.query.delete()
    db.session.commit()
    return "All event registrations have been reset!"


@app.route("/api/suggestions", methods=["GET"])
def get_suggestions():
    """Get user suggestions - exclude connected users and pending requests"""
    
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user_id = session["user_id"]
    current_user = db.session.get(User, current_user_id)
    
    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    # Step 1: Get connected user IDs (bidirectional check)
    connected_ids = current_user.get_connection_ids()
    
    # Step 2: Get pending request user IDs (both sent and received)
    pending_sent = [r.receiver_id for r in ConnectionRequest.query.filter_by(
        sender_id=current_user_id, 
        status='pending'
    ).all()]
    
    pending_received = [r.sender_id for r in ConnectionRequest.query.filter_by(
        receiver_id=current_user_id, 
        status='pending'
    ).all()]
    
    # Step 3: Combine all exclusions
    exclude_ids = set(connected_ids + pending_sent + pending_received + [current_user_id])
    
    # Step 4: Query suggestions (prioritize same university/major)
    suggestions = []
    
    # Priority 1: Same university + same major
    suggestions = User.query.filter(
        User.id.notin_(exclude_ids),
        User.account_type != 'admin',
        User.university == current_user.university,
        User.major == current_user.major
    ).limit(5).all()
    
    # Priority 2: If not enough, add same university (any major)
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions]),
            User.university == current_user.university
        ).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Priority 3: If still not enough, add anyone else
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions])
        ).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Step 5: Format response
    result = []
    for user in suggestions:
        result.append({
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "university": user.university,
            "major": user.major,
            "batch": user.batch,
            "profile_picture": getattr(user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={user.full_name}"
        })
    
    return jsonify({"suggestions": result})


@app.route("/api/connections/request", methods=["POST"])
def send_connection_request():
    """Send a connection request to another user"""
    
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.get_json()
    receiver_id = data.get("receiver_id")
    
    if not receiver_id:
        return jsonify({"error": "Receiver ID required"}), 400
    
    sender_id = session["user_id"]
    
    # Can't send request to yourself
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


@app.route("/api/connections/accept/<int:request_id>", methods=["POST"])
def accept_connection_request(request_id):
    """Accept a connection request"""
    
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


@app.route("/api/connections/reject/<int:request_id>", methods=["POST"])
def reject_connection_request(request_id):
    """Reject a connection request"""
    
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


@app.route("/api/connections/pending", methods=["GET"])
def get_pending_requests():
    """Get pending connection requests for current user"""
    
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
                    "profile_picture": getattr(sender, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={sender.full_name}"
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})


@app.route("/api/connections/sent", methods=["GET"])
def get_sent_requests():
    """Get connection requests sent by current user"""
    
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
                    "profile_picture": getattr(receiver, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={receiver.full_name}"
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})


@app.route("/api/connections/<int:user_id>", methods=["DELETE"])
def remove_connection(user_id):
    """Remove a connection with another user"""
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


@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    """Get notifications for current user"""
    
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
                    "profile_picture": getattr(actor_user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={actor_user.full_name}"
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


@app.route("/api/notifications/unread-count", methods=["GET"])
def get_unread_count():
    """Get count of unread notifications"""
    
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({"count": unread_count})


@app.route("/api/connections/list", methods=["GET"])
def get_connections_list():
    """Get list of all connections for current user"""
    
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
                "profile_picture": getattr(other_user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={other_user.full_name}",
                "connected_since": conn.connected_at.strftime("%B %Y")
            })
    
    return jsonify({"connections": result, "count": len(result)})


@app.route("/api/notifications/mark-read/<int:notification_id>", methods=["POST"])
def mark_notification_read(notification_id):
    """Mark a single notification as read"""
    
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


@app.route("/api/notifications/mark-all-read", methods=["POST"])
def mark_all_notifications_read():
    """Mark all notifications as read"""
    
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).update({"is_read": True})
    
    db.session.commit()
    
    return jsonify({"success": True})


@app.route("/api/notifications/clear", methods=["POST"])
def clear_notifications():
    """Delete all notifications for the current user"""
    
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_id = session["user_id"]
    
    Notification.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    
    return jsonify({"success": True})


@app.route("/api/profile/completion", methods=["GET"])
def get_profile_completion():
    """Calculate profile completion percentage and missing fields"""
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


@app.route("/api/profile/me", methods=["GET"])
def get_my_profile():
    """Get current user's profile with real counts"""
    
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
        "profile_picture": getattr(user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={user.full_name}",
        "university": user.university,
        "major": user.major,
        "batch": user.batch,
        "stats": {
            "posts": post_count,
            "connections": connection_count
        }
    })



@app.route("/api/profile/<int:user_id>/posts")
def api_profile_posts(user_id):
    """Get posts for a specific user's profile - same format as /api/posts"""
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

    formatted_db_posts = []

    for post, user, likes_count, comments_count in db_posts:
        is_liked = Like.query.filter_by(
            post_id=post.id,
            user_id=session["user_id"]
        ).first() is not None

        formatted_db_posts.append({
            "id": post.id,
            "user_id": post.user_id,
            "username": user.full_name,
            "profileImage": f"https://ui-avatars.com/api/?name={user.full_name}",
            "postImages": [f"/static/{post.file_path}"] if post.file_path else ([post.image_url] if post.image_url else []),
            "currentImageIndex": 0,
            "caption": post.caption,
            "accountType": "student",
            "collegeName": user.major,
            "likesCount": likes_count,
            "commentsCount": comments_count,
            "comments": [],
            "isLiked": is_liked,
            "createdAt": post.created_at.isoformat(),
            "file_path": post.file_path,
            "file_type": post.file_type,
            "image_url": f"/static/{post.file_path}" if post.file_path else post.image_url,
            "original_filename": get_clean_filename(post.file_path)
        })

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": formatted_db_posts
    })


@app.route("/api/profile/<int:user_id>", methods=["GET"])
def get_profile_data(user_id):
    """Get profile data as JSON (for JavaScript to consume)"""

    # TEMPORARY: Allow viewing without login for testing
    # if "user_id" not in session:
    #     return jsonify({"error": "Unauthorized"}), 401

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

    if not is_own_profile and current_user_id:  # Only check connections if logged in
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
    elif not current_user_id:
        # Not logged in - show as not connected
        connection_status = 'not_connected'

    # Get connection count and list
    connections_query = Connection.query.filter(
        or_(
            Connection.user_id == user_id,
            Connection.connected_user_id == user_id
        )
    )
    connection_count = connections_query.count()
    
    # Get counts for other tabs (only if own profile)
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
        # Suggestions count is dynamic/expensive, usually fetched on demand or estimated

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
                'profile_picture': getattr(other_user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={other_user.full_name}",
                'connected_since': conn.connected_at.strftime('%B %Y')
            })

    # Get mutual connections (if not own profile)
    mutual_connections = []
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
        for mutual_id in mutual_ids:
            mutual_user = db.session.get(User, mutual_id)
            if mutual_user:
                mutual_connections.append({
                    'id': mutual_user.id,
                    'full_name': mutual_user.full_name,
                    'major': mutual_user.major,
                    'profile_picture': getattr(mutual_user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={mutual_user.full_name}"
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

    # Return all data as JSON
    return jsonify({
        'user': {
            'id': profile_user.id,
            'full_name': profile_user.full_name,
            'email': profile_user.email,
            'university': profile_user.university,
            'major': profile_user.major,
            'batch': profile_user.batch,
            'bio': getattr(profile_user, 'bio', None),
            'profile_picture': getattr(profile_user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={profile_user.full_name}",
            'member_since': profile_user.created_at.strftime('%B %Y')
        },
        'is_own_profile': is_own_profile,
        'connection_status': connection_status,
        'pending_request_id': pending_request_id,
        'stats': {
            'connections_count': connection_count,
            'posts_count': post_count,
            'received_count': received_count,
            'sent_count': sent_count
        },
        'posts': posts_data,
        'connections': connections_data,
        'mutual_connections': mutual_connections,
        'skills': skills_data,  # ← NEW
        'experiences': experiences_data,  # ← NEW
        'educations': educations_data  # ← NEW
    })


@app.route("/api/profile/photo", methods=["POST"])
def upload_profile_photo():
    """Upload and update user profile photo"""
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
    upload_folder = os.path.join(app.root_path, 'static/uploads/profile_photos')
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


# --------------------------------------------------
# PROFILE MANAGEMENT API
# --------------------------------------------------

@app.route("/api/profile/skills", methods=["GET", "POST", "PUT", "DELETE"])
def manage_skills():
    """Manage user skills"""
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


@app.route("/api/profile/experiences", methods=["GET", "POST", "PUT", "DELETE"])
def manage_experiences():
    """Manage user experiences"""
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


@app.route("/api/profile/educations", methods=["GET", "POST", "PUT", "DELETE"])
def manage_educations():
    """Manage user educations"""
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


@app.route("/api/profile/bio", methods=["PUT"])
def update_bio():
    """Update user bio"""
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


# --------------------------------------------------
# ADMIN ROUTES - USER MANAGEMENT & EVENT CREATION
# --------------------------------------------------

@app.route("/admin/api/dashboard/overview", methods=["GET"])
def admin_dashboard_overview():
    """
    STEP 5: Admin Dashboard Aggregation API
    
    Returns comprehensive analytics for admin dashboard:
    - KPI counts (users, posts, events)
    - User role distribution
    - User growth over time
    - Content activity metrics
    - Top content creators
    - System health status
    """
    admin_required()
    
    try:
        # ================================================================
        # A) KPI COUNTS
        # ================================================================
        total_users = User.query.count()
        active_users = User.query.filter_by(is_active=True).count()
        blocked_users = User.query.filter_by(is_active=False).count()
        official_users = User.query.filter_by(account_type="official").count()
        total_posts = Post.query.count()
        active_events = Event.get_active_count()
        total_official_and_club = User.query.filter(
            User.account_type.in_(["official", "club"])
        ).count()
        
        # ================================================================
        # B) USER ROLE DISTRIBUTION
        # ================================================================
        # Group users by account_type and count
        # Ensure we map to keys expected by frontend if needed, or use strict role names
        role_distribution_query = db.session.query(
            User.account_type,
            func.count(User.id).label('count')
        ).group_by(User.account_type).all()
        
        role_distribution = {
            role: count for role, count in role_distribution_query
        }
        
        # ================================================================
        # C) USER GROWTH DATA
        # ================================================================
        # Group users by registration date (daily)
        user_growth_query = db.session.query(
            func.date(User.created_at).label('date'),
            func.count(User.id).label('count')
        ).group_by(func.date(User.created_at)).order_by(func.date(User.created_at)).all()
        
        user_growth = [
            {
                "month": datetime.strptime(str(date), '%Y-%m-%d').strftime('%b'),
                "users": count
            }
            for date, count in user_growth_query
        ]
        
        # ================================================================
        # D) CONTENT ACTIVITY
        # ================================================================
        
        content_activity = get_content_activity()
        
        # ================================================================
        # E) TOP OFFICIAL/CLUB ACCOUNTS BY EVENTS CREATED
        # ================================================================
        # Get users with account_type in ['official', 'club']
        # Count their events and sort by count descending
        top_creators_query = db.session.query(
            User.id,
            User.first_name,
            User.last_name,
            User.email,
            User.account_type,
            func.count(Event.id).label('events_count')
        ).join(
            Event, User.id == Event.user_id, isouter=True
        ).filter(
            User.account_type.in_(["official", "club"])
        ).group_by(
            User.id, User.first_name, User.last_name, User.email, User.account_type
        ).order_by(
            func.count(Event.id).desc()
        ).limit(10).all()
        
        top_creators = [
            {
                "id": user_id,
                "name": f"{first_name} {last_name}",
                "type": account_type.capitalize(), # Frontend expects capitalized or specific format
                "followers": events_count # Mapping events count to 'followers' for frontend compatibility
            }
            for user_id, first_name, last_name, email, account_type, events_count 
            in top_creators_query
        ]
        
        # ================================================================
        # FINAL RESPONSE
        # ================================================================
        return jsonify({
            "totalUsers": total_users,
            "activeUsers": active_users,
            "officialUsers": official_users,
            "blockedUsers": blocked_users,
            "totalPosts": total_posts,
            "activeEvents": active_events,
            "roleDistribution": role_distribution,
            "userGrowth": user_growth,
            "contentActivity": content_activity,
            "topAccounts": top_creators
        }), 200
        
    except Exception as e:
        # Return error but still indicate API is online
        return jsonify({
            "error": "Failed to fetch dashboard data",
            "message": str(e),
            "system_health": {
                "api": "online",
                "database": "error"
            }
        }), 500


@app.route("/admin/api/users", methods=["GET"])
def admin_get_users():
    """
    STEP 3.1: Get list of all users for admin management.
    
    Returns:
        - id: User ID
        - username: User's full name
        - email: User's email
        - account_type: student/admin/official/club
        - is_active: Whether user can login
    """
    admin_required()
    
    users = User.query.all()
    
    return jsonify([{
        "id": user.id,
        "username": user.full_name,
        "email": user.email,
        "role": user.account_type, # Frontend expects 'role'
        "status": "active" if user.is_active else "blocked", # Frontend expects 'status' string
        "joinDate": user.created_at.strftime('%Y-%m-%d')
    } for user in users]), 200


@app.route("/admin/api/users/<int:user_id>/toggle", methods=["POST"])
def admin_toggle_user_status(user_id):
    """
    STEP 3.2: Toggle user's is_active status.
    
    Rules:
        - Admin cannot disable themselves
        - Action is logged in AdminLog
    
    Returns:
        - Updated user status
    """
    admin_required()
    
    # Prevent admin from disabling themselves
    if user_id == session["user_id"]:
        return jsonify({"error": "You cannot disable your own account"}), 403
    
    user = db.session.get(User, user_id)
    if not user:
        abort(404)
    
    # Toggle the is_active status
    old_status = user.is_active
    user.is_active = not user.is_active
    
    # Log the action
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="toggle_user",
        target_user_id=user_id,
        details=f"Changed is_active from {old_status} to {user.is_active}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "status": "active" if user.is_active else "blocked"
        }
    }), 200


@app.route("/admin/api/events/meta", methods=["GET"])
def admin_get_event_creators():
    """
    STEP 4.1: Get list of users who can be event creators.
    
    Returns:
        - Users with account_type = 'official' or 'club'
        - These are the users admin can create events on behalf of
    """
    admin_required()
    
    eligible_users = User.query.filter(
        User.account_type.in_(["official", "club"])
    ).all()
    
    return jsonify({
        "eventTypes": ["official", "club"],
        "targetEntities": [{
            "id": user.id,
            "name": user.full_name,
            "type": user.account_type
        } for user in eligible_users]
    }), 200


@app.route("/admin/api/events/create", methods=["POST"])
def admin_create_event():
    """
    STEP 4.2: Admin creates event on behalf of another user.
    """
    admin_required()
    
    data = request.json
    
    # Validate required fields
    # Frontend sends 'targetEntity' as ID
    # Fallback to current admin if not provided (Option B)
    target_user_id = data.get("targetEntity")
    if not target_user_id:
        target_user_id = session["user_id"]
    
    # Verify target user exists and has correct account type
    target_user = db.session.get(User, target_user_id)
    if not target_user:
        return jsonify({"error": "Target user not found"}), 404
    
    if target_user.account_type not in ["official", "club", "admin"]:
        return jsonify({"error": "Target user must be official, club, or admin"}), 400
    
    # Parse event_date
    # Fix: Use event_date directly (simplified logic)
    try:
        event_date_str = data.get("event_date")
        if not event_date_str:
            return jsonify({"error": "Event date required"}), 400
        
        # Handle ISO format
        dt = datetime.fromisoformat(event_date_str.replace('Z', '+00:00'))
        event_date = dt.astimezone(timezone.utc)
    except (ValueError, AttributeError):
        return jsonify({"error": "Invalid event_date format."}), 400
    
    # Create event with target_user_id as the owner
    event = Event(
        title=data.get("title").strip(),
        description=data.get("description").strip(),
        location=data.get("location").strip(),
        event_date=event_date,
        total_seats=int(data.get("total_seats", 100)),
        user_id=target_user_id  # Event owner is the target user, NOT the admin
    )
    
    db.session.add(event)
    db.session.flush()  # Get event.id before commit
    
    # Log the admin action
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="create_event",
        target_user_id=target_user_id,
        target_event_id=event.id,
        details=f"Created event '{event.title}' on behalf of {target_user.full_name}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "event": {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "event_date": event.event_date.isoformat(),
            "total_seats": event.total_seats,
            "owner_id": event.user_id,
            "owner_name": target_user.full_name
        }
    }), 201


@app.route("/admin/api/announcements", methods=["GET"])
def admin_get_announcements():
    admin_required()
    status = request.args.get("status", "active")
    
    # Fetch based on status (active or deleted)
    announcements = Announcement.query.filter_by(status=status).order_by(Announcement.created_at.desc()).all()
    
    announcements_data = []
    for ann in announcements:
        announcements_data.append({
            "id": ann.id,
            "title": ann.title,
            "content": ann.content,
            "date": ann.created_at.strftime("%d %b %Y, %I:%M %p"),
            "author": ann.author.full_name if ann.author else "Admin",
            "updated_at": ann.updated_at.strftime("%d %b %Y, %I:%M %p") if ann.updated_at else None,
            "status": ann.status
        })
    
    return jsonify(announcements_data)

@app.route("/admin/api/announcements", methods=["POST"])
def admin_create_announcement():
    admin_required()
    data = request.json
    title = data.get("title")
    content = data.get("content")
    
    if not title or not content:
        return jsonify({"error": "Title and content required"}), 400
    
    # Create Announcement
    announcement = Announcement(
        title=title,
        content=content,
        author_id=session["user_id"]
    )
    db.session.add(announcement)
    
    # Log action (Audit trail)
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="create_announcement",
        details=f"Created announcement: {title}"
    )
    db.session.add(log)
    
    db.session.commit()
    return jsonify({ "success": True, "message": "Announcement created" }), 201

@app.route("/admin/api/announcements/<int:id>", methods=["PUT"])
def admin_update_announcement(id):
    admin_required()
    data = request.json
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    if "title" in data:
        announcement.title = data["title"]
    if "content" in data:
        announcement.content = data["content"]
        
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement updated"})

@app.route("/admin/api/announcements/<int:id>", methods=["DELETE"])
def admin_delete_announcement(id):
    admin_required()
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    # Soft delete
    announcement.status = 'deleted'
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement moved to recycle bin"})

@app.route("/admin/api/announcements/<int:id>/restore", methods=["POST"])
def admin_restore_announcement(id):
    admin_required()
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    # Restore
    announcement.status = 'active'
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement restored"})

@app.route("/admin/api/logs", methods=["GET"])
def admin_get_logs():
    admin_required()
    logs = AdminLog.query.order_by(AdminLog.created_at.desc()).limit(50).all()
    return jsonify([{
        "id": log.id,
        "action": log.action_type.replace('_', ' ').title(),
        "target": log.target_user.full_name if log.target_user else "System",
        "admin": log.admin.email if log.admin else "Unknown",
        "timestamp": log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        "ip": request.remote_addr or "127.0.0.1"
    } for log in logs]), 200

@app.route("/admin/api/logs/download", methods=["GET"])
def admin_download_logs():
    """Download logs as a text file"""
    admin_required()
    
    logs = AdminLog.query.order_by(AdminLog.created_at.desc()).all()
    
    # Generate text content
    content = "CAMPUS CONNECT - ADMIN LOGS\n"
    content += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    content += "=" * 80 + "\n\n"
    
    for log in logs:
        timestamp = log.created_at.strftime('%Y-%m-%d %H:%M:%S')
        action = log.action_type.replace('_', ' ').upper()
        details = log.details
        content += f"[{timestamp}] {action}: {details}\n"
    
    from flask import Response
    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment;filename=admin_logs.txt"}
    )


def seed_admin():
    admin = User.query.filter_by(account_type="admin").first()
    if admin:
        return

    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")

    if not email or not password:
        return

    admin = User(
        first_name="Admin",
        last_name="User",
        email=email,
        password_hash=bcrypt.generate_password_hash(password),
        university="Campus Connect University",
        major="Administration",
        batch="N/A",
        account_type="admin",
        is_active=True
    )

    db.session.add(admin)
    db.session.commit()
    print("✅ Default admin created")

# --------------------------------------------------
# ADMIN EVENT MANAGEMENT ROUTES (TASK 1)
# --------------------------------------------------

@app.route("/admin/api/events/list")
def admin_get_events_list():
    admin_required()
    status = request.args.get("status", "upcoming")
    now = datetime.now(timezone.utc)
    
    if status == "past":
        events = Event.query.filter(Event.event_date < now).order_by(Event.event_date.desc()).all()
    else:
        events = Event.query.filter(Event.event_date >= now).order_by(Event.event_date.asc()).all()
        
    return jsonify([_format_admin_event(e) for e in events])

def _format_admin_event(event):
    dt_iso = event.event_date.isoformat()
    if event.event_date.tzinfo is None:
        dt_iso += "Z"
    return {
        "id": event.id,
        "title": event.title,
        "date": dt_iso,
        "location": event.location,
        "description": event.description,
        "total_seats": event.total_seats,
        "interested_count": event.interested_count,
        "going_count": event.going_count,
        "is_past": event.event_date < datetime.now(timezone.utc)
    }

@app.route("/admin/api/events/<int:event_id>", methods=["PUT"])
def admin_update_event(event_id):
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    # Prevent editing past events
    if event.event_date < datetime.now(timezone.utc):
        return jsonify({"error": "Cannot edit past events"}), 400
        
    data = request.json
    
    if "title" in data: event.title = data["title"]
    if "description" in data: event.description = data["description"]
    if "location" in data: event.location = data["location"]
    if "total_seats" in data: event.total_seats = int(data["total_seats"])
    
    if "event_date" in data:
        try:
            dt_str = data["event_date"]
            if 'Z' not in dt_str and '+' not in dt_str:
                return jsonify({"error": "UTC Datetime required"}), 400
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            event.event_date = dt.astimezone(timezone.utc)
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400
            
    db.session.commit()
    return jsonify({"success": True, "message": "Event updated successfully"})

@app.route("/admin/api/users/<int:user_id>/details")
def admin_get_user_details(user_id):
    """
    STEP 3.3: Get full details for a specific user (Admin only)
    """
    admin_required()
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Get counts efficiently
    posts_count = Post.query.filter_by(user_id=user_id).count()
    
    # Connections (bidirectional)
    connections_count = Connection.query.filter(
        or_(
            Connection.user_id == user_id,
            Connection.connected_user_id == user_id
        )
    ).count()
    
    return jsonify({
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.account_type,
        "status": "active" if user.is_active else "blocked",
        "university": user.university,
        "major": user.major,
        "batch": user.batch,
        "profile_picture": getattr(user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={user.full_name}",
        "joined_date": user.created_at.strftime('%B %d, %Y'),
        "stats": {
            "posts": posts_count,
            "connections": connections_count
        }
    })

@app.route("/admin/api/events/<int:event_id>/participants")
def admin_get_event_participants(event_id):
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    # Get only 'going' participants
    participants = (
        db.session.query(User)
        .join(EventRegistration)
        .filter(
            EventRegistration.event_id == event_id,
            EventRegistration.status == 'going'
        )
        .all()
    )
    
    return jsonify([{
        "name": u.full_name,
        "email": u.email,
        "college": u.university,
        "department": u.major
    } for u in participants])

@app.route("/admin/api/events/<int:event_id>/download")
def admin_download_event_pdf(event_id):
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    participants = db.session.query(User).join(EventRegistration).filter(
        EventRegistration.event_id == event_id, EventRegistration.status == 'going'
    ).all()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    elements.append(Paragraph(f"Event Report: {event.title}", styles['Title']))
    elements.append(Spacer(1, 12))
    
    details = [
        f"<b>Date:</b> {event.event_date.strftime('%Y-%m-%d %H:%M')}",
        f"<b>Location:</b> {event.location}",
        f"<b>Participated:</b> {event.going_count} | <b>Interested:</b> {event.interested_count}"
    ]
    for d in details:
        elements.append(Paragraph(d, styles['Normal']))
        elements.append(Spacer(1, 6))
        
    elements.append(Spacer(1, 20))
    
    if participants:
        data = [['Name', 'Email', 'University', 'Major']] + [[p.full_name, p.email, p.university, p.major] for p in participants]
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No participants yet.", styles['Normal']))
        
    doc.build(elements)
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"event_{event_id}.pdf", mimetype='application/pdf')

# --------------------------------------------------
# SEARCH API
# --------------------------------------------------

@app.route("/api/search", methods=["GET"])
def search_all():
    """
    Global search endpoint.
    Searches Users, Posts, and Announcements.
    """
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
        User.is_active == True
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
            "profile_picture": getattr(u, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={u.full_name}"
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

# --------------------------------------------------
# APP ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_admin()
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)