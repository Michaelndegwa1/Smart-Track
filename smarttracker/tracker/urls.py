from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("api/sessions/today/", views.sessions_today),
    path("api/sessions/recent/", views.sessions_recent),
    path("api/summary/today/", views.summary_today),
    path("api/summary/last7/", views.summary_last7),
    path("api/summary/avg_hours_per_day/", views.avg_hours_per_day),
    path("api/summary/total_all/", views.total_all),
]
