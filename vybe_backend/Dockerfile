FROM python:3.12-slim

# Set environment variable to make output stream unbuffered
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies needed for building packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . /app/

EXPOSE 8000

# Run using Daphne ASGI
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "vybe_backend.asgi:application"]
