from django.contrib import admin
from .models import Session

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("platform", "time_seconds", "date", "start_ts", "end_ts")
    list_filter = ("platform", "date")
    search_fields = ("platform",)
