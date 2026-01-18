import os
from celery import Celery

# Get Redis URL from env or default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_extended=True, # Improves result content
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Celery Beat Schedule
celery_app.conf.beat_schedule = {
    "global-sync-every-10-mins": {
        "task": "trigger_global_sync",
        "schedule": 600.0,  # 10 minutes in seconds
    },
}
