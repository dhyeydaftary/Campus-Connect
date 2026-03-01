"""
Support Blueprint — Placeholder routes for legal, support, and trust pages.
"""

from flask import Blueprint, render_template

support_bp = Blueprint('support', __name__)


@support_bp.route("/privacy-policy")
def privacy_policy():
    """Renders the privacy policy page."""
    return render_template("legal/privacy_policy.html")


@support_bp.route("/terms-of-use")
def terms_of_use():
    """Renders the terms of use page."""
    return render_template("legal/terms_of_use.html")


@support_bp.route("/contact-support")
def contact_support():
    """Renders the contact support page."""
    return render_template("support/contact_support.html")


@support_bp.route("/help-center")
def help_center():
    """Renders the help center page."""
    return render_template("support/help_center.html")


@support_bp.route("/report-issue")
def report_issue():
    """Renders the report issue page."""
    return render_template("support/report_issue.html")


@support_bp.route("/data-protection")
def data_protection():
    """Renders the data protection page."""
    return render_template("trust/data_protection.html")


@support_bp.route("/security")
def security():
    """Renders the security page."""
    return render_template("trust/security.html")


@support_bp.route("/verification-policy")
def verification_policy():
    """Renders the verification policy page."""
    return render_template("trust/verification_policy.html")
