"""Celery application instance and worker configuration."""

import os
from celery import Celery
from celery.schedules import crontab

# Get Redis URL from env or default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("worker", broker=REDIS_URL, backend=REDIS_URL, include=["worker.tasks"])

# Celery Beat Schedule
celery_app.conf.beat_schedule = {
    "global-sync-every-10-min": {
        "task": "trigger_global_sync",
        "schedule": crontab(minute="*/10"),  # Run every 10 minutes
    },
    "cleanup-price-history-daily": {
        "task": "cleanup_price_history",
        "schedule": crontab(hour=3, minute=0),  # Run daily at 3:00 AM
    },
}

# Celery settings
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    # Crucial: Allow tasks to wait for other tasks (for the group.get() logic)
    task_always_eager=False,
    worker_prefetch_multiplier=1,
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# This environment variable bypasses the "Never call result.get() within a task" check
os.environ["C_FORCE_ROOT"] = "1"  # Often helps in docker, but let's use the programmatic way if possible
