from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for
)

from config import Config
from models import db, bcrypt, User, Post, Like, Comment, Event, EventRegistration
from sqlalchemy import func
import random
from werkzeug.utils import secure_filename
import os
from datetime import datetime

# --------------------------------------------------
# CREATE APP & LOAD CONFIGURATION
# --------------------------------------------------

app = Flask(__name__)
app.config.from_object(Config)  # This loads ALL config from config.py

# Initialize extensions
db.init_app(app)
bcrypt.init_app(app)

# --------------------------------------------------
# FAKE POSTS DATA
# --------------------------------------------------

FAKE_POSTS = [
    {
        "id": None,
        "isFake": True,
        "username": "Campus Club",
        "profileImage": "https://ui-avatars.com/api/?name=Campus+Club",
        "postImages": [f"https://picsum.photos/600?seed={random.randint(1,9999)}"],
        "currentImageIndex": 0,
        "caption": "Hackathon registrations open 🚀",
        "accountType": "club",
        "collegeName": "CSE",
        "likesCount": random.randint(10, 500),
        "commentsCount": random.randint(1, 20),
        "comments": [],
        "isLiked": False,
        "timestamp": "Just now"
    },
    {
        "id": None,
        "isFake": True,
        "username": "Dhruv Patel",
        "profileImage": "https://ui-avatars.com/api/?name=Dhruv+Patel",
        "postImages": [f"https://picsum.photos/600?seed={random.randint(1,9999)}"],
        "currentImageIndex": 0,
        "caption": "Late night coding hits different 💻",
        "accountType": "student",
        "collegeName": "IT",
        "likesCount": random.randint(10, 500),
        "commentsCount": random.randint(1, 20),
        "comments": [],
        "isLiked": False,
        "timestamp": "5 min ago"
    },
    {
        "id": None,
        "isFake": True,
        "username": "Placement Cell",
        "profileImage": "https://ui-avatars.com/api/?name=Placement+Cell",
        "postImages": [f"https://picsum.photos/600?seed={random.randint(1,9999)}"],
        "currentImageIndex": 0,
        "caption": "Amazon internship shortlist released",
        "accountType": "official",
        "collegeName": "Admin",
        "likesCount": random.randint(100, 1000),
        "commentsCount": random.randint(10, 50),
        "comments": [],
        "isLiked": False,
        "timestamp": "1 hr ago"
    }
]

# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

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
    
    upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'images' if file_type == 'image' else 'documents')
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)
    
    return file_path.replace('static/', '')


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

    return render_template(
        "home.html",
        user_name=session.get("user_name")
    )


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))

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

    # Create session
    session["user_id"] = user.id
    session["user_name"] = user.full_name

    return jsonify({
        "message": "Login successful",
        "user_name": user.full_name
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
            "createdAt": post.created_at.isoformat() + "Z",
            "file_path": post.file_path,
            "file_type": post.file_type,
            "image_url": f"/static/{post.file_path}" if post.file_path else post.image_url
        })

    # Combine DB posts with ALL Fake posts
    combined = formatted_db_posts + FAKE_POSTS
    
    # Shuffle the entire list so DB posts don't always appear first
    # if page == 1:
    #     random.shuffle(combined)

    if page == 1:
        combined = formatted_db_posts + FAKE_POSTS
    else:
        combined = formatted_db_posts

    return jsonify({
        "viewer": {
            "id": session.get("user_id"),
            "name": session.get("user_name")
        },
        "posts": combined
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
        db.session.commit()
        liked = False
    else:
        like = Like(user_id=user_id, post_id=post_id)
        db.session.add(like)
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
            "createdAt": comment.created_at.isoformat() + "Z"
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
        Event.event_date >= datetime.utcnow()
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
            "day": event.event_date.strftime("%d"),
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
    
    event = Event.query.get(event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    
    # Check existing registration
    existing = EventRegistration.query.filter_by(
        event_id=event_id,
        user_id=user_id
    ).first()
    
    if existing:
        # User wants to change status
        if existing.status == status:
            # Same status - remove registration (toggle off)
            db.session.delete(existing)
            db.session.commit()
            
            return jsonify({
                "message": "Registration cancelled",
                "userStatus": None,
                "availableSeats": event.available_seats,
                "goingCount": event.going_count,
                "interestedCount": event.interested_count
            })
        else:
            # Different status - update
            # If changing from interested to going, check seats
            if status == 'going' and event.available_seats <= 0:
                return jsonify({"error": "No seats available"}), 400
            
            existing.status = status
            db.session.commit()
            
            return jsonify({
                "message": f"Status updated to {status}",
                "userStatus": status,
                "availableSeats": event.available_seats,
                "goingCount": event.going_count,
                "interestedCount": event.interested_count
            })
    
    # New registration
    if status == 'going' and event.available_seats <= 0:
        return jsonify({"error": "No seats available"}), 400
    
    registration = EventRegistration(
        event_id=event_id,
        user_id=user_id,
        status=status
    )
    
    db.session.add(registration)
    db.session.commit()
    
    return jsonify({
        "message": f"Registered as {status}",
        "userStatus": status,
        "availableSeats": event.available_seats,
        "goingCount": event.going_count,
        "interestedCount": event.interested_count
    }), 201


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
            event_date=datetime.utcnow() + timedelta(days=1),
            total_seats=200,
            user_id=user.id
        ),
        Event(
            title="Hackathon 2024",
            description="48-hour coding marathon. Build innovative solutions and win amazing prizes!",
            location="CS Lab Building",
            event_date=datetime.utcnow() + timedelta(days=7),
            total_seats=100,
            user_id=user.id
        ),
        Event(
            title="Guest Lecture: AI & ML",
            description="Industry expert discusses latest trends in artificial intelligence and machine learning",
            location="Seminar Hall 3",
            event_date=datetime.utcnow() + timedelta(days=14),
            total_seats=150,
            user_id=user.id
        ),
        Event(
            title="Campus Placement Drive",
            description="Multiple companies conducting interviews. Dress formally!",
            location="Conference Room A",
            event_date=datetime.utcnow() + timedelta(days=21),
            total_seats=80,
            user_id=user.id
        ),
        Event(
            title="Workshop: Web Development",
            description="Hands-on workshop covering modern web technologies - React, Node.js, and more",
            location="Computer Lab 2",
            event_date=datetime.utcnow() + timedelta(days=10),
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


# --------------------------------------------------
# APP ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
