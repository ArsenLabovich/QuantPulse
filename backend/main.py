"""Main entry point for the QuantPulse FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import redis.asyncio as redis
from fastapi_limiter import FastAPILimiter
from core.config import settings
from routers import auth, dashboard, integrations, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize rate limiter
    r = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    await FastAPILimiter.init(r)
    yield
    await r.close()


app = FastAPI(title="QuantPulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
app.include_router(dashboard.router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "QuantPulse Backend is running"}
