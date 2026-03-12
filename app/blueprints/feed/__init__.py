from flask import Blueprint

feed_bp = Blueprint('feed', __name__)

from . import routes  # noqa: E402, F401
