import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vybe_backend.settings')
django.setup()

from chat.socket_server import sio
import socketio

django_asgi_app = get_asgi_application()

# Wrap ASGI application with socket.io ASGI app.
# It automatically routes /socket.io requests to the socket.io server and others to Django.
application = socketio.ASGIApp(sio, other_asgi_app=django_asgi_app)
