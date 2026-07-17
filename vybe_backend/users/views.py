from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from datetime import timedelta
import uuid
from django.db import transaction, models
from .authentication import HasViewPermission

from .models import EmailVerification, UserRole, AccountStatus, CreditTransaction, TransactionType, SuspendedIp, Friendship, FriendshipStatus, DirectMessage
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserSerializer,
    AdminUserListSerializer
)

User = get_user_model()

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

def is_ip_suspended(ip):
    if not ip:
        return False
    return SuspendedIp.objects.filter(ip_address=ip, suspended_until__gt=timezone.now()).exists()

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    # Include custom claims
    refresh['username'] = user.username
    refresh['role'] = user.role
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        ip = get_client_ip(request)
        if is_ip_suspended(ip):
            return Response({
                "error": "IP_SUSPENDED",
                "message": "This IP address is currently suspended."
            }, status=status.HTTP_403_FORBIDDEN)
            
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Auto-friend and welcome announcement from bot
            try:
                bot_user, _ = User.objects.get_or_create(
                    username='vybe_bot',
                    defaults={
                        'email': 'bot@vybe.chat',
                        'role': UserRole.TEAM,
                        'email_verified': True,
                        'credits': 999999
                    }
                )
                Friendship.objects.get_or_create(user=user, friend=bot_user, defaults={'status': FriendshipStatus.ACCEPTED})
                Friendship.objects.get_or_create(user=bot_user, friend=user, defaults={'status': FriendshipStatus.ACCEPTED})
                DirectMessage.objects.create(
                    sender=bot_user,
                    recipient=user,
                    text="Welcome to VYBE! 🚀 We are thrilled to have you here. This is the official announcement channel.\n\nYou can chat with me! Type `/help` to see commands, or start matching with other users!"
                )
            except Exception as e:
                logger.error(f"Error auto-friending bot during registration: {e}")
            
            # Create verification token
            expires_at = timezone.now() + timedelta(hours=24)
            verification = EmailVerification.objects.create(
                user=user,
                expires_at=expires_at
            )
            
            # Send verification link (prints to console per EMAIL_BACKEND setting)
            import os
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            verification_url = f"{frontend_url}/verify-email?token={verification.token}"
            send_mail(
                subject="Verify Your VYBE Account",
                message=f"Hello {user.username},\n\nPlease verify your account by clicking the link: {verification_url}",
                from_email="no-reply@vybe.chat",
                recipient_list=[user.email],
                fail_silently=True,
            )
            
            return Response({
                "message": "Registration successful. A verification link has been sent to your email."
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class LoginRateThrottle(AnonRateThrottle):
    rate = '10/minute'

class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        ip = get_client_ip(request)
        if is_ip_suspended(ip):
            return Response({
                "error": "IP_SUSPENDED",
                "message": "This IP address is currently suspended."
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Check email verification status
            if not user.email_verified:
                return Response({
                    "error": "EMAIL_UNVERIFIED",
                    "message": "Please verify your email before logging in."
                }, status=status.HTTP_403_FORBIDDEN)
                
            # Log login time and IP
            user.last_login = timezone.now()
            user.last_login_ip = ip
            user.save()
            
            tokens = get_tokens_for_user(user)
            response = Response({
                "message": "Login successful",
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": tokens['access'],
                    "refresh": tokens['refresh'],
                }
            }, status=status.HTTP_200_OK)
            
            # Set access and refresh tokens in HttpOnly, Secure cookies
            secure = not settings.DEBUG
            response.set_cookie(
                key='access_token',
                value=tokens['access'],
                httponly=True,
                secure=secure,
                samesite='Lax'
            )
            response.set_cookie(
                key='refresh_token',
                value=tokens['refresh'],
                httponly=True,
                secure=secure,
                samesite='Lax'
            )
            return response
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        response = Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response

class VerifyEmailView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            verification = EmailVerification.objects.get(token=token)
            if verification.is_expired():
                return Response({"detail": "Verification link has expired."}, status=status.HTTP_400_BAD_REQUEST)
                
            user = verification.user
            user.email_verified = True
            user.save()
            
            # Delete token
            verification.delete()
            
            return Response({"detail": "Email verified successfully. You can now log in."}, status=status.HTTP_200_OK)
        except EmailVerification.DoesNotExist:
            return Response({"detail": "Invalid verification token."}, status=status.HTTP_400_BAD_REQUEST)

class ResendVerificationView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(email__iexact=email)
            if user.email_verified:
                return Response({"detail": "Email is already verified."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Delete stale tokens
            EmailVerification.objects.filter(user=user).delete()
            
            # Create new token
            expires_at = timezone.now() + timedelta(hours=24)
            verification = EmailVerification.objects.create(
                user=user,
                expires_at=expires_at
            )
            
            # Send
            import os
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            verification_url = f"{frontend_url}/verify-email?token={verification.token}"
            send_mail(
                subject="Verify Your VYBE Account",
                message=f"Hello {user.username},\n\nPlease verify your account by clicking the link: {verification_url}",
                from_email="no-reply@vybe.chat",
                recipient_list=[user.email],
                fail_silently=True,
            )
            
            return Response({"detail": "Verification email resent successfully."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            # Return same success message for security/privacy
            return Response({"detail": "Verification email resent successfully."}, status=status.HTTP_200_OK)

class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        username = request.data.get('username')
        password = request.data.get('password')
        
        if username:
            if User.objects.exclude(id=user.id).filter(username__iexact=username).exists():
                return Response({"username": "Username already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username
            
        if password:
            user.set_password(password)
            
        # Support V1.5 gender updates
        gender = request.data.get('gender')
        gender_filter = request.data.get('gender_filter')
        
        if gender:
            if gender in ['MALE', 'FEMALE', 'UNSPECIFIED']:
                user.gender = gender
                
        if gender_filter:
            if gender_filter in ['MALE', 'FEMALE', 'ALL']:
                user.gender_filter = gender_filter

        match_mode = request.data.get('match_mode')
        if match_mode:
            if match_mode in ['VIDEO', 'TEXT']:
                user.match_mode = match_mode

        # Validate and save profile picture base64 string
        if 'profile_picture' in request.data:
            profile_picture = request.data.get('profile_picture')
            if profile_picture:
                if not (profile_picture.startswith('data:image/png;base64,') or 
                        profile_picture.startswith('data:image/jpeg;base64,') or 
                        profile_picture.startswith('data:image/jpg;base64,')):
                    return Response({"profile_picture": "Only JPG and PNG images are allowed."}, status=status.HTTP_400_BAD_REQUEST)
                
                if len(profile_picture) > 3 * 1024 * 1024:
                    return Response({"profile_picture": "Image file is too large. Max size is 2MB."}, status=status.HTTP_400_BAD_REQUEST)
                    
                user.profile_picture = profile_picture
            else:
                user.profile_picture = None
            
        user.save()
        return Response(UserSerializer(user).data)

# ADMIN & TEAM ACCESS VIEWS
class UserSearchView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasViewPermission)
    required_permission = 'reports.view'

    def get(self, request):
        query = request.query_params.get('q', '')
        filter_status = request.query_params.get('status', '')
        filter_verified = request.query_params.get('verified', '')
        
        users = User.objects.all()
        if query:
            # Group or filter queries properly using Q to prevent cross-filter contamination
            from django.db.models import Q
            q_filter = Q(username__icontains=query) | Q(email__icontains=query)
            if query.isdigit():
                q_filter = q_filter | Q(id=int(query))
            users = users.filter(q_filter)
            
        if filter_status:
            users = users.filter(account_status=filter_status)
        if filter_verified:
            users = users.filter(email_verified=(filter_verified.lower() == 'true'))
            
        serializer = AdminUserListSerializer(users.order_by('-date_joined'), many=True)
        return Response(serializer.data)

class AdminTeamManagementView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasViewPermission)
    required_permission = 'team.manage'

    def get(self, request):
        # Get all team members and admins
        team_members = User.objects.filter(role__in=[UserRole.TEAM, UserRole.ADMIN]).order_by('-date_joined')
        
        data = [{
            "id": member.id,
            "username": member.username,
            "role": member.role,
            "created_at": member.date_joined
        } for member in team_members]
        
        return Response(data)

    def post(self, request):
        # Promote / Demote
        user_id = request.data.get('user_id')
        action = request.data.get('action') # 'promote' or 'demote'
        
        try:
            target_user = User.objects.get(id=user_id)
            if target_user.role == UserRole.ADMIN:
                return Response({"detail": "Cannot modify Admin role."}, status=status.HTTP_400_BAD_REQUEST)
                
            if action == 'promote':
                target_user.role = UserRole.TEAM
                target_user.save()
                return Response({"detail": f"{target_user.username} promoted to Team Member."}, status=status.HTTP_200_OK)
            elif action == 'demote':
                target_user.role = UserRole.USER
                target_user.save()
                return Response({"detail": f"{target_user.username} demoted to normal User."}, status=status.HTTP_200_OK)
            else:
                return Response({"detail": "Invalid action. Use 'promote' or 'demote'."}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

class AdminGrantCreditsView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasViewPermission)
    required_permission = 'settings.edit'

    def post(self, request):
        user_id = request.data.get('user_id')
        amount = request.data.get('amount', 0)
        
        try:
            amount = int(amount)
            if amount == 0 or amount < -10000 or amount > 10000:
                return Response({"detail": "Amount must be between -10000 and 10000 (excluding 0)."}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                target_user = User.objects.select_for_update().get(id=user_id)
                if target_user.credits + amount < 0:
                    return Response({"detail": "Deduction cannot exceed target user's current balance."}, status=status.HTTP_400_BAD_REQUEST)
                
                target_user.credits += amount
                target_user.save(update_fields=['credits'])
                
                tx_type = TransactionType.ADMIN_GRANT if amount > 0 else TransactionType.ADMIN_DEDUCT
                CreditTransaction.objects.create(
                    user=target_user,
                    amount=amount,
                    balance_after=target_user.credits,
                    transaction_type=tx_type
                )
                
            action_str = "Granted" if amount > 0 else "Deducted"
            return Response({
                "detail": f"{action_str} {abs(amount)} tokens to {target_user.username}. New balance: {target_user.credits}",
                "new_balance": target_user.credits
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)


class FriendshipView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        
        # Accepted friends list
        friendships = Friendship.objects.filter(user=user, status=FriendshipStatus.ACCEPTED)
        friends = []
        for f in friendships:
            friends.append({
                "id": f.friend.id,
                "username": f.friend.username,
                "email": f.friend.email,
                "role": f.friend.role,
                "credits": f.friend.credits
            })
            
        # Pending requests received
        pending_received = Friendship.objects.filter(friend=user, status=FriendshipStatus.PENDING)
        received_list = []
        for f in pending_received:
            received_list.append({
                "id": f.id,
                "sender_id": f.user.id,
                "sender_username": f.user.username,
                "created_at": f.created_at
            })
            
        # Pending requests sent
        pending_sent = Friendship.objects.filter(user=user, status=FriendshipStatus.PENDING)
        sent_list = []
        for f in pending_sent:
            sent_list.append({
                "id": f.id,
                "recipient_id": f.friend.id,
                "recipient_username": f.friend.username,
                "created_at": f.created_at
            })
            
        return Response({
            "friends": friends,
            "pending_received": received_list,
            "pending_sent": sent_list
        }, status=status.HTTP_200_OK)


class SendFriendRequestView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        sender = request.user
        username = request.data.get('username')
        
        if not username:
            return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        if sender.username.lower() == username.lower():
            return Response({"detail": "You cannot send a friend request to yourself."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            recipient = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return Response({"detail": f"User '{username}' not found."}, status=status.HTTP_404_NOT_FOUND)
            
        # Check if already friends or request pending
        existing = Friendship.objects.filter(user=sender, friend=recipient).first()
        if existing:
            if existing.status == FriendshipStatus.ACCEPTED:
                return Response({"detail": "You are already friends with this user."}, status=status.HTTP_400_BAD_REQUEST)
            elif existing.status == FriendshipStatus.PENDING:
                return Response({"detail": "Friend request already sent and pending."}, status=status.HTTP_400_BAD_REQUEST)
                
        # Create pending friendship record
        friendship = Friendship.objects.create(
            user=sender,
            friend=recipient,
            status=FriendshipStatus.PENDING
        )
        
        return Response({
            "id": friendship.id,
            "recipient": recipient.username,
            "status": friendship.status
        }, status=status.HTTP_201_CREATED)


class RespondFriendRequestView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        request_id = request.data.get('request_id')
        action = request.data.get('action') # 'ACCEPT' or 'REJECT'
        
        if not request_id or not action:
            return Response({"detail": "request_id and action are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        if action not in ['ACCEPT', 'REJECT']:
            return Response({"detail": "Action must be ACCEPT or REJECT."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            friendship_req = Friendship.objects.get(id=request_id, friend=user, status=FriendshipStatus.PENDING)
        except Friendship.DoesNotExist:
            return Response({"detail": "Pending friend request not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if action == 'ACCEPT':
            friendship_req.status = FriendshipStatus.ACCEPTED
            friendship_req.save()
            
            Friendship.objects.update_or_create(
                user=user,
                friend=friendship_req.user,
                defaults={'status': FriendshipStatus.ACCEPTED}
            )
            return Response({"detail": f"Friend request from {friendship_req.user.username} accepted."}, status=status.HTTP_200_OK)
            
        else:
            friendship_req.delete()
            return Response({"detail": f"Friend request from {friendship_req.user.username} declined."}, status=status.HTTP_200_OK)


class DirectMessageView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        friend_id = request.query_params.get('friend_id')
        
        if not friend_id:
            return Response({"detail": "friend_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            friend = User.objects.get(id=friend_id)
        except User.DoesNotExist:
            return Response({"detail": "Friend not found."}, status=status.HTTP_404_NOT_FOUND)
            
        messages = DirectMessage.objects.filter(
            models.Q(sender=user, recipient=friend) | models.Q(sender=friend, recipient=user)
        ).order_by('created_at')
        
        DirectMessage.objects.filter(sender=friend, recipient=user, is_read=False).update(is_read=True)
        
        data = []
        for m in messages:
            data.append({
                "id": m.id,
                "sender_id": m.sender.id,
                "sender_username": m.sender.username,
                "recipient_id": m.recipient.id,
                "text": m.text,
                "is_read": m.is_read,
                "created_at": m.created_at
            })
            
        return Response(data, status=status.HTTP_200_OK)


class SendDirectMessageView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        sender = request.user
        recipient_id = request.data.get('recipient_id')
        text = request.data.get('text')
        
        if not recipient_id or not text:
            return Response({"detail": "recipient_id and text are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            recipient = User.objects.get(id=recipient_id)
        except User.DoesNotExist:
            return Response({"detail": "Recipient not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if recipient.username != 'vybe_bot':
            friends_exist = Friendship.objects.filter(user=sender, friend=recipient, status=FriendshipStatus.ACCEPTED).exists()
            if not friends_exist:
                return Response({"detail": "You can only message accepted friends."}, status=status.HTTP_403_FORBIDDEN)
                
        message = DirectMessage.objects.create(
            sender=sender,
            recipient=recipient,
            text=text
        )
        
        response_data = {
            "id": message.id,
            "sender_id": sender.id,
            "sender_username": sender.username,
            "recipient_id": recipient.id,
            "text": message.text,
            "created_at": message.created_at
        }
        
        if recipient.username == 'vybe_bot':
            query = text.strip().lower()
            reply_text = ""
            
            if query == '/help':
                reply_text = (
                    "Here are the commands I support:\n"
                    "  • `/help` - Show list of available commands\n"
                    "  • `/balance` - Display your current token balance\n"
                    "  • `/credits` - Show coin stats\n"
                    "  • `/joke` - Get a randomized tech joke!\n"
                    "  • `/about` - About VYBE Platform"
                )
            elif query in ['/balance', '/credits']:
                reply_text = f"You currently have {sender.credits} credits! Use them to set gender preferences during matches."
            elif query == '/joke':
                import random
                jokes = [
                    "Why do programmers wear glasses? Because they can't C#!",
                    "There are 10 types of people in the world: those who understand binary, and those who don't.",
                    "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
                    "['hip', 'hip'] (hip hip array!)"
                ]
                reply_text = random.choice(jokes)
            elif query == '/about':
                reply_text = "VYBE is a secure, premium random matching video & text chat application optimized with custom WebRTC peer-to-peer protocols."
            else:
                reply_text = "Hello! I am the official VYBE Announcement Bot. Type `/help` to see the commands I support!"
                
            DirectMessage.objects.create(
                sender=recipient,
                recipient=sender,
                text=reply_text
            )
            
        return Response(response_data, status=status.HTTP_201_CREATED)


class AdminAnnouncementView(APIView):
    permission_classes = (permissions.IsAuthenticated, HasViewPermission)
    required_permission = 'settings.edit'

    def post(self, request):
        text = request.data.get('text')
        if not text:
            return Response({"detail": "Announcement text is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        bot_user, _ = User.objects.get_or_create(
            username='vybe_bot',
            defaults={
                'email': 'bot@vybe.chat',
                'role': UserRole.TEAM,
                'email_verified': True,
                'credits': 999999
            }
        )
        
        users = User.objects.exclude(username='vybe_bot')
        
        count = 0
        for u in users:
            DirectMessage.objects.create(
                sender=bot_user,
                recipient=u,
                text=f"[ANNOUNCEMENT] 📢\n{text}"
            )
            count += 1
            
        return Response({"detail": f"Announcement successfully dispatched to {count} users."}, status=status.HTTP_200_OK)


