from flask import Blueprint

connections_bp = Blueprint('connections', __name__)

from . import routes  # noqa: E402, F401
