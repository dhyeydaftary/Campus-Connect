from flask import Blueprint

trust_bp = Blueprint('trust', __name__)

from . import routes  # noqa: E402, F401
