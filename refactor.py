import ast
import os

filepath = r'c:\Code\Code Playground\Campus Connect\app\blueprints\main\routes.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

tree = ast.parse(code)
functions = {}
for node in tree.body:
    if isinstance(node, ast.FunctionDef):
        # find the full range including comments and decorators
        start = node.lineno - 1
        end = node.end_lineno
        # Decorators might be on earlier lines
        if node.decorator_list:
            start = node.decorator_list[0].lineno - 1
        
        # also capture preceding comments and empty lines
        while start > 0 and (lines[start-1].strip().startswith('#') or lines[start-1].strip() == ''):
            start -= 1
            
        functions[node.name] = (start, end)

# The groups
groups = {
    'feed': ['api_posts', 'get_single_post_api', 'create_post_with_file', 'download_post_attachment', 'toggle_like', 'get_comments', 'add_comment'],
    'events': ['get_events', 'register_for_event'],
    'connections': ['get_suggestions', 'send_connection_request', 'accept_connection_request', 'reject_connection_request', 'get_pending_requests', 'get_sent_requests', 'get_connections_list', 'remove_connection'],
    'notifications': ['get_notifications', 'get_unread_count', 'mark_notification_read', 'mark_all_notifications_read', 'clear_notifications']
}

base_dir = r"c:\Code\Code Playground\Campus Connect\app\blueprints"
import_block = """from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort, current_app, send_file
from sqlalchemy import func, or_, and_
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timezone, timedelta
import time
from app.extensions import db, limiter
from app.models import (
    User, Post, Like, Comment, Event, EventRegistration,
    Connection, ConnectionRequest, Notification, Announcement,
    Skill, Experience, Education
)
from app.utils.decorators import admin_required, status_required
from app.utils.helpers import (
    get_clean_filename, _get_user_avatar, save_uploaded_file,
    _format_post_for_api, get_content_activity
)
from app.services.email_service import send_welcome_email
from app.services.comment_queue import comment_queue_service
from sqlalchemy.orm import joinedload
"""

files_to_remove_from_main = []
for bp_name, func_names in groups.items():
    bp_dir = os.path.join(base_dir, bp_name)
    os.makedirs(bp_dir, exist_ok=True)
    
    # __init__.py
    with open(os.path.join(bp_dir, "__init__.py"), "w", encoding='utf-8') as f:
        f.write("from flask import Blueprint\n\n")
        f.write(f"{bp_name}_bp = Blueprint('{bp_name}', __name__)\n\n")
        f.write("from . import routes\n")
    
    # routes.py
    with open(os.path.join(bp_dir, "routes.py"), "w", encoding='utf-8') as f:
        f.write(import_block)
        f.write(f"\nfrom .{__name__ if bp_name == 'main' else ''} import {bp_name}_bp\n\n")
        
        for func_name in func_names:
            if func_name in functions:
                start, end = functions[func_name]
                func_code = "".join(lines[start:end])
                func_code = func_code.replace("@main_bp.route", f"@{bp_name}_bp.route")
                f.write(func_code)
                f.write("\n")
                files_to_remove_from_main.append(func_name)

# Now rebuild main_bp
main_bp_routes = []
for node in tree.body:
    if isinstance(node, ast.FunctionDef) and node.name in files_to_remove_from_main:
        continue
    # Wait, the node list doesn't preserve exact formatting...
    # Better: just collect lines to keep
    pass

main_keep_lines = []
skip_until = -1
for i, line in enumerate(lines):
    should_skip = False
    for func_name in files_to_remove_from_main:
        start, end = functions[func_name]
        if start <= i < end:
            should_skip = True
            break
    if not should_skip:
        main_keep_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(main_keep_lines)

print("Done generating files!")
