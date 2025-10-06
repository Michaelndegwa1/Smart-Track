from django.db import models
from django.utils import timezone
import datetime


class SocialMediaSession(models.Model):
    """Model to track time spent on social media platforms"""
    
    PLATFORM_CHOICES = [
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('x', 'X (Twitter)'),
        ('tiktok', 'TikTok'),
    ]
    
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    time_seconds = models.FloatField(help_text="Time spent in seconds")
    date = models.DateField(default=timezone.now)
    start_timestamp = models.DateTimeField()
    end_timestamp = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-end_timestamp']
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['platform']),
            models.Index(fields=['-end_timestamp']),
        ]
    
    def __str__(self):
        return f"{self.platform} - {self.time_seconds}s on {self.date}"
    
    @property
    def time_minutes(self):
        return round(self.time_seconds / 60, 2)
    
    @property
    def time_hours(self):
        return round(self.time_seconds / 3600, 2)


class GPACourse(models.Model):
    """Model to store GPA calculation courses"""
    
    GRADE_CHOICES = [
        ('A+', 'A+'),
        ('A', 'A'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B', 'B'),
        ('B-', 'B-'),
        ('C+', 'C+'),
        ('C', 'C'),
        ('C-', 'C-'),
        ('D+', 'D+'),
        ('D', 'D'),
        ('D-', 'D-'),
        ('F', 'F'),
    ]
    
    name = models.CharField(max_length=200, blank=True, null=True)
    credits = models.FloatField()
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES)
    semester = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name or 'Unnamed'} - {self.grade} ({self.credits} credits)"


class GPACalculation(models.Model):
    """Model to store GPA calculation results"""
    
    courses = models.ManyToManyField(GPACourse)
    total_credits = models.FloatField()
    gpa = models.FloatField()
    calculation_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-calculation_date']
    
    def __str__(self):
        return f"GPA: {self.gpa} ({self.total_credits} credits)"


class TimeAnalysis(models.Model):
    """Model to store time vs GPA analysis results"""
    
    semester_id = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    gpa = models.FloatField()
    total_social_media_hours = models.FloatField()
    avg_hours_per_day = models.FloatField()
    recommendations = models.JSONField(default=list)
    analysis_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-analysis_date']
    
    def __str__(self):
        return f"Semester {self.semester_id} - GPA: {self.gpa}, Hours: {self.total_social_media_hours}"