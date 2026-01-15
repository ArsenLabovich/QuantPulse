import httpx
import asyncio

BASE_URL = "http://127.0.0.1:8000"

async def test_auth():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Register
        print("Registering...")
        email = "user4@example.com"
        password = "strongpassword"
        
        try:
            resp = await client.post("/auth/register", json={"email": email, "password": password})
            print(f"Register status: {resp.status_code}")
            print(f"Register response: {resp.json()}")
        except Exception as e:
             # Ignore if already registered
             print(f"Registration note: {e}")

        # 2. Login
        print("\nLogging in...")
        resp = await client.post("/auth/token", data={"username": email, "password": password})
        print(f"Login status: {resp.status_code}")
        token_data = resp.json()
        print(f"Token data: {token_data}")
        
        if resp.status_code != 200:
            print("Login failed, aborting.")
            return

        access_token = token_data["access_token"]
        
        # 3. Get Me
        print("\nGetting current user...")
        resp = await client.get("/users/me", headers={"Authorization": f"Bearer {access_token}"})
        print(f"Me status: {resp.status_code}")
        print(f"User data: {resp.json()}")

if __name__ == "__main__":
    asyncio.run(test_auth())
