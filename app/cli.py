"""
Campus Connect — CLI Commands
Register by calling register_commands(app) inside create_app().
"""

import click
from datetime import datetime, timezone
from flask import Blueprint

cli_bp = Blueprint("cli", __name__)


@cli_bp.cli.command("prune-otps")
def prune_otps():
    """Delete expired and used OTP records.
    
    Run via Heroku Scheduler hourly: flask prune-otps
    """
    from app.extensions import db
    from app.models import OTPVerification

    now = datetime.now(timezone.utc)
    deleted = (
        OTPVerification.query
        .filter(
            (OTPVerification.expiry_time < now) |
            (OTPVerification.is_used is True)
        )
        .delete(synchronize_session=False)
    )
    db.session.commit()
    click.echo(f"[prune-otps] Deleted {deleted} stale OTP record(s).")
