from fastapi import FastAPI
from routers import auth, users, integrations, dashboard

app = FastAPI(title="QuantPulse API")

from fastapi.middleware.cors import CORSMiddleware

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
