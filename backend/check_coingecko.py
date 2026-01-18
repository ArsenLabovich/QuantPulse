
import asyncio
import ccxt.async_support as ccxt
import json

async def main():
    exchange = ccxt.coingecko()
    try:
        # load_markets usually fetches the list of coins/pairs
        await exchange.load_markets()
        
        print(f"Loaded {len(exchange.currencies)} currencies.")
        
        # Check a few examples
        examples = ['BTC', 'ETH', 'SOL']
        results = {}
        
        for code in examples:
            if code in exchange.currencies:
                curr = exchange.currencies[code]
                results[code] = {
                    'id': curr.get('id'),
                    'name': curr.get('name'),
                    'code': curr.get('code')
                }
        
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await exchange.close()

if __name__ == "__main__":
    asyncio.run(main())
