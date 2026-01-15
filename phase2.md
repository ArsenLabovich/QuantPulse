Это отличный подход. Мы сейчас дадим ИИ четкую инструкцию не только по логике (адаптеры), но и по визуальному стилю.

Скриншоты Trading212, которые ты скинул (где настройки ключей), — это идеальный референс для логики валидации. А твой текущий дашборд (на темном фоне) — хорошая база, но мы попросим ИИ "докрутить" его до премиального уровня Trading212 (глубокие синие тона, четкие границы, профессиональные шрифты).

Вот полная спецификация для Фазы 2. Скопируй её в Cursor.

Project Specification: QuantPulse — Phase 2: Integration Hub & Visual Identity
Role: Senior Frontend/Backend Architect Phase Goal: Implement a modular "Integration Hub" using the Adapter Pattern and refine the UI to match a professional "Trading212-style" aesthetic.

1. UI/UX Design System Refinement ("Trading212 Style")
Before implementing logic, refactor the existing UI (Tailwind Config) to match a premium financial look.

Color Palette: Move away from pure black (#000000). Use Deep Navy/Charcoal tones common in professional trading platforms.

Background Base: #131722 (Dark Navy).

Card Background: #1E222D (Lighter Navy).

Borders: Thin, subtle borders (#2A2E39).

Primary Accent: Electric Blue (#3978FF) or Teal (#00C9A7) for positive numbers.

Typography: Use a clean, dense sans-serif font (e.g., Inter or Roboto).

Layout:

Navigation: Top Navigation Bar.

Content Area: Clean grid system.

Interactive Elements: High-contrast hover states. Buttons should have slightly rounded corners (approx rounded-md), not fully circular pill-shapes.

2. Architectural Pattern: The Integration Adapter
We need a scalable way to handle diverse providers (Binance, Trading212, Wallets).

Concept: The "Integration Hub" is a UI container. Inside, it renders different "Forms" based on the selected provider.

Scalability: Adding a new provider in the future should only require adding a new Adapter class in the Backend and a new Form Component in the Frontend.

3. Database Schema (Polymorphic Storage)
Create a table to store credentials securely.

Table: integrations

id: UUID, PK.

user_id: FK to users.

provider_id: Enum (binance, trading212, ethereum).

name: String (e.g., "Main Binance Acc").

credentials: Encrypted JSON Blob.

Crucial: Use Fernet (symmetric encryption) to store this. Never store API secrets in plain text.

is_active: Boolean.

settings: JSON (e.g., { "import_futures": false }).

created_at: Timestamp.

4. Backend Implementation (FastAPI)
A. Core Endpoints
GET /api/v1/integrations: List user's active connections (mask the secrets!).

POST /api/v1/integrations/{provider_id}: The "Factory" endpoint.

B. The Binance Adapter Logic
Implement the specific logic for provider_id="binance".

Input: api_key, api_secret.

Validation Step 1 (Connectivity): Use ccxt library to ping the exchange (e.g., fetch_balance()). If it fails -> Return 400 "Invalid Keys".

Validation Step 2 (Security/Permissions):

CRITICAL: We must ensure the key is Read-Only.

Check the API permissions. If the key has canWithdraw or enableWithdrawals set to True, REJECT the key immediately.

Error Message: "Security Alert: This key allows withdrawals. Please create a Read-Only key."

Storage: If valid, encrypt and save.

5. Frontend Implementation (Next.js)
A. The "Integration Hub" Page (/dashboard/integrations)
Layout: Two-column layout.

Left (Menu): A list of supported platforms. Currently: "Binance" (Active), "Trading212" (Coming Soon), "Ethereum" (Coming Soon).

Right (Workspace): The configuration form for the selected platform.

B. Binance Configuration Form
Tabs: Add a toggle at the top: [ API Key ] | [ OAuth (Coming Soon) ].

Fields: Connection Name, API Key, API Secret.

Instructions:

Display a warning box: "For your security, please disable 'Enable Withdrawals' in your Binance API settings."

(The UI should look like a configuration panel, not just a simple form).

C. State Management
Use React Query (or SWR) to fetch the list of existing integrations.

Show a "Loading..." spinner while the backend validates the keys (this can take 2-3 seconds).

Show a Success Toast ("Binance Connected Successfully") upon completion.

6. Definition of Done
The UI is refactored to the new "Dark Navy" Trading212-style palette.

A user can navigate to the "Integrations" page.

The user can select "Binance".

Entering an invalid API key returns a UI error.

Entering a valid (Read-Only) key saves it to the DB (Encrypted).

The integration appears in the list as "Active".