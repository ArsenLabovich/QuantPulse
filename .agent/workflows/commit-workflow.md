---
description: How to do commit.
---

# WORKFLOW: New Feature Implementation
# Trigger: Use when starting a new task (e.g., "Make the Settings page").

## 1. Context Loading
* Read `README.md` to understand the architecture.
* Read `frontend/tailwind.config.ts` to use the correct "Dark Navy" colors.

## 2. Implementation Rules
* **Frontend:**
    * Use TypeScript interfaces for all props.
    * Use `Lucide-React` for icons.
    * Style: Trading212 aesthetic (Deep Navy backgrounds `#131722`, Blue Accents).
* **Backend:**
    * Use `Pydantic` schemas for validation.
    * Use `Async/Await` for DB calls.

## 3. Final Step
* Automatically trigger the `@deploy.md` workflow to apply changes.