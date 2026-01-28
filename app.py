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
from models import db, bcrypt, User, Post, Like, Comment
import random

app = Flask(__name__)
app.config.from_object(Config)


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
# CONFIG
# --------------------------------------------------

# Required for session management
app.config["SECRET_KEY"] = "campus-connect-secret-key-change-later"

db.init_app(app)
bcrypt.init_app(app)

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


@app.route("/feed")
def feed_page():
    # Protect feed route
    if "user_id" not in session:
        return redirect(url_for("login_page"))

    return render_template(
        "feed.html",
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

    db_posts = (
        db.session.query(Post, User)
        .join(User, Post.user_id == User.id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


    formatted_db_posts = []

    for post, user in db_posts:

        likes_count = Like.query.filter_by(post_id=post.id).count()
        is_liked = Like.query.filter_by(
            post_id=post.id,
            user_id=session["user_id"]
        ).first() is not None

        comments_count = Comment.query.filter_by(post_id=post.id).count()

        formatted_db_posts.append({
            "id": post.id,
            "username": user.full_name,
            "profileImage": f"https://ui-avatars.com/api/?name={user.full_name}",
            "postImages": [post.image_url],
            "currentImageIndex": 0,
            "caption": post.caption,
            "accountType": "student",
            "collegeName": user.branch,
            "likesCount": likes_count,
            "commentsCount": comments_count,
            "comments": [],
            "isLiked": is_liked,
            "createdAt": post.created_at.isoformat() + "Z"
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

# --------------------------------------------------
# APP ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
