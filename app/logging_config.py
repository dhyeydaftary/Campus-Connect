"""
Logging configuration for Campus Connect.
Sets up a RotatingFileHandler for production error logging.
"""

import os
import logging
from logging.handlers import RotatingFileHandler


def configure_logging(app):
    """
    Configures application logging.
    Only writes to file in production mode (not debug and not testing).
    """
    # Remove default handlers to avoid duplicate logs if needed
    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    # Basic console logging for all environments
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    console_handler.setLevel(logging.INFO)
    app.logger.addHandler(console_handler)

    if not app.debug and not app.testing:
        if not os.path.exists('logs'):
            os.mkdir('logs')

        # 10MB max size, keep 10 backups
        file_handler = RotatingFileHandler(
            'logs/app.log',
            maxBytes=10485760,
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '[%(asctime)s] %(levelname)s in %(pathname)s:%(lineno)d: %(message)s'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)

    app.logger.setLevel(logging.INFO)
    app.logger.info('Campus Connect startup')
