import asyncio
import os
import json
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import ccxt

from core.database import DATABASE_URL
from models.integration import Integration, ProviderID
from core.security.encryption import encryption_service

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        # Get the integration
        result = await db.execute(select(Integration).limit(1))
        integration = result.scalar_one_or_none()
        
        if not integration:
            print("No integration found")
            return

        print(f"Debugging Integration: {integration.name} ({integration.provider_id})")
        
        # Decrypt
        decrypted_json = encryption_service.decrypt(integration.credentials)
        creds = json.loads(decrypted_json)
        
        exchange = ccxt.binance({
            'apiKey': creds.get("api_key"),
            'secret': creds.get("api_secret"),
            'enableRateLimit': True
        })
        
        # 1. Spot
        print("\n--- SPOT ---")
        try:
            bal = exchange.fetch_balance()
            for k, v in bal['total'].items():
                if v > 0:
                    print(f"{k}: {v} (Free: {bal[k]['free']}, Used: {bal[k]['used']})")
        except Exception as e:
            print(f"Error: {e}")

        # 2. Futures
        print("\n--- FUTURES (USDT-M) ---")
        try:
            bal = exchange.fetch_balance({'type': 'future'})
            for k, v in bal['total'].items():
                if v > 0:
                    print(f"{k}: {v}")
        except Exception as e:
            print(f"Error: {e}")

        # 3. Funding
        print("\n--- FUNDING ---")
        try:
            bal = exchange.fetch_balance({'type': 'funding'})
            for k, v in bal['total'].items():
                if v > 0:
                    print(f"{k}: {v}")
        except Exception as e:
            print(f"Error: {e}")
            
        # 4. Isolated Margin?
        print("\n--- MARGIN (ISOLATED) ---")
        try:
            bal = exchange.fetch_balance({'type': 'margin', 'marginMode': 'isolated'})
            print(f"Isolated Margin Keys: {list(bal.keys())}")
        except Exception as e:
            print(f"Error: {e}")

        # 6. RAW CALLS (Simple Earn Locked, Flexible, Algo)
        print("\n--- RAW CALLS ---")
        try:
            print("Fetching Simple Earn Locked Positions...")
            # Correct mapping: sapi_get_simple_earn_locked_position
            locked = exchange.sapi_get_simple_earn_locked_position()
            if 'rows' in locked:
                 for row in locked['rows']:
                      print(f"LOCKED EARN: {row['asset']} Amount: {row['amount']}")
            else:
                 print(f"Locked response: {locked}")

        except Exception as e:
            print(f"Locked Earn Error: {e}")

        try:
            print("Fetching Simple Earn Flexible Positions...")
            flex = exchange.sapi_get_simple_earn_flexible_position()
            if 'rows' in flex:
                 for row in flex['rows']:
                      print(f"FLEX EARN: {row['asset']} Amount: {row['totalAmount']}")
            else:
                 print(f"Flex response: {flex}")
        except Exception as e:
            print(f"Flex Earn Error: {e}")

        try:
             print("Fetching Strategy/Algo Orders (Futures)...")
             algo = exchange.sapi_get_algo_futures_openorders()
             if 'orders' in algo:
                  print(f"Found {len(algo['orders'])} algo orders")
             elif isinstance(algo, list):
                  print(f"Found {len(algo)} algo orders (list)")
             else:
                  print(f"Algo response: {algo}")
        except Exception as e:
             # This often errors if feature not enabled
             print(f"Algo Error: {e}")
             
        try:
             print("Fetching Sub-accounts list...")
             subs = exchange.sapi_get_sub_account_list()
             print(f"Sub-accounts: {subs}")
        except Exception as e:
             # print(f"Sub-account Error: {e}")
             pass

        try:
            print("Fetching Grid Bot Orders (Spot)...")
            bot = exchange.sapi_get_algo_spot_openorders()
            if 'orders' in bot:
                print(f"Found {len(bot['orders'])} spot algo orders")
            else:
                print(f"Spot Algo response: {bot}")
        except Exception as e:
             # print(f"Spot Algo Error: {e}")
             pass


        try:
            print("Fetching All Isolated Margin Accounts...")
            iso_accs = exchange.sapi_get_margin_isolated_account()
            if 'assets' in iso_accs:
                 print(f"Found {len(iso_accs['assets'])} isolated accounts")
                 for asset in iso_accs['assets']:
                      base = asset['baseAsset']
                      quote = asset['quoteAsset']
                      if float(base['netAsset']) > 0 or float(quote['netAsset']) > 0:
                           print(f"ISOLATED {asset['symbol']}: {base['asset']}={base['netAsset']}, {quote['asset']}={quote['netAsset']}")
            else:
                 print(f"Isolated response: {iso_accs}")
        except Exception as e:
             # print(f"Isolated Margin List Error: {e}") 
             # Use print to see error
             print(f"Isolated Margin List Error: {e}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
