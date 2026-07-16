from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from django.conf import settings

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        raw_token = None

        if header is None:
            # Fallback to HttpOnly cookie if header is missing
            raw_token = request.COOKIES.get('access_token')
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
        except Exception:
            return None

        # Enforce CSRF protection for cookie-based authentication if not in debug/testing
        if header is None and not settings.DEBUG:
            self.enforce_csrf(request)

        return user, validated_token

    def enforce_csrf(self, request):
        check = CSRFCheck(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied(f'CSRF Failed: {reason}')

from rest_framework import permissions

class HasViewPermission(permissions.BasePermission):
    """
    Granular permission verification checking required_permission view attribute.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        required_perm = getattr(view, 'required_permission', None)
        if not required_perm:
            return True
            
        return request.user.has_permission(required_perm)

