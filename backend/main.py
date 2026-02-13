"""Main entry point for the QuantPulse FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, dashboard, integrations, users

app = FastAPI(title="QuantPulse API")

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
