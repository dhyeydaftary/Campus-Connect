"""
Legal Section Routes
Static pages for Privacy Policy and Terms of Service.
NO DATABASE QUERIES NEEDED.
"""

from flask import Blueprint, render_template

legal_bp = Blueprint('legal', __name__)

@legal_bp.route('/legal/privacy_policy')
def privacy_policy():
    """
    Privacy Policy page.
    Explains data collection, usage, rights (GDPR/CCPA compliant).
    Informational only - no database needed.
    """
    return render_template('legal/privacy_policy.html')

@legal_bp.route('/legal/terms_of_service')
def terms_of_service():
    """
    Terms of Service page.
    Binding legal agreement for platform usage.
    Informational only - no database needed.
    """
    return render_template('legal/terms_of_service.html')

@legal_bp.route('/legal/terms_of_use')
def terms_of_use():
    """Terms of use page - binding legal agreement"""
    return render_template('legal/terms_of_use.html')

@legal_bp.route('/legal/community_guidelines')
def community_guidelines():
    """Community Guidelines page - values and expected behavior"""
    return render_template('legal/community_guidelines.html')
