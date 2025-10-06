from django.urls import path
from . import views

urlpatterns = [
    # Main dashboard
    path('', views.dashboard, name='dashboard'),
    
    # Health check
    path('health/', views.health_check, name='health'),
    
    # Session endpoints
    path('sessions/today/', views.sessions_today, name='sessions_today'),
    path('sessions/recent/', views.sessions_recent, name='sessions_recent'),
    path('sessions/add/', views.add_session, name='add_session'),
    path('sessions/<int:session_id>/delete/', views.delete_session, name='delete_session'),
    
    # Summary endpoints
    path('summary/today/', views.summary_today, name='summary_today'),
    path('summary/last7/', views.summary_last7, name='summary_last7'),
    path('summary/avg_hours_per_day/', views.avg_hours_per_day, name='avg_hours_per_day'),
    path('summary/total_all/', views.total_all, name='total_all'),
    
    # GPA Calculator endpoints
    path('api/calc/', views.api_calc_gpa, name='api_calc_gpa'),
    path('gpa/courses/', views.get_gpa_courses, name='get_gpa_courses'),
    path('gpa/courses/add/', views.add_gpa_course, name='add_gpa_course'),
    path('gpa/courses/<int:course_id>/delete/', views.delete_gpa_course, name='delete_gpa_course'),
    
    # Analysis endpoints
    path('api/analysis/run/', views.api_analysis_run, name='api_analysis_run'),
]