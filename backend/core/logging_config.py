"""Logging configuration for suppressing third-party noise."""

import logging
import sys
import os


def setup_logging():
    """Configures global logging settings and suppresses noisy libraries."""
    # Skip if already configured
    if logging.root.handlers:
        return

    # Set root level to INFO so we see start/stop events and important heartbeats
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )

    # Force very aggressive suppression for NOISY libraries
    # (These will stay at WARNING even if root is INFO)
    quiet_loggers = [
        "httpx",
        "httpcore",
        "uvicorn.access",
        "yfinance",
        "ccxt",
        "tenacity",
        "sqlalchemy.engine",
        "fastapi_limiter",
        "celery.beat",
    ]

    for name in quiet_loggers:
        logger_instance = logging.getLogger(name)
        logger_instance.setLevel(logging.WARNING)
        logger_instance.propagate = False

    # yfinance is extremely noisy even at WARNING
    logging.getLogger("yfinance").setLevel(logging.CRITICAL)
    os.environ["YF_NO_PRINTS"] = "1"

    # Uvicorn access logs (every HTTP request) are the main source of noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    # We want to see our own app logs at INFO
    app_loggers = ["worker.tasks", "services", "adapters", "main", "routers", "core"]
    for name in app_loggers:
        logging.getLogger(name).setLevel(logging.INFO)
