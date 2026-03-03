"""
Email Service for Campus Connect.
Handles all outgoing email functionality.
"""

import random
import string
from flask import render_template, current_app
from flask_mail import Message as EmailMessage
from app.extensions import mail


def send_email(subject, recipients, html_body):
    """
    Sends an HTML email using Flask-Mail.

    Returns:
        bool: True if email was sent successfully, False otherwise.
    """
    # Validate recipients: must be a non-empty list of valid-looking emails
    import re
    if not recipients or not isinstance(recipients, (list, tuple)) or not all(isinstance(r, str) and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", r) for r in recipients):
        current_app.logger.error(f"Invalid recipient(s) for email: {recipients}")
        return False
    try:
        msg = EmailMessage(subject, recipients=recipients)
        msg.html = html_body
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Email sending failed to {recipients}: {e}")
        return False

def send_otp_email(email, otp):
    """Sends a login OTP email using an HTML template."""
    html = render_template(
        "emails/otp_login.html",
        subtitle="Your Login Verification Code",
        otp_code=list(otp)  # Pass as a list of characters for the template
    )
    return send_email("Your Campus Connect OTP", [email], html)

def send_welcome_email(user):
    """Sends a welcome email to a new user."""
    html = render_template(
        "emails/welcome_email.html",
        subtitle="Welcome Aboard!",
        user_name=user.full_name
    )
    return send_email(f"Welcome to Campus Connect, {user.first_name}!", [user.email], html)

def send_password_reset_email(user, reset_link):
    """Sends a password reset link email."""
    html = render_template(
        "emails/password_reset.html",
        subtitle="Password Reset Request",
        reset_link=reset_link
    )
    return send_email("Reset Your Campus Connect Password", [user.email], html)

def generate_otp():
    """Generate a 6-digit numeric OTP"""
    return ''.join(random.choices(string.digits, k=6))
