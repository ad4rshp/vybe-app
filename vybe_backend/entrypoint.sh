#!/bin/sh

# Run database migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Automatically create a superuser if environment variables are set
if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Checking/creating superuser..."
    python manage.py createsuperuser --noinput || echo "Superuser creation skipped (it may already exist)."
fi

# Start the Daphne ASGI server
echo "Starting Daphne..."
exec daphne -b 0.0.0.0 -p 8000 vybe_backend.asgi:application
