from django.urls import path
from .views import (
    ReportCreateView,
    ReportListView,
    ReportDetailView,
    ReportResolveView,
    WarnUserView,
    SuspendUserView,
    BanUserView,
    UnsuspendUserView,
    UnbanUserView,
    StatsDashboardView,
    TelemetryEventCreateView
)

urlpatterns = [
    path('reports/create/', ReportCreateView.as_view(), name='report-create'),
    path('reports/', ReportListView.as_view(), name='report-list'),
    path('reports/<int:pk>/', ReportDetailView.as_view(), name='report-detail'),
    path('reports/<int:pk>/resolve/', ReportResolveView.as_view(), name='report-resolve'),
    
    path('moderation/warn/', WarnUserView.as_view(), name='moderation-warn'),
    path('moderation/suspend/', SuspendUserView.as_view(), name='moderation-suspend'),
    path('moderation/unsuspend/', UnsuspendUserView.as_view(), name='moderation-unsuspend'),
    
    path('moderation/ban/', BanUserView.as_view(), name='moderation-ban'),
    path('moderation/unban/', UnbanUserView.as_view(), name='moderation-unban'),
    
    path('moderation/stats/', StatsDashboardView.as_view(), name='moderation-stats'),
    path('telemetry/', TelemetryEventCreateView.as_view(), name='telemetry-create'),
]
