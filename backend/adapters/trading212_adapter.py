"""Trading212 Adapter — Implementation for Trading212 brokerage API."""

from typing import List, Dict, Any, Optional
from adapters.base import BaseAdapter, AssetData
from services.trading212 import Trading212Client
from services.icons import IconResolver
from models.assets import AssetType
import logging

logger = logging.getLogger(__name__)

# Trading 212 Adapter


class Trading212Adapter(BaseAdapter):
    def get_provider_id(self) -> str:
        return "trading212"

    async def validate_credentials(
        self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None
    ) -> bool:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        is_demo = settings.get("is_demo", False) if settings else False

        client = Trading212Client(
            api_key=api_key, api_secret=api_secret, is_demo=is_demo
        )
        result = await client.validate_keys()
        return result.get("valid", False)

    async def fetch_balances(
        self, credentials: Dict[str, Any], settings: Optional[Dict[str, Any]] = None
    ) -> List[AssetData]:
        api_key = credentials.get("api_key")
        api_secret = credentials.get("api_secret")
        is_demo = settings.get("is_demo", False) if settings else False

        # Inject Redis client for caching
        from core.redis import get_redis_client

        redis_client = get_redis_client()

        client = Trading212Client(
            api_key=api_key,
            api_secret=api_secret,
            is_demo=is_demo,
            redis_client=redis_client,
        )

        # 1. Get Account Info (Currency)
        # We must NOT catch exceptions here. If metadata fails (e.g. 429 Rate Limit),
        # we should fail the entire sync rather than fallback to "USD" and corrupt the user's data.
        # account_meta = await client.get_account_metadata()
        # We need instruments first? No, account meta is small.
        try:
            account_meta = await client.get_account_metadata()
        except Exception as e:
            logger.error(f"Failed to fetch account metadata: {e}")
            raise

        account_currency = account_meta.get("currencyCode", "USD")

        # 2. Cash (Sum free, pieCash, and blocked for full liquidity view)
        cash_data = await client.get_account_cash()
        free_cash = float(cash_data.get("free", 0.0))
        pie_cash = float(cash_data.get("pieCash", 0.0))
        blocked_cash = float(cash_data.get("blocked", 0.0))

        total_cash = free_cash + pie_cash + blocked_cash

        assets = []
        if total_cash > 0:
            assets.append(
                AssetData(
                    symbol=account_currency,  # e.g. EUR
                    original_symbol=account_currency,
                    amount=total_cash,
                    price=1.0,
                    name=account_currency,
                    currency=account_currency,
                    asset_type=AssetType.FIAT,
                    image_url=IconResolver.get_icon_url(
                        account_currency, AssetType.FIAT, self.get_provider_id()
                    ),
                )
            )

        # 2. Positions
        positions = await client.get_open_positions()
        instruments_raw = await client.get_instruments()
        instruments = {i.get("ticker"): i for i in instruments_raw}

        for position in positions:
            ticker = position.get("ticker")
            quantity = float(position.get("quantity", 0))
            if quantity <= 0:
                continue

            price = float(position.get("currentPrice", 0))
            normalized_symbol = Trading212Client.normalize_ticker(ticker)

            # Name and Currency from metadata
            # Trading 212 tickers in positions sometimes differ from metadata (suffixes)
            instrument = instruments.get(ticker)
            if not instrument:
                # Try common suffixes or partial match
                clean_ticker = ticker.split("_")[0]
                # Look for first match that starts with clean_ticker
                for k, v in instruments.items():
                    if k.startswith(clean_ticker):
                        instrument = v
                        break

            if not instrument:
                logger.warning(f"Metadata not found for ticker {ticker}")
            else:
                logger.debug(
                    f"Metadata for {ticker} matched to {instrument.get('ticker')}: {instrument.get('name')}"
                )

            name = (
                instrument.get("name") or instrument.get("shortName")
                if instrument
                else normalized_symbol
            )
            asset_currency = (
                instrument.get("currencyCode", account_currency)
                if instrument
                else account_currency
            )

            assets.append(
                AssetData(
                    symbol=normalized_symbol,
                    original_symbol=ticker,
                    amount=quantity,
                    price=price,
                    name=name,
                    currency=asset_currency,
                    asset_type=AssetType.STOCK,
                    image_url=IconResolver.get_icon_url(
                        normalized_symbol,
                        AssetType.STOCK,
                        self.get_provider_id(),
                        ticker,
                        name,
                    ),
                )
            )

        return assets
