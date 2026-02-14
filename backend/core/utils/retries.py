"""Retry utilities for external API calls using tenacity."""

import logging
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import ccxt

logger = logging.getLogger(__name__)


def exchange_retry(
    max_attempts: int = 3,
    min_wait: float = 2.0,
    max_wait: float = 10.0,
):
    """Decorator to retry CCXT operations on network/rate-limit errors.

    Args:
        max_attempts: Maximum number of attempts before giving up (default: 3).
        min_wait: Minimum wait time between retries in seconds (default: 2.0).
        max_wait: Maximum wait time between retries in seconds (default: 10.0).
    """

    def is_retryable_exception(exception: Exception) -> bool:
        """Determines if the exception should trigger a retry."""
        return isinstance(
            exception,
            (
                ccxt.NetworkError,
                ccxt.DDoSProtection,
                ccxt.RateLimitExceeded,
                ccxt.ExchangeNotAvailable,
                ccxt.RequestTimeout,
            ),
        )

    return retry(
        retry=retry_if_exception_type(Exception)
        & retry_if_exception_type(
            (
                ccxt.NetworkError,
                ccxt.DDoSProtection,
                ccxt.RateLimitExceeded,
                ccxt.ExchangeNotAvailable,
                ccxt.RequestTimeout,
            )
        ),  # Explicitly listed for clarity, though custom func works too
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
