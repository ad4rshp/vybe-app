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

# Make the entrypoint script executable
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

# Use the entrypoint script to run migrations and start Daphne
ENTRYPOINT ["/app/entrypoint.sh"]
