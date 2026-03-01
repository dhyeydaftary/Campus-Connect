"""
Route decorators for Campus Connect.
"""

from functools import wraps
from flask import session, redirect, url_for, abort, flash
from app.extensions import db
from app.models import User


def admin_required():
    """
    Decorator to protect routes that require administrator privileges.
    """
    if "user_id" not in session:
        abort(redirect(url_for("auth.login_page")))  # Redirect to login if not authenticated
    
    if session.get("account_type") != "admin":
        abort(403)  # Forbidden - not an admin


def login_required(f):
    """
    Decorator to protect routes that require user authentication.
    Redirects to login page if user is not authenticated.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login_page"))
        return f(*args, **kwargs)
    return decorated_function


def status_required(allowed_statuses):
    """
    Decorator to protect routes based on user status.
    Redirects to login if user is not authenticated, or if their status is not in the allowed list.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                return redirect(url_for("auth.login_page"))
            
            user = db.session.get(User, session["user_id"])
            if not user:
                session.clear()
                return redirect(url_for("auth.login_page"))

            if user.status == "BLOCKED":
                session.clear()
                flash("Your account is blocked. Please contact support.", "danger")
                return redirect(url_for("auth.login_page"))
            
            if user.status not in allowed_statuses:
                abort(403)
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator
