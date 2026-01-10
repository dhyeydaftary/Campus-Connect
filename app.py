from flask import Flask, render_template

app = Flask(__name__)

# Landing Page
@app.route("/")
def landing():
    return render_template("index.html")

# Login Page
@app.route("/login")
def login():
    return render_template("login.html")

# Signup / Register Page
@app.route("/signup")
@app.route("/register")
def signup():
    return render_template("signup.html")

# Feed Page
@app.route("/feed")
@app.route("/home")  # alias
def feed():
    return render_template("feed.html")

# Profile Page
@app.route("/profile")
def profile():
    return render_template("profile.html")

if __name__ == "__main__":
    app.run(debug=True)
