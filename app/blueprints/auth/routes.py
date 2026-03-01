"""
Auth Blueprint — Page routes and API routes for authentication.
"""

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort, current_app
from sqlalchemy import or_
from datetime import datetime, timezone, timedelta
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from app.extensions import db, limiter
from app.models import User, OTPVerification
from app.services.email_service import send_otp_email, send_welcome_email, send_password_reset_email, generate_otp

auth_bp = Blueprint('auth', __name__)


# ==============================================================================
# PAGE RENDERING ROUTES
# ==============================================================================

@auth_bp.route("/login")
def login_page():
    """Renders the login/authentication page."""
    return render_template("auth/login.html")


@auth_bp.route("/logout")
def logout():
    """Clears the user session and redirects to the login page."""
    session.clear()
    return redirect(url_for("auth.login_page"))


@auth_bp.route("/set-password")
def set_password_page():
    """Renders the page for a new user to set their initial password."""
    if "user_id" not in session:
        return redirect(url_for("auth.login_page"))
    
    user = db.session.get(User, session["user_id"])
    # If user has already set a password, they shouldn't be on this page.
    if user and user.is_password_set:
        return redirect(url_for("main.home_page"))
        
    # The template should contain the form handled by set-password.js
    return render_template("auth/set-password.html", user=user, user_name=user.full_name)


@auth_bp.route("/reset-password")
def reset_password_page():
    """Renders the page for resetting a password with a token."""
    return render_template("auth/reset-password.html")


# ==============================================================================
# AUTHENTICATION API ROUTES
# ==============================================================================

@auth_bp.route("/api/auth/enrollment-suggestions", methods=["POST"])
def get_enrollment_suggestions():
    """Fetches enrollment number suggestions for the login form."""
    data = request.json
    major = data.get("major", "").strip()
    query = data.get("query", "").strip()

    if not major or not query:
        return jsonify({"suggestions": []})

    users = User.query.filter(
        User.major == major,
        User.enrollment_no.ilike(f"{query}%"),
        User.status.in_(['ACTIVE', 'PENDING'])
    ).limit(5).all()

    suggestions = [u.enrollment_no for u in users]
    return jsonify({"suggestions": suggestions})


@auth_bp.route("/api/auth/student_details", methods=["POST"])
def get_student_details():
    """Fetches student details (name, email) based on enrollment number."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()

    if not enrollment_no:
        return jsonify({"error": "Enrollment number is required"}), 400

    user = User.query.filter_by(enrollment_no=enrollment_no).first()

    if not user:
        return jsonify({"error": "Student not found"}), 404

    return jsonify({
        "full_name": user.full_name.title() if user.full_name else "",
        "email": user.email,
        "has_password": user.password_hash is not None
    })


@auth_bp.route("/api/auth/request-otp", methods=["POST"])
@limiter.limit("5 per 10 minutes")
def request_otp():
    """Handles the first step of OTP-based login: validating the user and sending an OTP."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()
    major = data.get("major", "").strip()

    if not enrollment_no or not major:
        return jsonify({"error": "Enrollment number and major are required"}), 400

    user = User.query.filter_by(enrollment_no=enrollment_no).first()

    if not user:
        return jsonify({"error": "Student not found. Please contact administration."}), 404
    
    if user.major.lower() != major.lower():
        return jsonify({"error": "Enrollment number does not match the selected major."}), 400

    if user.status == "BLOCKED":
        return jsonify({"error": "Account is disabled."}), 403
    
    if user.status == "ACTIVE":
        return jsonify({"error": "Password already set. Please login with password."}), 400

    otp_code = generate_otp()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=5)

    otp_entry = OTPVerification(
        enrollment_no=user.enrollment_no,
        otp=otp_code,
        expiry_time=expiry
    )
    db.session.add(otp_entry)
    db.session.commit()

    if not send_otp_email(user.email, otp_code):
        return jsonify({"error": "Failed to send OTP. Please try again."}), 500

    return jsonify({
        "message": "OTP sent successfully",
        "email": user.email,
        "expiry_time": expiry.isoformat()
    }), 200


@auth_bp.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    """Handles the second step of OTP-based login: verifying the OTP and creating a session."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()
    otp_code = data.get("otp", "").strip()

    otp_record = OTPVerification.query.filter_by(
        enrollment_no=enrollment_no,
        is_used=False
    ).filter(
        OTPVerification.expiry_time > datetime.now(timezone.utc)
    ).order_by(OTPVerification.created_at.desc()).with_for_update().first()

    if not otp_record:
        return jsonify({"error": "No active OTP found or OTP expired"}), 400

    if otp_record.attempts >= 5:
        return jsonify({"error": "Too many failed attempts. Please request a new OTP."}), 400

    if otp_record.otp != otp_code:
        otp_record.attempts += 1
        db.session.commit()
        return jsonify({"error": "Invalid or expired OTP"}), 400

    otp_record.is_used = True
    
    user = User.query.filter_by(enrollment_no=enrollment_no).first()
    
    if not user.is_verified:
        user.is_verified = True

    db.session.commit()

    session.clear()
    session["user_id"] = user.id
    session["user_name"] = user.full_name
    session["account_type"] = user.account_type

    if user.password_hash is None:
        redirect_url = url_for("auth.set_password_page")
    else:
        redirect_url = url_for("admin.admin_dashboard_page") if user.account_type == "admin" else url_for("main.home_page")

    return jsonify({
        "message": "Login successful",
        "user_name": user.full_name,
        "redirect_url": redirect_url
    }), 200


@auth_bp.route("/api/auth/login", methods=["POST"])
def login_with_password():
    """Handles password-based login for both students and administrators."""
    data = request.json
    role = data.get("role")
    password = data.get("password")

    user = None
    
    if role == "admin":
        email = data.get("email", "").strip().lower()
        user = User.query.filter_by(email=email, account_type="admin").first()
    elif role == "student":
        enrollment = data.get("enrollment_no", "").strip()
        user = User.query.filter_by(enrollment_no=enrollment, account_type="student").first()
    
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if user.status == "BLOCKED":
        return jsonify({"error": "Account is blocked"}), 403
    
    if user.status == "PENDING":
        session.clear()
        session["user_id"] = user.id
        session["user_name"] = user.full_name
        session["account_type"] = user.account_type
        return jsonify({
            "message": "Login successful, redirecting to password setup.",
            "redirect_url": url_for("auth.set_password_page")
        }), 200

    session.clear()
    session["user_id"] = user.id
    session["user_name"] = user.full_name
    session["account_type"] = user.account_type

    return jsonify({
        "message": "Login successful",
        "redirect_url": "/admin/dashboard" if user.account_type == "admin" else "/home"
    }), 200


@auth_bp.route("/api/auth/forgot-password/request", methods=["POST"])
@limiter.limit("5 per 10 minutes")
def forgot_password_request():
    """Handles the 'Forgot Password' request by sending a secure, time-sensitive reset link."""
    data = request.json
    identifier = data.get("identifier", "").strip()
    
    if not identifier:
        return jsonify({"message": "If an account with that email or enrollment number exists, a password reset link has been sent."}), 200
        
    user = User.query.filter(
        or_(User.enrollment_no == identifier, User.email == identifier)
    ).first()
    
    if user and user.status == 'ACTIVE':
        ts = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        token = ts.dumps(user.email, salt=current_app.config["SECURITY_PASSWORD_SALT"])

        frontend_url = current_app.config["FRONTEND_URL"]
        reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={token}"
        
        send_password_reset_email(user, reset_link)
        
    return jsonify({"message": "If an account with that email or enrollment number exists, a password reset link has been sent."}), 200


@auth_bp.route("/api/auth/reset-password", methods=["POST"])
@limiter.limit("10 per minute")
def reset_password_with_token():
    """Handles the final step of 'Forgot Password': setting a new password via a token."""
    data = request.json
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required."}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    ts = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
    try:
        email = ts.loads(token, salt=current_app.config["SECURITY_PASSWORD_SALT"], max_age=900)
    except SignatureExpired:
        return jsonify({"error": "The password reset link has expired."}), 400
    except (BadTimeSignature, Exception):
        return jsonify({"error": "Invalid password reset link."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Invalid user."}), 400

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


@auth_bp.route("/api/profile/update-password", methods=["POST"])
def update_password():
    """Allows a logged-in user to update their password."""
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = db.session.get(User, session["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.json
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    confirm_password = data.get("confirm_password")
    
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
        
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400
        
    if user.password_hash:
        if not current_password:
            return jsonify({"error": "Current password is required"}), 400
        if not user.check_password(current_password):
            return jsonify({"error": "Incorrect current password"}), 400

    is_activating = user.status == "PENDING"

    user.set_password(new_password)
    
    if is_activating:
        user.status = "ACTIVE"
        user.is_password_set = True

    db.session.commit()

    if is_activating:
        send_welcome_email(user)

    return jsonify({
        "message": "Password updated successfully",
        "redirect_url": url_for("main.home_page")
    }), 200
