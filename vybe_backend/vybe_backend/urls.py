from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def home_view(request):
    return JsonResponse({
        "status": "online",
        "app": "VYBE Backend API",
        "version": "1.0.0"
    })

urlpatterns = [
    path('', home_view),
    path('django-admin/', admin.site.urls), # Move standard admin to django-admin to avoid conflicts with frontend /admin
    path('api/', include('users.urls')),
    path('api/', include('reports.urls')),
    path('api/payments/', include('payments.urls')),
]
