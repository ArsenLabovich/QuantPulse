---
description: How to deploy
---

# WORKFLOW: Safe Deployment & Verification
# Trigger: Use this workflow when the user asks to "Deploy", "Save", or "Test changes".

## Phase 1: Build & Restart
1.  **Stop Containers:** Run `docker-compose down` to ensure a clean state.
2.  **Rebuild:** Run `docker-compose up -d --build`.
3.  **Wait:** Wait for 5-10 seconds to allow databases to initialize.
4.  **Verify Process:** Run `docker ps` and check if `backend`, `db`, and `frontend` are listed as "Up".

## Phase 2: Health Check (Backend)
1.  **Ping API:** Execute a curl command or check logs to verify the Backend is responsive at `http://localhost:8000/health`.
2.  **Migration Check:** If there were changes to `models.py`, ask the user if they want to generate migrations (`alembic revision --autogenerate`).

## Phase 3: Reporting (User Handover)
You MUST output a summary in the following format:

### 🚀 Deployment Status: [SUCCESS / FAIL]
> Containers are running.

**Testing Instructions:**
* **Backend API:** [Open Docs](http://localhost:8000/docs)
* **Frontend UI:** [Open App](http://localhost:3000)
* **Integrations Page:** [Open Settings](http://localhost:3000/dashboard/integrations)

**Test Credentials:**
* Login: `admin@quantpulse.com`
* Pass: `admin123` (or remind the user to register)

---
*If any step fails, STOP and show the error log.*