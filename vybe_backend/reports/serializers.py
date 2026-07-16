from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Report, Warning, ModerationAction

User = get_user_model()

class ReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ('id', 'reported_user', 'reason', 'description')

    def validate(self, data):
        request = self.context.get('request')
        if request and request.user == data['reported_user']:
            raise serializers.ValidationError("You cannot report yourself.")
        return data

class ReportListSerializer(serializers.ModelSerializer):
    reported_username = serializers.CharField(source='reported_user.username', read_only=True)
    reporter_username = serializers.CharField(source='reporter.username', read_only=True)

    class Meta:
        model = Report
        fields = ('id', 'reporter', 'reporter_username', 'reported_user', 'reported_username', 'reason', 'status', 'created_at')

class ReportDetailSerializer(serializers.ModelSerializer):
    reported_username = serializers.CharField(source='reported_user.username', read_only=True)
    reporter_username = serializers.CharField(source='reporter.username', read_only=True)
    reported_status = serializers.CharField(source='reported_user.account_status', read_only=True)
    reported_prev_reports_count = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = (
            'id', 
            'reporter', 
            'reporter_username', 
            'reported_user', 
            'reported_username', 
            'reported_status', 
            'reported_prev_reports_count', 
            'reason', 
            'description', 
            'status', 
            'created_at', 
            'resolved_at', 
            'resolved_by'
        )

    def get_reported_prev_reports_count(self, obj):
        # Count all reports for this reported user EXCLUDING the current report
        return Report.objects.filter(reported_user=obj.reported_user).exclude(id=obj.id).count()
