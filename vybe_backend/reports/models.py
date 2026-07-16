from django.db import models
from django.conf import settings

class ReportReason(models.TextChoices):
    INAPPROPRIATE = 'INAPPROPRIATE', 'Inappropriate Content'
    HARASSMENT = 'HARASSMENT', 'Harassment'
    SPAM = 'SPAM', 'Spam'
    UNDERAGE = 'UNDERAGE', 'Underage Concern'
    OTHER = 'OTHER', 'Other'

class ReportStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    RESOLVED = 'RESOLVED', 'Resolved'

class ModerationType(models.TextChoices):
    WARN = 'WARN', 'Warn'
    SUSPEND = 'SUSPEND', 'Suspend'
    BAN = 'BAN', 'Ban'
    UNSUSPEND = 'UNSUSPEND', 'Unsuspend'
    UNBAN = 'UNBAN', 'Unban'

class Report(models.Model):
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_reports'
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_reports'
    )
    reason = models.CharField(
        max_length=20,
        choices=ReportReason.choices
    )
    description = models.TextField(max_length=500, blank=True)
    status = models.CharField(
        max_length=10,
        choices=ReportStatus.choices,
        default=ReportStatus.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_reports'
    )

    def __str__(self):
        return f"Report {self.id} on {self.reported_user.username} by {self.reporter.username}"

class Warning(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='warnings'
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='issued_warnings'
    )
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Warning to {self.user.username} by {self.issued_by.username}"

class ModerationAction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='moderation_actions'
    )
    moderator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='actions_performed'
    )
    action = models.CharField(
        max_length=15,
        choices=ModerationType.choices
    )
    reason = models.TextField()
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} on {self.user.username} by {self.moderator.username}"

class TelemetryEvent(models.Model):
    EVENT_TYPES = [
        ('CONNECT', 'Socket Connect'),
        ('DISCONNECT', 'Socket Disconnect'),
        ('JOIN_QUEUE', 'Join Queue'),
        ('MATCH_FOUND', 'Match Found'),
        ('SKIP', 'Skip Partner'),
        ('WEBRTC_SUCCESS', 'WebRTC Successful Connection'),
        ('WEBRTC_FAIL', 'WebRTC Failed Attempt'),
    ]
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    user_id = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True) # e.g. time to match or session duration
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Telemetry {self.event_type} at {self.created_at}"
