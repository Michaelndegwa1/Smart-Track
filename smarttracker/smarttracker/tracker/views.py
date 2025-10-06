from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import datetime, timedelta
import json

from .models import SocialMediaSession, GPACourse, GPACalculation, TimeAnalysis
from .utils import (
    calc_gpa, get_sessions_for_date, get_recent_sessions, get_totals_for_date,
    get_totals_last_n_days, get_avg_hours_per_day, get_total_all_time,
    get_platform_hours_in_window, build_recommendations, load_sample_scores,
    semester_gpa, correlate_time_gpa, ORDERED_GRADES
)


def dashboard(request):
    """Main dashboard view"""
    return render(request, 'tracker/dashboard.html', {
        'grade_options': ORDERED_GRADES,
        'timezone': 'Europe/London'  # You can make this configurable
    })


# API Endpoints for Tracker
def health_check(request):
    """Health check endpoint"""
    return JsonResponse({
        'ok': True,
        'timezone': 'Europe/London',
        'timestamp': timezone.now().isoformat()
    })


def sessions_today(request):
    """Get sessions for today"""
    today = datetime.now().date()
    sessions = get_sessions_for_date(str(today))
    return JsonResponse(sessions, safe=False)


def sessions_recent(request):
    """Get recent sessions"""
    limit = int(request.GET.get('limit', 10))
    limit = max(1, min(limit, 50))  # Clamp between 1 and 50
    sessions = get_recent_sessions(limit)
    return JsonResponse(sessions, safe=False)


def summary_today(request):
    """Get today's summary"""
    today = datetime.now().date()
    totals = get_totals_for_date(str(today))
    return JsonResponse({
        'date': str(today),
        'totals': {k: round(v, 1) for k, v in totals.items()}
    })


def summary_last7(request):
    """Get last 7 days summary"""
    data = get_totals_last_n_days(7)
    return JsonResponse(data, safe=False)


def avg_hours_per_day(request):
    """Get average hours per day"""
    data = get_avg_hours_per_day()
    return JsonResponse(data)


def total_all(request):
    """Get total time across all platforms"""
    data = get_total_all_time()
    return JsonResponse(data)


# GPA Calculator API
@csrf_exempt
@require_http_methods(["POST"])
def api_calc_gpa(request):
    """Calculate GPA from course data"""
    try:
        data = json.loads(request.body)
        courses = data.get('courses', [])
        custom_scale = data.get('custom_scale')
        
        result = calc_gpa(courses, custom_scale)
        return JsonResponse(result)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# Analysis API
def api_analysis_run(request):
    """Run time vs GPA analysis"""
    try:
        cat_weight = float(request.GET.get('cat', 0.4))
        exam_weight = float(request.GET.get('exam', 0.6))
        
        if abs(cat_weight + exam_weight - 1.0) > 0.001:
            return JsonResponse({
                'error': 'cat + exam must equal 1.0'
            }, status=400)
        
        # Load sample scores (in real implementation, this would load from CSV)
        scores_df = load_sample_scores()
        gpa_df = semester_gpa(scores_df, cat_weight, exam_weight)
        result_df = correlate_time_gpa(gpa_df)
        
        semesters = []
        for _, row in gpa_df.iterrows():
            start_date = str(row['start'])
            end_date = str(row['end'])
            totals_sec, avg_hours_day, days = get_platform_hours_in_window(start_date, end_date)
            recs = build_recommendations(row['gpa'], avg_hours_day, days)
            
            semesters.append({
                'semester_id': row['semester_id'],
                'start': start_date,
                'end': end_date,
                'gpa': row['gpa'],
                'platform_totals_sec': totals_sec,
                'avg_hours_per_day': avg_hours_day,
                'days_seen': days,
                'recommendations': recs
            })
        
        return JsonResponse({
            'gpa_by_semester': gpa_df.to_dict(orient='records'),
            'time_vs_gpa': result_df.to_dict(orient='records'),
            'semesters': semesters,
            'note': 'avg_hours_per_day is computed over distinct days present in the window'
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# Session Management
@csrf_exempt
@require_http_methods(["POST"])
def add_session(request):
    """Add a new social media session"""
    try:
        data = json.loads(request.body)
        
        session = SocialMediaSession.objects.create(
            platform=data['platform'],
            time_seconds=float(data['time_seconds']),
            date=data.get('date', datetime.now().date()),
            start_timestamp=datetime.fromisoformat(data['start_timestamp']),
            end_timestamp=datetime.fromisoformat(data['end_timestamp'])
        )
        
        return JsonResponse({
            'id': session.id,
            'platform': session.platform,
            'time_seconds': session.time_seconds,
            'date': str(session.date),
            'start_timestamp': session.start_timestamp.isoformat(),
            'end_timestamp': session.end_timestamp.isoformat()
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_session(request, session_id):
    """Delete a social media session"""
    try:
        session = SocialMediaSession.objects.get(id=session_id)
        session.delete()
        return JsonResponse({'success': True})
    
    except SocialMediaSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# GPA Course Management
@csrf_exempt
@require_http_methods(["POST"])
def add_gpa_course(request):
    """Add a new GPA course"""
    try:
        data = json.loads(request.body)
        
        course = GPACourse.objects.create(
            name=data.get('name', ''),
            credits=float(data['credits']),
            grade=data['grade'],
            semester=data.get('semester', '')
        )
        
        return JsonResponse({
            'id': course.id,
            'name': course.name,
            'credits': course.credits,
            'grade': course.grade,
            'semester': course.semester
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_gpa_course(request, course_id):
    """Delete a GPA course"""
    try:
        course = GPACourse.objects.get(id=course_id)
        course.delete()
        return JsonResponse({'success': True})
    
    except GPACourse.DoesNotExist:
        return JsonResponse({'error': 'Course not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def get_gpa_courses(request):
    """Get all GPA courses"""
    courses = GPACourse.objects.all().order_by('-created_at')
    data = [
        {
            'id': course.id,
            'name': course.name,
            'credits': course.credits,
            'grade': course.grade,
            'semester': course.semester,
            'created_at': course.created_at.isoformat()
        }
        for course in courses
    ]
    return JsonResponse(data, safe=False)