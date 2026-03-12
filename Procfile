release: flask db upgrade
web: gunicorn -k eventlet -w 4 wsgi:app
