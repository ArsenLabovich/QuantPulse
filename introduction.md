Project Specification: QuantPulse — Phase 1 (Foundation & Identity)
Role: Senior Solutions Architect Project Name: QuantPulse (Scalable Fintech Dashboard) Objective: Establish the foundational infrastructure and secure identity management system for a high-performance financial application.

1. High-Level Overview
We are building a scalable, microservices-ready fintech application. The immediate goal is to create a "Walking Skeleton": a fully connected full-stack application that handles the complete user lifecycle (Registration -> Login -> Protected Access).

The focus is on clean architecture, type safety, and a robust development environment using containers.

2. Technology Stack Standards
The solution must be built using the following core technologies:

Infrastructure: Docker & Docker Compose (for orchestrating the database and backend services locally).

Database: PostgreSQL (latest stable version).

Backend: Python (FastAPI). Must use asynchronous programming patterns (async/await) and a modern ORM for database interactions.

Frontend: Next.js (App Router architecture) with TypeScript.

Styling: Tailwind CSS (Modern, dark-mode first design).

Authentication: JWT (JSON Web Tokens) for stateless session management.

3. Functional Requirements
A. Infrastructure Setup
Initialize a Monorepo structure that cleanly separates the Frontend, Backend, and Infrastructure configurations.

Configure a local development environment where the Database and Backend can be launched with a single orchestration command.

B. Identity Management (Authentication)
Registration: Users must be able to create a new account using an email and password. The system must securely hash and salt passwords before storage.

Login: Users must be able to authenticate with their credentials. Upon success, the system should issue a secure access token.

Session Persistence: The frontend must handle the storage of authentication tokens securely to keep the user logged in between page reloads.

C. User Interface (Frontend)
Public Zone: Create clean, minimalist forms for Login and Registration.

Private Zone (Dashboard): Create a protected "Dashboard" view. This area must be inaccessible to unauthenticated users (automatic redirection to login).

User Context: The Dashboard should retrieve and display the current user's identity (e.g., email) from the backend to verify the connection is working.

4. Architectural Constraints
Type Safety: The Frontend must strictly use TypeScript interfaces.

Validation: The Backend must validate all incoming data (emails, passwords) to prevent errors and ensure security.

Migrations: Database schema changes must be managed via a migration tool, not by creating tables manually.

5. Definition of Done (Success Criteria)
The phase is considered complete when:

The developer can spin up the entire stack (DB + API) using Docker.

A user can successfully register via the Frontend UI.

A user can log in and is automatically redirected to the protected Dashboard.

The Dashboard correctly displays data fetched from a protected Backend endpoint.