"""
Email Service for Campus Connect.
Handles all outgoing email functionality.
"""

import os
import re
import secrets
import string
import resend
from flask import render_template, current_app


def send_email(subject, recipients, html_body):
    """
    Sends an HTML email using Resend HTTP API.

    Returns:
        bool: True if email was sent successfully, False otherwise.
    """
    if (
        not recipients
        or not isinstance(recipients, (list, tuple))
        or not all(
            isinstance(r, str) and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", r)
            for r in recipients
        )
    ):
        current_app.logger.error(f"Invalid recipient(s) for email: {recipients}")
        return False
    try:
        resend.api_key = os.environ.get('RESEND_API_KEY')
        sender = current_app.config.get('MAIL_DEFAULT_SENDER')
        for recipient in recipients:
            resend.Emails.send({
                "from": sender,
                "to": recipient,
                "subject": subject,
                "html": html_body,
            })
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
    return ''.join(secrets.choice(string.digits) for _ in range(6))


def send_support_notification(ticket):
    """Send email to support team when a new ticket is submitted"""
    admin_email = current_app.config.get("ADMIN_EMAIL", current_app.config.get("MAIL_DEFAULT_SENDER"))
    if not admin_email:
        current_app.logger.warning("No ADMIN_EMAIL config found, skipping support notification")
        return False

    html = render_template(
        "emails/support_ticket.html",
        subtitle=f"New Ticket: {ticket.subject}",
        ticket=ticket
    )
    return send_email(f"New Support Ticket: {ticket.subject}", [admin_email], html)


def send_ticket_confirmation(email, ticket_id, subject):
    """Send a confirmation email to the user that their ticket was received"""
    html = render_template(
        "emails/ticket_confirmation.html",
        subtitle=f"Ticket #{ticket_id} Received",
        ticket_id=ticket_id,
        subject=subject
    )
    return send_email(f"Support Ticket #{ticket_id} Received", [email], html)


def send_status_update_email(ticket):
    """Send an email to the user when their ticket status changes"""
    html = render_template(
        "emails/status_update.html",
        subtitle=f"Ticket #{ticket.id} Update",
        ticket=ticket
    )
    return send_email(f"Status Update on Ticket #{ticket.id}", [ticket.email], html)