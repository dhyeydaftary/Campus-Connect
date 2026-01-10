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
def signup():
    return render_template("signup.html")

# Home / Feed (placeholder for now)
@app.route("/home")
def home():
    return "<h1>Home Feed (Coming Soon)</h1>"

if __name__ == "__main__":
    app.run(debug=True)
