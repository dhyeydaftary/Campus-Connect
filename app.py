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
from models import db, bcrypt, User

app = Flask(__name__)
app.config.from_object(Config)

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
    return render_template("index.html")


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

    required_fields = ["full_name", "email", "password", "branch", "batch"]
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

    return jsonify({"message": "Login successful"}), 200

# --------------------------------------------------
# APP ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
