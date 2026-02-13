"""Service for deduplicating asset balances from complex reports."""

import logging
from typing import Dict

logger = logging.getLogger(__name__)


class BinanceDetailsDeduplicator:
    """Handles Binance balance deduplication logic.

    Binance reports the same assets across multiple endpoints (Spot, Earn, Funding).
    This class implements the logic to consolidate these reports into a single,
    deduplicated balance map.
    """

    @staticmethod
    def deduplicate(detailed_balances: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """Consolidates detailed balance reports into a final map.

        Args:
            detailed_balances (Dict[str, Dict[str, float]]):
                Map of symbol -> {source: amount}.
                Example: {'USDT': {'spot-USDT': 100, 'SimpleEarn-Flexible': 100}}

        Returns:
            Dict[str, float]: Map of symbol -> total_amount
        """
        final_balances = {}

        for symbol, sources in detailed_balances.items():
            logger.debug(f"Binance Detail for {symbol}: {sources}")

            # Bucket 1: Flexible Positions
            # These often double-count with 'LD'-prefixed assets in Spot.
            flex_vals = [
                v
                for k, v in sources.items()
                if "simpleearn-flexible" in k.lower() or "-ld" in k.lower()
            ]
            flex_total = max(flex_vals) if flex_vals else 0.0

            # Bucket 2: Locked Positions, Staking, and Vault
            # Group locked assets to prevent overlap.
            locked_vals = [
                v
                for k, v in sources.items()
                if any(
                    x in k.lower()
                    for x in ["simpleearn-locked", "staking-", "bnb-vault"]
                )
            ]
            locked_total = max(locked_vals) if locked_vals else 0.0

            # Bucket 3: Funding Wallet
            # Funding assets might be reported separately.
            funding_vals = [
                v
                for k, v in sources.items()
                if any(x in k.lower() for x in ["funding-", "funding_asset"])
            ]
            funding_total = max(funding_vals) if funding_vals else 0.0

            # Bucket 4: Pure Liquid Balances (Additive)
            # Anything NOT covered by the above buckets is considered distinct and additive.
            liquid_total = 0.0
            for k, v in sources.items():
                k_lower = k.lower()
                if any(
                    x in k_lower
                    for x in [
                        "simpleearn-",
                        "staking-",
                        "funding-",
                        "-ld",
                        "bnb-vault",
                        "funding_asset",
                    ]
                ):
                    continue
                liquid_total += v

            total = flex_total + locked_total + funding_total + liquid_total

            if total > 1e-8:
                final_balances[symbol] = total

        return final_balances
