import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from django.db.models import Sum, Count, Avg
from .models import SocialMediaSession


# GPA Calculation Utilities
DEFAULT_SCALE = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
}

ORDERED_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F']


def calc_gpa(courses_data: List[Dict], custom_scale: Optional[Dict] = None) -> Dict:
    """
    Calculate GPA from course data
    
    Args:
        courses_data: List of dicts with 'name', 'credits', 'grade' keys
        custom_scale: Optional custom grade scale
    
    Returns:
        Dict with GPA calculation results
    """
    scale = custom_scale or DEFAULT_SCALE
    total_credits = 0
    total_grade_points = 0
    rows = []
    
    for course in courses_data:
        name = course.get('name', 'Unnamed Course')
        credits = float(course.get('credits', 0))
        grade = course.get('grade', 'F')
        
        if credits <= 0:
            continue
            
        grade_points = scale.get(grade, 0.0)
        weighted_points = credits * grade_points
        
        total_credits += credits
        total_grade_points += weighted_points
        
        rows.append({
            'name': name,
            'credits': credits,
            'grade': grade,
            'explain': f"{credits} × {grade_points} = {weighted_points:.1f}"
        })
    
    gpa = total_grade_points / total_credits if total_credits > 0 else 0.0
    
    return {
        'gpa': round(gpa, 3),
        'total_credits': total_credits,
        'rows': rows
    }


# Time Analysis Utilities
def get_sessions_for_date(date_key: str) -> List[Dict]:
    """Get all sessions for a specific date"""
    sessions = SocialMediaSession.objects.filter(date=date_key).order_by('start_timestamp')
    return [
        {
            'id': session.id,
            'platform': session.platform,
            'time': session.time_seconds,
            'date': str(session.date),
            'start_ts': session.start_timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'end_ts': session.end_timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }
        for session in sessions
    ]


def get_recent_sessions(limit: int = 10) -> List[Dict]:
    """Get most recent sessions for today"""
    today = datetime.now().date()
    sessions = SocialMediaSession.objects.filter(
        date=today
    ).order_by('-end_timestamp')[:limit]
    
    return [
        {
            'id': session.id,
            'platform': session.platform,
            'time': session.time_seconds,
            'date': str(session.date),
            'start_ts': session.start_timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'end_ts': session.end_timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }
        for session in sessions
    ]


def get_totals_for_date(date_key: str) -> Dict[str, float]:
    """Get total time per platform for a specific date"""
    totals = SocialMediaSession.objects.filter(
        date=date_key
    ).values('platform').annotate(
        total_seconds=Sum('time_seconds')
    )
    
    result = {plat: 0.0 for plat in ['facebook', 'instagram', 'x', 'tiktok']}
    for item in totals:
        result[item['platform']] = float(item['total_seconds'] or 0.0)
    
    return result


def get_totals_last_n_days(n: int = 7) -> List[Dict]:
    """Get totals for the last n days"""
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=n-1)
    
    sessions = SocialMediaSession.objects.filter(
        date__range=[start_date, end_date]
    ).values('date', 'platform').annotate(
        total_seconds=Sum('time_seconds')
    ).order_by('date')
    
    return [
        {
            'date': str(item['date']),
            'platform': item['platform'],
            'seconds': float(item['total_seconds'] or 0.0)
        }
        for item in sessions
    ]


def get_avg_hours_per_day() -> Dict[str, float]:
    """Get average hours per day per platform across all dates"""
    # Get total seconds per platform
    totals = SocialMediaSession.objects.values('platform').annotate(
        total_seconds=Sum('time_seconds')
    )
    
    # Get number of distinct dates
    distinct_dates = SocialMediaSession.objects.values('date').distinct().count()
    
    result = {plat: 0.0 for plat in ['facebook', 'instagram', 'x', 'tiktok']}
    
    if distinct_dates > 0:
        for item in totals:
            platform = item['platform']
            total_seconds = float(item['total_seconds'] or 0.0)
            avg_hours = (total_seconds / distinct_dates) / 3600.0
            result[platform] = round(avg_hours, 2)
    
    return result


def get_total_all_time() -> Dict:
    """Get total time across all platforms"""
    totals = SocialMediaSession.objects.values('platform').annotate(
        total_seconds=Sum('time_seconds')
    )
    
    result = {plat: 0.0 for plat in ['facebook', 'instagram', 'x', 'tiktok']}
    for item in totals:
        result[item['platform']] = float(item['total_seconds'] or 0.0)
    
    grand_total = sum(result.values())
    
    return {
        'totals_sec': result,
        'grand_total_sec': grand_total
    }


def get_platform_hours_in_window(start_date: str, end_date: str) -> Tuple[Dict[str, float], Dict[str, float], int]:
    """Get platform hours in a date window"""
    sessions = SocialMediaSession.objects.filter(
        date__range=[start_date, end_date]
    ).values('platform').annotate(
        total_seconds=Sum('time_seconds')
    )
    
    # Count distinct days
    days = SocialMediaSession.objects.filter(
        date__range=[start_date, end_date]
    ).values('date').distinct().count()
    
    totals = {plat: 0.0 for plat in ['facebook', 'instagram', 'x', 'tiktok']}
    for item in sessions:
        totals[item['platform']] = float(item['total_seconds'] or 0.0)
    
    # Calculate averages
    avg_hours = {}
    for platform, total_seconds in totals.items():
        avg_hours[platform] = round((total_seconds / max(days, 1)) / 3600.0, 2)
    
    return totals, avg_hours, days


# Analysis and Recommendations
def build_recommendations(gpa: float, avg_hours_per_day: Dict[str, float], days: int) -> List[str]:
    """Build recommendations based on GPA and time usage"""
    total = sum(avg_hours_per_day.values())
    top_platform = max(avg_hours_per_day, key=lambda k: avg_hours_per_day[k]) if avg_hours_per_day else None
    top_val = avg_hours_per_day.get(top_platform, 0.0) if top_platform else 0.0

    recs = [f"Observed average = {total:.2f} h/day across platforms over {days} day(s)."]
    
    if gpa < 3.0:
        target = 2.0
        if total > target:
            recs.append(f"GPA {gpa:.2f} is below 3.0. Reduce total time to ≤ {target:.1f} h/day.")
        if top_platform and top_val > 0.5:
            recs.append(f"Cut **{top_platform.capitalize()}** by ~50% (from {top_val:.2f}→{top_val*0.5:.2f} h/day) for 2 weeks.")
        recs.append("Add a daily study block before opening social apps.")
    elif gpa < 3.5:
        target = 2.5
        if total > target:
            recs.append(f"GPA {gpa:.2f}. Aim ≤ {target:.1f} h/day total.")
        for k, v in {k: v for k, v in avg_hours_per_day.items() if v > 1.0}.items():
            recs.append(f"Trim **{k.capitalize()}** by ~30% (from {v:.2f}→{v*0.7:.2f} h/day).")
        if total <= target:
            recs.append("Keep a 2‑hour focus block on weekdays.")
    else:
        target = 3.0
        if total > target:
            recs.append(f"GPA {gpa:.2f} is strong. Keep total ≤ {target:.1f} h/day.")
        for k, v in {k: v for k, v in avg_hours_per_day.items() if v > 1.5}.items():
            recs.append(f"Time‑box **{k.capitalize()}** to 45–60 min/day (currently {v:.2f} h/day).")
        if total <= target:
            recs.append("Nice balance. Maintain app limits to protect study time.")
    
    if top_platform:
        recs.append(f"Action: set an app limit on **{top_platform.capitalize()}** and reassess in 14 days.")
    
    return recs


# Sample data loading for analysis (simulating CSV loading)
def load_sample_scores() -> pd.DataFrame:
    """Load sample scores data for analysis"""
    # This would normally load from a CSV file
    # For now, we'll create sample data
    data = {
        'semester_id': ['2024-1', '2024-2', '2024-3'],
        'start': ['2024-01-15', '2024-05-15', '2024-09-15'],
        'end': ['2024-05-10', '2024-08-30', '2024-12-20'],
        'gpa': [3.2, 3.5, 3.8]
    }
    return pd.DataFrame(data)


def semester_gpa(scores_df: pd.DataFrame, cat_weight: float = 0.4, exam_weight: float = 0.6) -> pd.DataFrame:
    """Calculate semester GPA (simplified version)"""
    # This is a simplified version - in reality you'd have more complex calculations
    return scores_df.copy()


def correlate_time_gpa(gpa_df: pd.DataFrame) -> pd.DataFrame:
    """Correlate time usage with GPA"""
    # This would normally correlate with actual time data
    # For now, return a simple correlation
    correlation_data = {
        'semester_id': gpa_df['semester_id'].tolist(),
        'gpa': gpa_df['gpa'].tolist(),
        'correlation': [0.3, 0.1, -0.2]  # Sample correlation values
    }
    return pd.DataFrame(correlation_data)
