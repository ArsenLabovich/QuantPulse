from fastapi import FastAPI
from routers import auth, users, integrations

app = FastAPI(title="QuantPulse API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(integrations.router)

@app.get("/")
async def root():
    return {"status": "ok", "message": "QuantPulse Backend is running"}
