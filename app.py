from flask import Flask, render_template, request, jsonify
from config import Config
from models import db, bcrypt, User

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt.init_app(app)

# --- PAGE ROUTES (HTML) ---
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/signup")
def signup_page():
    return render_template("signup.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/feed")
def feed_page():
    return render_template("feed.html")

# --- API ROUTES (JSON) ---
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.json
    
    # Validation
    required_fields = ["full_name", "email", "password", "branch", "batch"]
    if not all(k in data for k in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "User already exists"}), 409

    try:
        # Using the helper method from models.py
        new_user = User.create_from_json(data)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # Generates the tables in Postgres
    app.run(debug=True) 