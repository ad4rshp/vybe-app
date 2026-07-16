from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import uuid

class UserRole(models.TextChoices):
    USER = 'USER', 'User'
    TEAM = 'TEAM', 'Team'
    ADMIN = 'ADMIN', 'Admin'

class AccountStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    BANNED = 'BANNED', 'Banned'

class User(AbstractUser):
    # Overwrite email to make it unique and required
    email = models.EmailField(unique=True)
    
    email_verified = models.BooleanField(default=False)
    role = models.CharField(
        max_length=10,
        choices=UserRole.choices,
        default=UserRole.USER
    )
    account_status = models.CharField(
        max_length=10,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE
    )
    suspended_until = models.DateTimeField(null=True, blank=True)
    
    # V1.5 Matching Gender Filter additions
    gender = models.CharField(
        max_length=15,
        choices=[('MALE', 'Male'), ('FEMALE', 'Female'), ('UNSPECIFIED', 'Unspecified')],
        default='UNSPECIFIED'
    )
    gender_filter = models.CharField(
        max_length=15,
        choices=[('MALE', 'Male'), ('FEMALE', 'Female'), ('ALL', 'All')],
        default='ALL'
    )
    match_mode = models.CharField(
        max_length=15,
        choices=[('VIDEO', 'Video & Audio'), ('TEXT', 'Text Only')],
        default='VIDEO'
    )
    last_login_ip = models.CharField(max_length=45, null=True, blank=True)
    profile_picture = models.TextField(null=True, blank=True)
    
    # Credit / Token economy
    credits = models.IntegerField(default=100)
    
    # Track update time (created_at is already handled by date_joined in AbstractUser)
    updated_at = models.DateTimeField(auto_now=True)
    
    @property
    def is_suspended(self):
        if self.account_status == AccountStatus.SUSPENDED:
            if self.suspended_until and self.suspended_until > timezone.now():
                return True
            # If suspension expired, restore status
            self.account_status = AccountStatus.ACTIVE
            self.suspended_until = None
            self.save()
        return False

    @property
    def is_banned(self):
        return self.account_status == AccountStatus.BANNED

    def has_permission(self, perm):
        if self.role == UserRole.ADMIN:
            return True
        perms = ROLE_PERMISSIONS.get(self.role, set())
        return perm in perms

    def __str__(self):
        return self.username

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(credits__gte=0), name='non_negative_credits')
        ]

ROLE_PERMISSIONS = {
    'ADMIN': {
        'chat.use', 'reports.view', 'reports.resolve', 
        'users.suspend', 'users.ban', 'team.manage', 
        'analytics.view', 'settings.edit'
    },
    'TEAM': {
        'chat.use', 'reports.view', 'reports.resolve', 
        'users.suspend', 'analytics.view'
    },
    'USER': {
        'chat.use'
    }
}

class EmailVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    token = models.CharField(max_length=255, unique=True, default=uuid.uuid4)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Verification for {self.user.username}"

class TransactionType(models.TextChoices):
    WELCOME_BONUS = 'WELCOME_BONUS', 'Welcome Bonus'
    FILTER_MATCH = 'FILTER_MATCH', 'Filter Match'
    ADMIN_GRANT = 'ADMIN_GRANT', 'Admin Grant'
    ADMIN_DEDUCT = 'ADMIN_DEDUCT', 'Admin Deduct'
    PURCHASE = 'PURCHASE', 'Purchase'
    REFUND = 'REFUND', 'Refund'

class CreditTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credit_transactions')
    amount = models.IntegerField()
    balance_after = models.IntegerField()
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    reference_id = models.CharField(max_length=255, null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'transaction_type', 'reference_id'],
                condition=models.Q(transaction_type='FILTER_MATCH'),
                name='unique_filter_match_charge'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'transaction_type']),
            models.Index(fields=['reference_id']),
        ]

    def __str__(self):
        return f"Tx {self.id} for {self.user.username}: {self.amount} ({self.transaction_type})"


class SuspendedIp(models.Model):
    ip_address = models.CharField(max_length=45, unique=True)
    suspended_until = models.DateTimeField()
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Suspended IP: {self.ip_address} until {self.suspended_until}"


class FriendshipStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    REJECTED = 'REJECTED', 'Rejected'


class Friendship(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships')
    friend = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_friendships')
    status = models.CharField(max_length=15, choices=FriendshipStatus.choices, default=FriendshipStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'friend'], name='unique_friendship')
        ]

    def __str__(self):
        return f"{self.user.username} - {self.friend.username} ({self.status})"


class DirectMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    text = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg from {self.sender.username} to {self.recipient.username}: {self.text[:30]}"


