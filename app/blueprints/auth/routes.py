"""
Auth Blueprint — Page routes and API routes for authentication.
"""

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, current_app
from sqlalchemy import or_
from datetime import datetime, timezone, timedelta
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from app.extensions import db, limiter
from app.models import User, OTPVerification
from app.services.email_service import send_otp_email, send_welcome_email, send_password_reset_email, generate_otp

auth_bp = Blueprint('auth', __name__)


def _mask_email(email: str) -> str:
    """Returns a privacy-safe masked email: d*****y@college.edu"""
    try:
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            masked = local[0] + "*" * (len(local) - 1)
        else:
            masked = local[0] + "*" * (len(local) - 2) + local[-1]
        return f"{masked}@{domain}"
    except Exception:
        return "your registered email"

# ==============================================================================
# PAGE RENDERING ROUTES
# ==============================================================================


@auth_bp.route("/login")
def login_page():
    """Renders the login/authentication page."""
    if "user_id" in session:
        if session.get("account_type") == "admin":
            return redirect(url_for("admin.admin_dashboard_page"))
        return redirect(url_for("main.home_page"))
    return render_template("auth/login.html")


@auth_bp.route("/admin/login", methods=["GET", "POST"])
def admin_login_page():
    """Admin-only dedicated login page."""
    import logging
    logger = logging.getLogger(__name__)

    if "user_id" in session:
        if session.get("account_type") == "admin":
            return redirect(url_for("admin.admin_dashboard_page"))
        else:
            return redirect(url_for("main.home_page"))

    if request.method == "POST":
        from flask import flash
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password")

        user = User.query.filter_by(email=email, account_type="admin").first()

        if user and user.check_password(password):
            session.clear()
            session["user_id"] = user.id
            session["user_name"] = user.full_name
            session["account_type"] = user.account_type

            logger.info(f"Admin login successful: {email}")
            return redirect(url_for("admin.admin_dashboard_page"))
        else:
            logger.warning(f"Failed admin login attempt: {email}")

            flash("Invalid admin credentials", "error")
            return redirect(url_for("auth.admin_login_page"))

    return render_template("admin/admin_login.html")


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

@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    """Handles new user registration."""
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required_fields = ["first_name", "last_name", "email", "enrollment_no", "university", "major", "batch", "password"]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Field '{field}' is required"}), 400

    email = data.get("email").strip().lower()
    enrollment_no = data.get("enrollment_no").strip()

    if "@" not in email or "." not in email:
        return jsonify({"error": "Invalid email format"}), 400

    if User.query.filter((User.email.ilike(email)) | (User.enrollment_no.ilike(enrollment_no))).first():
        return jsonify({"error": "Email or enrollment number already exists"}), 409

    try:
        user = User(
            first_name=data.get("first_name").strip(),
            last_name=data.get("last_name").strip(),
            email=email,
            enrollment_no=enrollment_no,
            university=data.get("university").strip(),
            major=data.get("major").strip(),
            batch=data.get("batch").strip(),
            status="PENDING",
            is_password_set=False
        )
        user.set_password(data.get("password"))
        db.session.add(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

    return jsonify({"message": "Registration successful", "user_id": user.id}), 201


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
@limiter.limit("10 per minute")
def get_student_details():
    """Fetches student details (name, email) based on enrollment number."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()

    if not enrollment_no:
        return jsonify({"error": "Enrollment number is required"}), 400

    user = User.query.filter(User.enrollment_no.ilike(enrollment_no)).first()

    if not user:
        return jsonify({"error": "Student not found"}), 404

    return jsonify({
        "full_name": user.full_name.title() if user.full_name else "",
        "email": _mask_email(user.email),
        "has_password": user.password_hash is not None,
        "has_personal_email": bool(user.personal_email)
    })


@auth_bp.route("/api/auth/set-personal-email", methods=["POST"])
@limiter.limit("5 per minute")
def set_personal_email():
    """Sets the personal email for a user, either during login or via profile."""
    data = request.json
    personal_email = data.get("personal_email", "").strip().lower()

    import re
    if not personal_email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", personal_email):
        return jsonify({"error": "invalid_email", "message": "Invalid email address."}), 400

    user = None
    if "user_id" in session:
        user = db.session.get(User, session["user_id"])
    else:
        enrollment_no = data.get("enrollment_no", "").strip().upper()
        if not enrollment_no:
            return jsonify({"error": "missing_data", "message": "Enrollment number is required."}), 400
        user = User.query.filter(User.enrollment_no.ilike(enrollment_no)).first()

    if not user:
        return jsonify({"error": "not_found", "message": "User not found."}), 404

    user.personal_email = personal_email
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Failed to save personal email: {e}")
        return jsonify({"error": "db_error", "message": "Failed to save. Try again."}), 500

    return jsonify({"message": "Personal email saved successfully."}), 200


@auth_bp.route("/api/auth/request-otp", methods=["POST"])
@limiter.limit("5 per 10 minutes")
def request_otp():
    """Handles the first step of OTP-based login: validating the user and sending an OTP."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()
    major = data.get("major", "").strip()

    if not enrollment_no or not major:
        return jsonify({"error": "Enrollment number and major are required"}), 400

    user = User.query.filter(User.enrollment_no.ilike(enrollment_no)).first()

    if not user:
        return jsonify({"error": "Student not found. Please contact administration."}), 404

    if user.major.lower() != major.lower():
        return jsonify({"error": "Enrollment number does not match the selected major."}), 400

    if user.status == "BLOCKED":
        return jsonify({"error": "Account is disabled."}), 403

    if user.status == "ACTIVE":
        return jsonify({"error": "Password already set. Please login with password."}), 400

    if not user.personal_email:
        return jsonify({
            "error": "no_personal_email",
            "message": "Please set your Gmail address first."
        }), 400

    otp_code = generate_otp()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=5)

    otp_entry = OTPVerification(
        enrollment_no=user.enrollment_no,
        otp=otp_code,
        expiry_time=expiry
    )
    db.session.add(otp_entry)
    db.session.commit()

    if not send_otp_email(user.personal_email, otp_code):
        return jsonify({"error": "Failed to send OTP. Please try again."}), 500

    return jsonify({
        "message": "OTP sent successfully",
        "email": user.email,
        "expiry_time": expiry.isoformat()
    }), 200


@auth_bp.route("/api/auth/verify-otp", methods=["POST"])
@limiter.limit("5 per minute")
def verify_otp():
    """Handles the second step of OTP-based login: verifying the OTP and creating a session."""
    data = request.json
    enrollment_no = data.get("enrollment_no", "").strip()
    otp_code = data.get("otp", "").strip()

    otp_record = OTPVerification.query.filter(
        OTPVerification.enrollment_no.ilike(enrollment_no),
        OTPVerification.is_used == False,  # noqa: E712
        OTPVerification.expiry_time > datetime.now(timezone.utc)
    ).order_by(OTPVerification.created_at.desc()).with_for_update().first()

    if not otp_record:
        return jsonify({"error": "No active OTP found or OTP expired"}), 400

    if otp_record.attempts >= 5:
        return jsonify({"error": "Too many failed attempts. Please request a new OTP."}), 400

    if otp_record.otp != otp_code:
        otp_record.attempts += 1
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({"error": "Invalid or expired OTP"}), 400

    otp_record.is_used = True

    user = User.query.filter(User.enrollment_no.ilike(enrollment_no)).first()

    if not user.is_verified:
        user.is_verified = True

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(f"verify_otp commit failed for {enrollment_no}: {exc}")
        return jsonify({"error": "A database error occurred. Please try again."}), 500

    session.clear()
    session["user_id"] = user.id
    session["user_name"] = user.full_name
    session["account_type"] = user.account_type

    if user.password_hash is None:
        redirect_url = url_for("auth.set_password_page")
    else:
        redirect_url = url_for(
            "admin.admin_dashboard_page") if user.account_type == "admin" else url_for("main.home_page")

    return jsonify({
        "message": "Login successful",
        "user_name": user.full_name,
        "redirect_url": redirect_url
    }), 200


@auth_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("5 per minute")
def login_with_password():
    """Handles password-based login for both students and administrators."""
    data = request.json
    role = data.get("role")
    password = data.get("password")

    user = None

    if role == "admin":
        return jsonify({"error": "Administrators must use the dedicated /admin/login page."}), 403
    elif role == "student":
        enrollment = data.get("enrollment_no", "").strip()
        user = User.query.filter(User.enrollment_no.ilike(enrollment), User.account_type == "student").first()

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
        return jsonify({
            "message": "If an account with that email or enrollment number exists, "
                       "a password reset link has been sent."
        }), 200

    user = User.query.filter(
        or_(User.enrollment_no.ilike(identifier), User.email.ilike(identifier))
    ).first()

    if user and user.status == 'ACTIVE':
        ts = URLSafeTimedSerializer(current_app.config["SECRET_KEY"])
        hash_anchor = (user.password_hash or "")[-10:]
        token_payload = f"{user.email}|{hash_anchor}"
        token = ts.dumps(token_payload, salt=current_app.config["SECURITY_PASSWORD_SALT"])

        frontend_url = current_app.config["FRONTEND_URL"]
        reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={token}"

        send_password_reset_email(user, reset_link)

    return jsonify({
        "message": "If an account with that email or enrollment number exists, "
                   "a password reset link has been sent."
    }), 200


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
        token_payload = ts.loads(token, salt=current_app.config["SECURITY_PASSWORD_SALT"], max_age=900)
    except SignatureExpired:
        return jsonify({"error": "The password reset link has expired."}), 400
    except (BadTimeSignature, Exception):
        return jsonify({"error": "Invalid password reset link."}), 400

    try:
        email, hash_anchor = token_payload.rsplit("|", 1)
    except ValueError:
        return jsonify({"error": "Invalid password reset link."}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Invalid user."}), 400

    # If password was already reset, the hash changed → anchor won't match → token is dead.
    current_anchor = (user.password_hash or "")[-10:]
    if current_anchor != hash_anchor:
        return jsonify({"error": "This reset link has already been used."}), 400

    user.set_password(new_password)
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(f"reset_password commit failed for {email}: {exc}")
        return jsonify({"error": "A database error occurred. Please try again."}), 500

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
