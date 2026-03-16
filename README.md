# QuantPulse 📊

> Unified, quant-focused portfolio intelligence across brokers and exchanges.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2016-black)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791)
![Redis](https://img.shields.io/badge/cache-Redis-DC382D)
![Celery](https://img.shields.io/badge/tasks-Celery-37814A)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📸 Screenshots

### Dashboard Overview
<!-- SCREENSHOT PLACEHOLDER: Main dashboard showing portfolio overview -->
![Dashboard](docs/screenshots/dashboard.png)

### Portfolio Heatmap
<!-- SCREENSHOT PLACEHOLDER: Heatmap showing asset performance -->
![Heatmap](docs/screenshots/heatmap.png)

### Asset Detail View
<!-- SCREENSHOT PLACEHOLDER: Individual asset price history chart -->
![Asset Detail](docs/screenshots/asset_detail.png)

### Multi-broker Integration
<!-- SCREENSHOT PLACEHOLDER: Screenshot showing connected brokers/exchanges -->
![Brokers](docs/screenshots/brokers.png)

---

## 🎯 Business Case & Problem Statement

Retail investors and active traders increasingly spread their capital across **multiple venues**: stock brokers such as Trading212 and Freedom24, and crypto exchanges such as Binance and Bybit. Each platform exposes its own UI, currency, and export format, so understanding the **true, consolidated risk and performance** of the overall portfolio becomes non‑trivial.

Existing broker dashboards are **siloed by design**. They show PnL and charts for a single account, but they do not:
- aggregate holdings across brokers and exchanges,
- normalize values to a single base currency,
- provide analytics that treat all accounts as **one portfolio**,
- or offer programmatic hooks to drive quantitative workflows.

QuantPulse addresses this by acting as a **unified portfolio brain**:
- it connects to multiple providers (Binance, Bybit, Trading212, Freedom24, plus Ethereum/DeFi via CCXT),
- continuously synchronizes balances and prices into a normalized data model,
- builds historical snapshots in PostgreSQL,
- and exposes **analytics APIs** that power volatility and risk dashboards in a modern Next.js frontend.

The target user is a **retail or semi‑professional investor** who manages capital across several accounts and wants:
- a **single source of truth** for current net worth and asset breakdown,
- risk‑oriented visualizations (market map treemap, portfolio history curve, volatility analytics),
- and a backend that can later be extended with more advanced quantitative metrics (Sharpe, drawdown, Monte‑Carlo, AI assistant) already scaffolded in the codebase.

---

## ✨ Features

### Portfolio Management
- [x] **Multi-broker aggregation**
  - Unified `Integration` model with `ProviderID` enum covering `binance`, `bybit`, `trading212`, `freedom24`, and `ethereum` (`backend/models/integration.py`).
  - Provider‑specific adapters for Binance, Bybit, Trading212, Freedom24 in `backend/adapters/*.py`.
- [x] **Real-time asset valuation**
  - Balances fetched from providers, converted via `currency_service` and stored as `UnifiedAsset.usd_value` (`backend/services/currency.py`, `backend/services/price_service.py`, `backend/models/assets.py`).
- [x] **Cross-currency conversion**
  - Exchange rates pulled from external FX API and cached; used to normalize all positions into a base currency (`settings.BASE_CURRENCY`, default USD).
- [x] **Portfolio history tracking**
  - Periodic snapshots of total portfolio value stored in `PortfolioSnapshot` (`backend/models/assets.py`) and maintained by `SnapshotService` + Celery tasks (`backend/services/snapshot_service.py`, `backend/worker/tasks.py`).
- [x] **Sync orchestration & rate limiting**
  - Celery worker and beat schedule periodic syncs and cleanup jobs.
  - `SyncManager` + Redis locks manage per‑user cooldowns and active tasks (`backend/services/sync_manager.py`, `backend/core/redis.py`).

### Analytics & Visualization
- [x] **Portfolio heatmap / market map**
  - `TreemapWidget` uses Recharts treemap to visualize per‑asset allocation and 24h change (`frontend/components/dashboard/TreemapWidget.tsx`).
- [x] **Portfolio price history charts**
  - `HistoryChart` renders portfolio value over time using `/dashboard/history` API (`backend/routers/dashboard.py`, `frontend/components/dashboard/HistoryChart.tsx`).
- [x] **Portfolio allocation breakdown**
  - Backend generates allocation data by asset, including “Other” bucket; frontend renders donut/area charts (`AllocationChart`, `StatsGrid`).
- [x] **Dashboard widgets**
  - Net worth, daily change, top movers, holdings table, treemap, and history are orchestrated in `DashboardPage` (`frontend/app/dashboard/page.tsx`).
- [x] **Volatility analytics (live)**
  - `AnalyticsDataProvider` + `VolatilityCalculator` compute per‑symbol and portfolio volatility with results cached in Redis and persisted via `AnalyticsResultStore` (`backend/services/analytics/*`).
  - `/analytics/summary` and `/analytics/metric/volatility` APIs expose volatility, consumed by `MetricDetails` (`frontend/components/analytics/MetricDetails.tsx`).

### Quantitative Analysis *(Scaffolded / Planned)*
- [ ] **Sharpe Ratio calculation**
  - Frontend routes and UI widgets exist (`AnalyticsGrid`, `MetricDetails` config for `"sharpe"`), backend currently returns placeholder `_STUB` values for non‑volatility metrics.
- [ ] **Sortino Ratio**
- [ ] **Treynor Ratio**
- [ ] **Value at Risk (VaR)**
- [ ] **Maximum Drawdown analysis**
- [ ] **Beta, Correlation Matrix, R‑squared**
  - UI cards and metric detail pages are wired, but backend computations are not yet implemented (placeholders in `backend/routers/analytics.py` and `MetricDetails`).
- [ ] **Monte Carlo simulation**
  - Frontend scaffolding (`"monte-carlo"` slug in `MetricDetails`) ready for connecting to a backend engine.
- [ ] **AI-powered insights**
  - Dedicated `/dashboard/ai` route renders `ComingSoon` for an “AI Assistant”; no backend logic yet.

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Frontend
        UI[Next.js 16 App Router<br/>React 19 UI]
        AuthCtx[Auth & Refresh Context]
    end

    subgraph Backend
        API[FastAPI Server<br/>main.py]
        W[Celery Worker<br/>worker.tasks]
        S[Celery Beat Scheduler]
    end

    subgraph Data_Layer[Data Layer]
        PG[(PostgreSQL<br/>users, integrations,<br/>unified_assets,<br/>snapshots, candles)]
        R[(Redis<br/>cache + rate limiting<br/>+ Celery broker/backend)]
    end

    subgraph Integrations
        B[Binance API]
        BY[Bybit API]
        T[Trading212 API]
        F24[Freedom24 API]
    end

    UI -->|REST / Auth| API
    UI -->|Analytics views| API

    API --> PG
    API --> R

    API -->|trigger sync & analytics| W
    S -->|scheduled jobs| W

    W -->|sync balances, prices| PG
    W -->|progress, cache| R

    W --> B
    W --> BY
    W --> T
    W --> F24
```

---

## 🛠️ Tech Stack

| Layer        | Technology                     | Purpose |
|-------------|---------------------------------|---------|
| Frontend    | **Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts** | Modern SPA dashboard, analytics visualizations, responsive UI components. |
| Backend     | **FastAPI (Python 3.11)**      | REST API, auth, dashboard & analytics endpoints, integration management. |
| Database    | **PostgreSQL + SQLAlchemy 2 + Alembic** | Persistent storage for users, integrations, unified assets, snapshots, historical candles, analytics results. |
| Cache & MQ  | **Redis**                      | Rate limiting (FastAPILimiter), Celery broker & result backend, short‑lived analytics caches and SSE progress. |
| Task Queue  | **Celery 5 (with Redis)**      | Background sync jobs, scheduled global syncs, cleanup, volatility computations. |
| Market Data | **CCXT, custom Trading212 client, Tradernet/Freedom24 adapter** | Unified access to crypto exchanges and stock brokers, OHLCV history and pricing. |
| Container   | **Docker, docker-compose**     | Local multi‑service environment (db, redis, backend, worker, beat, frontend). |

---

## 📁 Project Structure

```text
quantpulse/
├── backend/
│   ├── adapters/                 # Provider-specific integrations (Binance, Bybit, Trading212, Freedom24, base adapter, factory)
│   │   ├── base.py
│   │   ├── binance_adapter.py
│   │   ├── bybit_adapter.py
│   │   ├── freedom24_adapter.py
│   │   ├── trading212_adapter.py
│   │   └── factory.py
│   ├── core/                     # Core infrastructure: config, DB, security, Redis, logging, retries
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── deps.py
│   │   ├── logging_config.py
│   │   ├── redis.py
│   │   └── security/
│   ├── models/                   # SQLAlchemy models
│   │   ├── assets.py
│   │   ├── market_data.py
│   │   ├── analytics_result.py
│   │   ├── integration.py
│   │   └── user.py
│   ├── routers/                  # FastAPI routers (HTTP API surface)
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── integrations.py
│   │   ├── users.py
│   │   └── analytics.py
│   ├── schemas/                  # Pydantic schemas (request/response models)
│   │   ├── assets.py
│   │   ├── integration.py
│   │   └── user.py
│   ├── services/                 # Domain and analytics services
│   │   ├── analytics/
│   │   │   ├── base.py
│   │   │   ├── calculators/
│   │   │   │   └── volatility.py
│   │   │   ├── data_provider.py
│   │   │   └── result_store.py
│   │   ├── currency.py
│   │   ├── market_data.py
│   │   ├── history_provider.py
│   │   ├── history_provider_factory.py
│   │   ├── price_service.py
│   │   ├── snapshot_service.py
│   │   ├── sync_manager.py
│   │   ├── symbol_resolver.py
│   │   ├── icons.py
│   │   └── trading212.py
│   ├── worker/                   # Celery application and task definitions
│   │   ├── celery_app.py
│   │   └── tasks.py
│   ├── alembic/                  # Database migrations
│   ├── tests/                    # Backend tests (analytics, providers, volatility math)
│   ├── main.py                   # FastAPI app entrypoint
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── app/                      # Next.js App Router routes
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── dashboard/portfolio/page.tsx
│   │   ├── dashboard/analytics/page.tsx
│   │   ├── dashboard/analytics/[slug]/page.tsx
│   │   ├── dashboard/integrations/page.tsx
│   │   ├── dashboard/ai/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── dashboard/            # Net worth card, allocation chart, treemap, holdings, stats
│   │   ├── analytics/            # AnalyticsGrid, MetricDetails, volatility views
│   │   ├── integrations/         # Integration management UI
│   │   ├── layout/               # TopBar, SyncWidget, error boundaries
│   │   └── ui/                   # Shared UI elements, backgrounds, buttons
│   ├── context/                  # Auth and refresh contexts
│   ├── lib/                      # API client, utilities
│   ├── types/                    # Shared TypeScript types (DashboardSummary, holdings, volatility)
│   ├── public/                   # Static assets and broker/exchange icons
│   ├── Dockerfile
│   ├── package.json
│   └── tailwind / eslint / tsconfig config files
├── deployment/
│   └── gcp/                      # Production docker-compose and Caddy config for GCP deployment
├── docker-compose.yml            # Local dev stack (Postgres, Redis, backend, worker, beat, frontend)
├── Dockerfile.prod               # Multi-service production image (used by deployment scripts)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11**
- **Node.js 20+**
- **Docker & Docker Compose**
- API credentials for at least one provider (e.g. **Binance**, **Bybit**, **Trading212**, **Freedom24**) if you want real data.

### Quickstart (Docker – Recommended)

```bash
git clone https://github.com/ArsenLabovich/quantpulse.git
cd quantpulse

# Start the full stack (Postgres, Redis, backend, worker, beat, frontend)
docker compose up --build
```

Services (default dev ports from `docker-compose.yml`):
- Backend API: `http://localhost:8000`
- Frontend UI: `http://localhost:3000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

### Local Development (without Docker)

> The Docker setup is the easiest path; this section is for manual runs.

**Backend**

```bash
cd backend
poetry install
poetry run alembic upgrade head  # migrate DB

export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="change_me_in_prod"
export ENCRYPTION_KEY="change_me_in_prod"

poetry run uvicorn main:app --reload --port 8000
```

**Worker & Beat**

```bash
cd backend
poetry run celery -A worker.celery_app worker --loglevel=info
poetry run celery -A worker.celery_app beat --loglevel=info
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

The frontend expects `NEXT_PUBLIC_API_URL` (via Docker compose) to point at the FastAPI backend, e.g.:

```bash
export NEXT_PUBLIC_API_URL="http://localhost:8000"
```

### Configuration

QuantPulse uses environment variables, with defaults wired in `backend/core/config.py` and `backend/worker/celery_app.py`.

Create a `.env` file in the **backend** directory for local overrides:

```env
# Backend core
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/quantpulse
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your_backend_jwt_secret
ENCRYPTION_KEY=your_encryption_key_for_credentials
BASE_CURRENCY=USD

# Optional rate limiting / analytics tuning
PRICE_HISTORY_KEEP_HOURS=48
ANALYTICS_CACHE_TTL=300
```

Provider credentials are stored **encrypted** in the `Integration.credentials` field and passed to adapters; the exact shape depends on the provider, but typically:

```jsonc
{
  "api_key": "your_key",
  "api_secret": "your_secret",
  // provider-specific flags (e.g. is_demo for Trading212)
}
```

For the **frontend**, you can use an `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
WATCHPACK_POLLING=true
```

---

## 🔌 Supported Integrations

| Platform   | Type            | Status        |
|------------|-----------------|---------------|
| Binance    | Crypto Exchange | ✅ Implemented |
| Bybit      | Crypto Exchange | ✅ Implemented |
| Trading212 | Stock Broker    | ✅ Implemented |
| Freedom24  | Stock Broker    | ✅ Implemented |

Adapters are registered via `AdapterFactory` and mapped from `ProviderID` → concrete adapter class.

---

## 📊 Data Models

Core entities in the backend:

- **User (`models/user.py`)**
  - Authenticated application user; linked to integrations and portfolio snapshots.
- **Integration (`models/integration.py`)**
  - Represents a connection to an external provider, with `provider_id`, encrypted credentials, and optional settings.
- **UnifiedAsset (`models/assets.py`)**
  - Canonical per‑asset record across all providers: symbol, name, type (`CRYPTO` / `STOCK` / `FIAT`), ISIN, amount, currency, price, 24h change, and normalized USD value.
- **PortfolioSnapshot (`models/assets.py`)**
  - Time‑stamped total portfolio value plus optional metadata (e.g. number of integrations contributing to the snapshot).
- **MarketPriceHistory (`models/assets.py`)**
  - Raw price points per symbol/provider over time, used for 24h change and historical charts.
- **HistoricalCandle (`models/market_data.py`)**
  - Daily OHLCV candles for backtesting and analytics.
- **AnalyticsResult (`models/analytics_result.py`)**
  - Serialized metric results (currently volatility) scoped by user and asset filter, with caching semantics shared with Redis.

<!-- SCREENSHOT PLACEHOLDER: ER diagram or database schema -->
![Database Schema](docs/screenshots/db_schema.png)

---

## 🗺️ Roadmap

- [x] Multi-broker portfolio aggregation (Binance, Bybit, Trading212, Freedom24, Ethereum).
- [x] Real-time price tracking and 24h change per asset.
- [x] Portfolio heatmaps / market map (treemap).
- [x] Cross-currency conversion to unified base currency (USD).
- [x] Historical portfolio snapshots and history charts.
- [x] Volatility analytics (summary + detailed 30‑day rolling volatility).
- [x] Scheduled background jobs (global sync, price history cleanup).
- [ ] Sharpe, Sortino, Treynor, VaR, Beta, Correlation, R² backend metrics.
- [ ] Detailed drawdown and Monte‑Carlo analytics.
- [ ] AI-powered portfolio assistant (dashboard AI route + backend logic).
- [ ] Responsive mobile‑first UI polishing and accessibility hardening.
- [ ] Public cloud deployment (GCP) with hardened security & observability.

---

## 👨‍💻 Author

**Arsen Labovich**  
- LinkedIn: [arsen-labovich](https://linkedin.com/in/arsen-labovich)  
- GitHub: [@ArsenLabovich](https://github.com/ArsenLabovich)

---

## 📄 License

This project is licensed under the **MIT License**.

