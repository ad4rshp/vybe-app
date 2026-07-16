#!/bin/bash
# VYBE Postgres Database Backup Script

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="vybe"
CONTAINER_NAME="vybe_postgres"
USER="vybe_user"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting Postgres backup for database '$DATABASE_NAME'..."

# Execute pg_dump inside postgres container and gzip output
docker exec -t "$CONTAINER_NAME" pg_dump -U "$USER" "$DATABASE_NAME" | gzip > "$BACKUP_DIR/vybe_backup_$TIMESTAMP.sql.gz"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully: $BACKUP_DIR/vybe_backup_$TIMESTAMP.sql.gz"
else
    echo "Error: Database backup failed!"
    exit 1
fi

# Rotate backups: delete those older than 7 days
echo "Rotating old backups..."
find "$BACKUP_DIR" -type f -name "vybe_backup_*.sql.gz" -mtime +7 -delete

echo "Postgres backup process finished."
