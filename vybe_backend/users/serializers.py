from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import EmailVerification, UserRole, AccountStatus
import datetime

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'account_status', 'email_verified', 'suspended_until', 'gender', 'gender_filter', 'match_mode', 'credits', 'profile_picture')
        read_only_fields = ('id', 'role', 'account_status', 'email_verified', 'suspended_until', 'credits')

class UserRegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserLoginSerializer(serializers.Serializer):
    username_or_email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username_or_email = data.get('username_or_email')
        password = data.get('password')
        
        # Support both username and email login
        user = User.objects.filter(username__iexact=username_or_email).first()
        if not user:
            user = User.objects.filter(email__iexact=username_or_email).first()

        if user and user.check_password(password):
            # Check if banned
            if user.is_banned:
                raise serializers.ValidationError("This account has been permanently banned.")
            
            # Check if suspended
            if user.is_suspended:
                raise serializers.ValidationError(
                    f"This account has been suspended until {user.suspended_until.strftime('%Y-%m-%d %H:%M:%S UTC')}."
                )
                
            return {'user': user}
            
        raise serializers.ValidationError("Invalid credentials.")

class AdminUserListSerializer(serializers.ModelSerializer):
    total_reports = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'account_status', 'email_verified', 'suspended_until', 'created_at', 'total_reports', 'credits')

    def get_total_reports(self, obj):
        return obj.received_reports.count()
