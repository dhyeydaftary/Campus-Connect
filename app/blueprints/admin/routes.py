"""
Admin Blueprint - All /admin/* page and API routes.
"""

from flask import Blueprint, render_template, request, jsonify, session, abort, current_app, send_file
from sqlalchemy import func, or_, and_
from datetime import datetime, timezone
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from app.extensions import db
from app.models import (
    User, Post, Event, EventRegistration, Connection,
    Announcement, AdminLog, SupportTicket, IssueReport
)
from app.utils.decorators import admin_required
from app.utils.helpers import _get_user_avatar, get_content_activity, _format_admin_event
from app.services.seeder import seed_admin

admin_bp = Blueprint('admin', __name__)


# ==============================================================================
# PAGE RENDERING ROUTES
# ==============================================================================

@admin_bp.route("/admin/dashboard")
def admin_dashboard_page():
    """Renders the main admin dashboard page."""
    admin_required()
    return render_template("admin/dashboard.html")

@admin_bp.route("/admin/users")
def admin_users_page():
    """Renders the admin page for user management."""
    admin_required()
    return render_template("admin/users.html")

@admin_bp.route("/admin/events")
def admin_events_page():
    """Renders the admin page for event management."""
    admin_required()
    return render_template("admin/events.html")

@admin_bp.route("/admin/announcements")
def admin_announcements_page():
    """Renders the admin page for announcement management."""
    admin_required()
    return render_template("admin/announcements.html")

@admin_bp.route("/admin/logs")
def admin_logs_page():
    """Renders the admin page for viewing audit logs."""
    admin_required()
    return render_template("admin/logs.html")

@admin_bp.route("/admin/tickets")
def admin_tickets_page():
    """Renders the admin page for viewing support tickets and reports."""
    admin_required()
    return render_template("admin/tickets.html")


@admin_bp.route("/admin/api/dashboard/overview", methods=["GET"])
def admin_dashboard_overview():
    """
    Aggregates and returns a wide range of analytics for the admin dashboard.
    """
    admin_required()
    
    try:
        # --- Key Performance Indicators (KPIs) ---
        total_users = User.query.count()
        active_users = User.query.filter_by(status='ACTIVE').count()
        pending_users = User.query.filter_by(status='PENDING').count()
        blocked_users = User.query.filter_by(status='BLOCKED').count()
        total_posts = Post.query.count()
        active_events = Event.get_active_count()

        # --- User Role Distribution ---
        # Group users by account_type and count
        role_distribution_query = db.session.query(
            User.account_type,
            func.count(User.id).label('count')
        ).filter(User.status == 'ACTIVE').group_by(User.account_type).all()
        
        role_distribution = {
            role: count for role, count in role_distribution_query
        }
        
        # --- User Growth Data (Daily) ---
        user_growth_query = db.session.query(
            func.date(User.created_at).label('date'),
            func.count(User.id).label('count')
        ).filter(User.status == 'ACTIVE').group_by(func.date(User.created_at)).order_by(func.date(User.created_at)).all()
        
        user_growth = [
            {
                "month": datetime.strptime(str(date), '%Y-%m-%d').strftime('%b'),
                "users": count
            }
            for date, count in user_growth_query
        ]
        
        # --- Content Activity (Last 7 Days) ---
        content_activity = get_content_activity()
        return jsonify({
            "totalUsers": total_users,
            "activeUsers": active_users,
            "pendingUsers": pending_users,
            "blockedUsers": blocked_users,
            "totalPosts": total_posts,
            "activeEvents": active_events,
            "roleDistribution": role_distribution,
            "userGrowth": user_growth,
            "contentActivity": content_activity
        }), 200
        
    except Exception as e:
        # Return error but still indicate API is online
        return jsonify({
            "error": "Failed to fetch dashboard data",
            "message": str(e),
            "system_health": {
                "api": "online",
                "database": "error"
            }
        }), 500


@admin_bp.route("/admin/api/users", methods=["GET"])
def admin_get_users():
    """Fetches a list of all users for the admin user management table."""
    admin_required()
    
    users = User.query.all()
    
    return jsonify([{
        "id": user.id,
        "username": user.full_name,
        "profile_picture": _get_user_avatar(user),
        "email": user.email,
        "role": user.account_type, # Frontend expects 'role'
        "major": user.major,
        "status": user.status.lower(), # PENDING, ACTIVE, BLOCKED
        "joinDate": user.created_at.strftime('%Y-%m-%d')
    } for user in users]), 200


@admin_bp.route("/admin/api/users/<int:user_id>/toggle", methods=["POST"])
def admin_toggle_user_status(user_id):
    """Toggles a user's status between ACTIVE and BLOCKED."""
    admin_required()
    
    # Prevent admin from disabling themselves
    if user_id == session["user_id"]:
        return jsonify({"error": "You cannot disable your own account"}), 403
    
    user = db.session.get(User, user_id)
    if not user:
        abort(404)
    
    old_status = user.status
    
    # If user is BLOCKED, activate them. Otherwise, block them.
    # This prevents accidentally activating PENDING users.
    if user.status == 'BLOCKED':
        user.status = 'ACTIVE'
    else:
        user.status = 'BLOCKED'
    
    # Log the action
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="set_user_status",
        target_user_id=user_id,
        details=f"Changed status from {old_status} to {user.status}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "status": user.status.lower() # Return new status for frontend
        }
    }), 200


@admin_bp.route("/admin/api/events/meta", methods=["GET"])
def admin_get_event_creators():
    """Fetches metadata for the event creation form, including eligible event creators."""
    admin_required()
    
    eligible_users = User.query.filter(
        User.account_type.in_(["official", "club"])
    ).all()
    
    return jsonify({
        "eventTypes": ["official", "club"],
        "targetEntities": [{
            "id": user.id,
            "name": user.full_name,
            "type": user.account_type
        } for user in eligible_users]
    }), 200


@admin_bp.route("/admin/api/events/create", methods=["POST"])
def admin_create_event():
    """Allows an admin to create an event, optionally on behalf of an official/club account."""
    admin_required()
    
    data = request.json
    
    # The event owner is the selected target entity, or the admin themselves if none is chosen.
    target_user_id = data.get("targetEntity")
    if not target_user_id:
        target_user_id = session["user_id"]
    
    # Verify target user exists and has correct account type
    target_user = db.session.get(User, target_user_id)
    if not target_user:
        return jsonify({"error": "Target user not found"}), 404
    
    if target_user.account_type not in ["official", "club", "admin"]:
        return jsonify({"error": "Target user must be official, club, or admin"}), 400
    
    # Parse ISO-formatted date string from the frontend.
    try:
        event_date_str = data.get("event_date")
        if not event_date_str:
            return jsonify({"error": "Event date required"}), 400
        
        # Handle ISO format
        dt = datetime.fromisoformat(event_date_str.replace('Z', '+00:00'))
        event_date = dt.astimezone(timezone.utc)
    except (ValueError, AttributeError):
        return jsonify({"error": "Invalid event_date format."}), 400
    
    # Create the event, assigning ownership to the target user.
    event = Event(
        title=data.get("title").strip(),
        description=data.get("description").strip(),
        location=data.get("location").strip(),
        event_date=event_date,
        total_seats=int(data.get("total_seats", 100)),
        user_id=target_user_id  # Event owner is the target user, NOT the admin
    )
    
    # Prevent creating past events
    now = datetime.now(timezone.utc)
    event_date_check = event.event_date
    if event_date_check.tzinfo is None:
        event_date_check = event_date_check.replace(tzinfo=timezone.utc)
    
    if event_date_check < now:
        return jsonify({"error": "Cannot create events in the past"}), 400
    
    db.session.add(event)
    db.session.flush()  # Get event.id before commit
    
    # Log the admin action
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="create_event",
        target_user_id=target_user_id,
        target_event_id=event.id,
        details=f"Created event '{event.title}' on behalf of {target_user.full_name}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "event": {
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "event_date": event.event_date.isoformat(),
            "total_seats": event.total_seats,
            "owner_id": event.user_id,
            "owner_name": target_user.full_name
        }
    }), 201


@admin_bp.route("/admin/api/announcements", methods=["GET"])
def admin_get_announcements():
    """Fetches announcements for the admin panel, filterable by status."""
    admin_required()
    status = request.args.get("status", "active")
    
    # Fetch based on status (active or deleted)
    announcements = Announcement.query.filter_by(status=status).order_by(Announcement.created_at.desc()).all()
    
    announcements_data = []
    for ann in announcements:
        announcements_data.append({
            "id": ann.id,
            "title": ann.title,
            "content": ann.content,
            "date": ann.created_at.strftime("%d %b %Y, %I:%M %p"),
            "author": ann.author.full_name if ann.author else "Admin",
            "updated_at": ann.updated_at.strftime("%d %b %Y, %I:%M %p") if ann.updated_at else None,
            "status": ann.status
        })
    
    return jsonify(announcements_data)

@admin_bp.route("/admin/api/announcements", methods=["POST"])
def admin_create_announcement():
    """Creates a new announcement and logs the admin action."""
    admin_required()
    data = request.json
    title = data.get("title")
    content = data.get("content")
    
    if not title or not content:
        return jsonify({"error": "Title and content required"}), 400
    
    # Create Announcement
    announcement = Announcement(
        title=title,
        content=content,
        author_id=session["user_id"]
    )
    db.session.add(announcement)
    
    # Log action (Audit trail)
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="create_announcement",
        details=f"Created announcement: {title}"
    )
    db.session.add(log)
    
    db.session.commit()
    return jsonify({ "success": True, "message": "Announcement created" }), 201

@admin_bp.route("/admin/api/announcements/<int:id>", methods=["PUT"])
def admin_update_announcement(id):
    """Updates the title or content of an existing announcement."""
    admin_required()
    data = request.json
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    if "title" in data:
        announcement.title = data["title"]
    if "content" in data:
        announcement.content = data["content"]
        
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement updated"})

@admin_bp.route("/admin/api/announcements/<int:id>", methods=["DELETE"])
def admin_delete_announcement(id):
    """Soft-deletes an announcement by changing its status to 'deleted'."""
    admin_required()
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    announcement.status = 'deleted'
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement moved to recycle bin"})

@admin_bp.route("/admin/api/announcements/<int:id>/restore", methods=["POST"])
def admin_restore_announcement(id):
    """Restores a soft-deleted announcement by setting its status back to 'active'."""
    admin_required()
    
    announcement = db.session.get(Announcement, id)
    if not announcement:
        return jsonify({"error": "Announcement not found"}), 404
        
    # Restore
    announcement.status = 'active'
    db.session.commit()
    return jsonify({"success": True, "message": "Announcement restored"})

@admin_bp.route("/admin/api/logs", methods=["GET"])
def admin_get_logs():
    """Fetches the latest admin audit logs."""
    admin_required()
    logs = AdminLog.query.order_by(AdminLog.created_at.desc()).limit(50).all()
    return jsonify([{
        "id": log.id,
        "action": log.action_type.replace('_', ' ').title(),
        "target": log.target_user.full_name if log.target_user else "System",
        "admin": log.admin.email if log.admin else "Unknown",
        "timestamp": log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        "ip": request.remote_addr or "127.0.0.1"
    } for log in logs]), 200

@admin_bp.route("/admin/api/logs/download", methods=["GET"])
def admin_download_logs():
    """Generates and serves all admin logs as a downloadable text file."""
    admin_required()
    
    logs = AdminLog.query.order_by(AdminLog.created_at.desc()).all()
    
    # Generate text content
    content = "CAMPUS CONNECT - ADMIN LOGS\n"
    content += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    content += "=" * 80 + "\n\n"
    
    for log in logs:
        timestamp = log.created_at.strftime('%Y-%m-%d %H:%M:%S')
        action = log.action_type.replace('_', ' ').upper()
        details = log.details
        content += f"[{timestamp}] {action}: {details}\n"
    
    from flask import Response
    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment;filename=admin_logs.txt"}
    )
@admin_bp.route("/admin/api/events/list")
def admin_get_events_list():
    """Fetches a list of events for the admin panel, filterable by status (upcoming/past)."""
    admin_required()
    status = request.args.get("status", "upcoming")
    now = datetime.now(timezone.utc)
    
    if status == "past":
        events = Event.query.filter(Event.event_date < now).order_by(Event.event_date.desc()).all()
    else:
        events = Event.query.filter(Event.event_date >= now).order_by(Event.event_date.asc()).all()
        
    return jsonify([_format_admin_event(e) for e in events])

@admin_bp.route("/admin/api/events/<int:event_id>", methods=["PUT"])
def admin_update_event(event_id):
    """Updates the details of an existing event."""
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    # Prevent editing past events
    now = datetime.now(timezone.utc)
    event_date = event.event_date
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)
        
    if event_date < now:
        return jsonify({"error": "Cannot edit past events"}), 400
        
    data = request.json
    
    if "title" in data: event.title = data["title"]
    if "description" in data: event.description = data["description"]
    if "location" in data: event.location = data["location"]
    if "total_seats" in data: event.total_seats = int(data["total_seats"])
    
    if "event_date" in data:
        try:
            dt_str = data["event_date"]
            if 'Z' not in dt_str and '+' not in dt_str:
                return jsonify({"error": "UTC Datetime required"}), 400
            dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
            event.event_date = dt.astimezone(timezone.utc)
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400
            
    db.session.commit()
    return jsonify({"success": True, "message": "Event updated successfully"})

@admin_bp.route("/admin/api/users/<int:user_id>/details")
def admin_get_user_details(user_id):
    """Fetches detailed information and stats for a specific user."""
    admin_required()
    
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Get counts efficiently
    posts_count = Post.query.filter_by(user_id=user_id).count()
    
    # Connections (bidirectional)
    connections_count = Connection.query.filter(
        or_(
            Connection.user_id == user_id,
            Connection.connected_user_id == user_id
        )
    ).count()
    
    return jsonify({
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.account_type,
        "status": user.status.lower(),
        "university": user.university,
        "major": user.major,
        "batch": user.batch,
        "profile_picture": _get_user_avatar(user),
        "joined_date": user.created_at.strftime('%B %d, %Y'),
        "stats": {
            "posts": posts_count,
            "connections": connections_count
        }
    })

@admin_bp.route("/admin/api/events/<int:event_id>/participants")
def admin_get_event_participants(event_id):
    """Fetches a list of users who have registered as 'going' to a specific event."""
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    # Get only 'going' participants
    participants = (
        db.session.query(User)
        .join(EventRegistration)
        .filter(
            EventRegistration.event_id == event_id,
            EventRegistration.status == 'going'
        )
        .all()
    )
    
    return jsonify([{
        "name": u.full_name,
        "email": u.email,
        "college": u.university,
        "department": u.major
    } for u in participants])

@admin_bp.route("/admin/api/events/<int:event_id>/download")
def admin_download_event_pdf(event_id):
    """Generates and serves a PDF report of an event's participants."""
    admin_required()
    event = db.session.get(Event, event_id)
    if not event:
        abort(404)
    
    participants = db.session.query(User).join(EventRegistration).filter(
        EventRegistration.event_id == event_id, EventRegistration.status == 'going'
    ).all()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    elements.append(Paragraph(f"Event Report: {event.title}", styles['Title']))
    elements.append(Spacer(1, 12))
    
    details = [
        f"<b>Date:</b> {event.event_date.strftime('%Y-%m-%d %H:%M')}",
        f"<b>Location:</b> {event.location}",
        f"<b>Participated:</b> {event.going_count} | <b>Interested:</b> {event.interested_count}"
    ]
    for d in details:
        elements.append(Paragraph(d, styles['Normal']))
        elements.append(Spacer(1, 6))
        
    elements.append(Spacer(1, 20))
    
    if participants:
        data = [['Name', 'Email', 'University', 'Major']] + [[p.full_name, p.email, p.university, p.major] for p in participants]
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No participants yet.", styles['Normal']))
        
    doc.build(elements)
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"event_{event_id}.pdf", mimetype='application/pdf')


# ==============================================================================
# SUPPORT TICKETS & REPORTS MANAGEMENT
# ==============================================================================

@admin_bp.route("/admin/api/tickets", methods=["GET"])
def admin_get_tickets():
    """Fetches a list of support tickets, order by most recent."""
    admin_required()
    
    # Optional status filter
    status_filter = request.args.get('status')
    
    query = SupportTicket.query
    if status_filter and status_filter != 'all':
        query = query.filter_by(status=status_filter)
        
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    
    return jsonify([{
        "id": t.id,
        "name": t.name,
        "email": t.email,
        "subject": t.subject,
        "category": t.category,
        "status": t.status,
        "priority": t.priority,
        "created_at": t.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        "has_attachment": bool(t.attachment)
    } for t in tickets]), 200

@admin_bp.route("/admin/api/tickets/<int:ticket_id>/status", methods=["POST"])
def admin_update_ticket_status(ticket_id):
    """Updates the status of a support ticket."""
    admin_required()
    ticket = db.session.get(SupportTicket, ticket_id)
    if not ticket:
        abort(404)
        
    data = request.json
    new_status = data.get('status')
    
    if new_status not in ['open', 'in_progress', 'resolved', 'closed']:
        return jsonify({"error": "Invalid status"}), 400
        
    old_status = ticket.status
    ticket.status = new_status
    ticket.updated_at = datetime.now(timezone.utc)
    
    # Log the action
    log = AdminLog(
        admin_id=session["user_id"],
        action_type="update_ticket",
        details=f"Ticket #{ticket.id} status changed from {old_status} to {new_status}"
    )
    db.session.add(log)
    db.session.commit()
    
    # TODO: Send email notification to user about status change if resolved
    if new_status in ['resolved', 'closed'] and old_status not in ['resolved', 'closed']:
        from app.services.email_service import send_status_update_email
        send_status_update_email(ticket)
    
    return jsonify({"success": True, "message": f"Status updated to {new_status}"})

@admin_bp.route("/admin/api/reports", methods=["GET"])
def admin_get_reports():
    """Fetches a list of issue reports."""
    admin_required()
    
    status_filter = request.args.get('status')
    
    query = IssueReport.query
    if status_filter and status_filter != 'all':
        query = query.filter_by(status=status_filter)
        
    reports = query.order_by(IssueReport.created_at.desc()).all()
    
    return jsonify([{
        "id": r.id,
        "type": r.report_type,
        "title": r.title,
        "email": r.email,
        "severity": r.severity,
        "status": r.status,
        "created_at": r.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        "has_attachments": bool(r.attachments)
    } for r in reports]), 200
