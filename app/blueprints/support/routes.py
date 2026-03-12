"""
Support Blueprint — Routes for legal, support, and trust pages.
"""

import os
import uuid
import re
import logging
from flask import Blueprint, render_template, request, current_app, jsonify, session
from werkzeug.utils import secure_filename

from app.extensions import db, limiter
from app.models import SupportTicket, IssueReport, User
from app.services.email_service import send_support_notification, send_ticket_confirmation
from app.utils.decorators import login_required

logger = logging.getLogger(__name__)

support_bp = Blueprint('support', __name__)

@support_bp.context_processor
def inject_user():
    user = None
    user_name = None
    if session.get('user_id'):
        user = db.session.get(User, session['user_id'])
        if user:
            user_name = user.full_name
    return dict(user=user, user_name=user_name)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'docx', 'doc'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_email_format(email):
    pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    return re.match(pattern, email) is not None

def save_upload_file(file):
    """Securely save an uploaded file and return its relative path."""
    if not file or not allowed_file(file.filename):
        return None, "Invalid file type."
    
    # Check file size (Read into memory temporarily)
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)
    
    if file_length > MAX_FILE_SIZE:
        return None, "File exceeds 5MB limit."

    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
    upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'support')
    
    # Ensure directory exists inside static/
    os.makedirs(os.path.join(current_app.root_path, '..', upload_folder), exist_ok=True)
    
    file_path = os.path.join(upload_folder, unique_filename)
    full_path = os.path.join(current_app.root_path, '..', file_path)
    file.save(full_path)
    
    return file_path, "OK"

# ==============================================================================
# SUPPORT PAGES & FORMS (Rate Limited)
# ==============================================================================

@support_bp.route("/help-center")
def help_center():
    """Renders the help center page."""
    return render_template("support/help_center.html")


@support_bp.route("/contact-support", methods=['GET', 'POST'])
@limiter.limit("5 per hour")
def contact_support():
    """Renders and handles the contact support form."""
    if request.method == 'POST':
        try:
            name = request.form.get('name', '').strip()
            email = request.form.get('email', '').strip()
            subject = request.form.get('subject', '').strip()
            category = request.form.get('category', '').strip()
            message = request.form.get('message', '').strip()
            
            if not all([name, email, subject, category, message]):
                return jsonify({'error': 'All required fields must be filled.'}), 400
                
            if not validate_email_format(email):
                return jsonify({'error': 'Invalid email format.'}), 400
                
            attachment_path = None
            if 'file' in request.files:
                file = request.files['file']
                if file.filename:
                    attachment_path, msg = save_upload_file(file)
                    if not attachment_path:
                        return jsonify({'error': msg}), 400

            ticket = SupportTicket(
                user_id=session.get('user_id'), # None for anonymous users
                name=name,
                email=email,
                subject=subject,
                category=category,
                message=message,
                attachment=attachment_path
            )
            
            db.session.add(ticket)
            db.session.commit()
            
            logger.info(f"Support ticket created: #{ticket.id} by {email}")
            
            # Send Emails
            send_support_notification(ticket)
            send_ticket_confirmation(email, ticket.id, subject)
            
            return jsonify({'success': True, 'ticket_id': ticket.id, 'email': email}), 201
            
        except Exception as e:
            logger.error(f"Error submitting support ticket: {str(e)}")
            db.session.rollback()
            return jsonify({'error': 'Server error. Please try again.'}), 500

    return render_template("support/contact_support.html")


@support_bp.route("/report-issue", methods=['GET', 'POST'])
@login_required
@limiter.limit("5 per hour")
def report_issue():
    """Renders and handles the report issue form."""
    if request.method == 'POST':
        try:
            report_type = request.form.get('report_type', '').strip()
            title = request.form.get('title', '').strip()
            email = request.form.get('email', '').strip()
            description = request.form.get('description', '').strip()
            steps_to_reproduce = request.form.get('steps_to_reproduce', '').strip()
            severity = request.form.get('severity', '').strip()
            
            if not all([report_type, title, email, description]):
                return jsonify({'error': 'Missing required base fields.'}), 400
                
            if not validate_email_format(email):
                return jsonify({'error': 'Invalid email format.'}), 400
            
            attachments = []
            files = request.files.getlist('files[]')
            for file in files:
                if file.filename:
                    path, msg = save_upload_file(file)
                    if not path:
                        return jsonify({'error': f"File '{file.filename}': {msg}"}), 400
                    attachments.append(path)

            report = IssueReport(
                user_id=session.get('user_id'),
                report_type=report_type,
                title=title,
                email=email,
                description=description,
                steps_to_reproduce=steps_to_reproduce if steps_to_reproduce else None,
                severity=severity if severity else None,
                attachments=attachments if attachments else None
            )
            
            db.session.add(report)
            db.session.commit()
            
            logger.info(f"Issue report created: #{report.id} ({report_type})")
            
            # Acknowledgment email reusing the ticket template (genericized)
            send_ticket_confirmation(email, f"RPT-{report.id}", title)
            
            return jsonify({'success': True, 'ticket_id': f"RPT-{report.id}", 'email': email}), 201

        except Exception as e:
            logger.error(f"Error submitting issue report: {str(e)}")
            db.session.rollback()
            return jsonify({'error': 'Server error. Please try again.'}), 500

    return render_template("support/report_issue.html")


@support_bp.route("/ticket-success")
def ticket_success():
    """Generic success page for tickets and reports."""
    ticket_id = request.args.get('id', 'Unknown')
    email = request.args.get('email', '')
    return render_template("support/ticket_success.html", ticket_id=ticket_id, email=email)




