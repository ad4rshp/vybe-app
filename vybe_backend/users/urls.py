from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    VerifyEmailView,
    ResendVerificationView,
    MeView,
    UserSearchView,
    AdminTeamManagementView,
    AdminGrantCreditsView,
    FriendshipView,
    SendFriendRequestView,
    RespondFriendRequestView,
    DirectMessageView,
    SendDirectMessageView,
    AdminAnnouncementView
)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('auth/resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
    path('users/me/', MeView.as_view(), name='me'),
    
    # Friends and DMs System
    path('friends/', FriendshipView.as_view(), name='friends-list'),
    path('friends/request/', SendFriendRequestView.as_view(), name='send-friend-request'),
    path('friends/respond/', RespondFriendRequestView.as_view(), name='respond-friend-request'),
    path('dms/', DirectMessageView.as_view(), name='dms-list'),
    path('dms/send/', SendDirectMessageView.as_view(), name='dms-send'),
    
    # Moderation search, team management & admin actions
    path('users/search/', UserSearchView.as_view(), name='user-search'),
    path('admin/team/', AdminTeamManagementView.as_view(), name='admin-team'),
    path('admin/credits/', AdminGrantCreditsView.as_view(), name='admin-credits'),
    path('admin/announcement/', AdminAnnouncementView.as_view(), name='admin-announcement'),
]
