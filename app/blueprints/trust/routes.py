"""
Trust Section Routes
Informational pages about security, verification, and data protection.
NO DATABASE QUERIES NEEDED.
"""

from flask import Blueprint, render_template

trust_bp = Blueprint('trust', __name__)

@trust_bp.route('/trust/security')
def security():
    """
    Security information page.
    Explains 7 security features and 5 best practices.
    Informational only - no database needed.
    """
    return render_template('trust/security.html')

@trust_bp.route('/trust/verification_policy')
def verification_policy():
    """
    Verification policy page.
    Explains 3 verification levels and FAQ.
    Informational only - no database needed.
    """
    return render_template('trust/verification_policy.html')

@trust_bp.route('/trust/data_protection')
def data_protection():
    """
    Data protection and user rights page.
    Explains what data is collected, how it's used, and user rights.
    Informational only - no database needed.
    """
    return render_template('trust/data_protection.html')
