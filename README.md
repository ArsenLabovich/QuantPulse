# QuantPulse

> Unified portfolio tracker that aggregates crypto exchanges and stock brokers into a single dashboard with quantitative analytics.

![Status](https://img.shields.io/badge/status-on%20hold-orange)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2015-336791)
![Redis](https://img.shields.io/badge/cache-Redis-DC382D)
![Celery](https://img.shields.io/badge/tasks-Celery%205-37814A)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Screenshots

### Dashboard — Net Worth, Stats & Portfolio History
![Dashboard](docs/screenshots/dashboard.png)

### Dashboard — Market Map & Top Holdings
![Market Map & Holdings](docs/screenshots/heatmap.png)

### Portfolio Overview — All Platforms
![Portfolio Overview](docs/screenshots/portfolio_overview.png)

### Portfolio Overview — Filtered by Broker
![Portfolio Filtered](docs/screenshots/portfolio_filtered.png)

### Connected Integrations
![Integrations](docs/screenshots/integrations.png)

### Add Exchange Modal
![Add Exchange](docs/screenshots/brokers.png)

### Analytics — Performance & Risk Metrics
![Analytics Top](docs/screenshots/analytics_top.png)
![Analytics Bottom](docs/screenshots/analytics_bottom.png)

### Volatility Analysis — Risk Trend & Composition
![Volatility Analysis](docs/screenshots/volatility_analysis.png)

### Volatility — Per-Asset Metrics Table
![Volatility Table](docs/screenshots/volatility_table.png)

---

## Problem & Motivation

Retail investors who trade on multiple platforms (e.g. Binance for crypto, Trading 212 for stocks, Freedom24 for European equities) have no single place to see their combined portfolio. Each broker shows only its own positions, in its own currency, with its own charts. Answering basic questions like "what is my total net worth across all accounts?" or "which asset class dominates my portfolio?" requires manual spreadsheet work.

QuantPulse connects to broker APIs using read-only credentials, pulls all positions into a single normalized data model, converts everything to a base currency (USD by default), and presents a unified dashboard. The app records portfolio snapshots over time, calculates 24h price changes, and provides a volatility analytics engine that computes rolling risk metrics across the entire combined portfolio.

The project is currently **on hold**. The core portfolio aggregation, dashboard, and volatility analytics are fully functional. The remaining quantitative metrics (Sharpe, Sortino, VaR, drawdown, etc.) and the AI assistant are scaffolded in the UI but not yet implemented on the backend.

---

## Features

### Implemented

**Portfolio Aggregation**
- [x] Connect Binance, Trading 212, and Freedom24 via API keys — credentials encrypted with AES before storage (`core/security/encryption.py`)
- [x] Bybit adapter exists and validates credentials, but sync worker does not process Bybit integrations yet
- [x] Celery worker fetches balances from each adapter (`adapters/binance_adapter.py`, `adapters/trading212_adapter.py`, `adapters/freedom24_adapter.py`), converts to USD via live FX rates (`services/currency.py`), and stores as `UnifiedAsset` records
- [x] Atomic sync: old assets deleted and new ones inserted in a single transaction with distributed locking (`services/distributed_lock.py`)
- [x] Scheduled global sync via Celery Beat — all active integrations synced periodically
- [x] Price history cleanup task removes `MarketPriceHistory` records older than 48 hours

**Dashboard**
- [x] Net worth card with 24h change percentage
- [x] Stats grid: top gainer, top loser, dominant currency, cash drag ratio
- [x] Portfolio history chart with range selector (1h, 6h, 1d, 1w, 1M, ALL) backed by `PortfolioSnapshot` records
- [x] Market map (treemap) — asset blocks sized by USD value, colored by 24h change (`TreemapWidget.tsx` using Recharts)
- [x] Allocation donut chart (`AllocationChart.tsx`)
- [x] Top holdings table with prices, balances, and values

**Portfolio Overview**
- [x] Detailed holdings table with search, filtering by platform/asset type/currency, and sorting
- [x] Summary cards: filtered balance, selection share %, top allocation, profitability bar, active asset count
- [x] Asset details drawer with per-platform breakdown and 24h price chart from `MarketPriceHistory`

**Volatility Analytics**
- [x] `VolatilityCalculator` computes annualized portfolio risk, average daily swing, VaR (95%), and 30-day rolling volatility (`services/analytics/calculators/volatility.py`)
- [x] Per-asset volatility breakdown with annual risk, daily swing, data points, and risk contribution percentage
- [x] Custom computation: user selects assets and date range → Celery task runs → progress streamed via Redis Pub/Sub → frontend receives results through SSE (`/analytics/volatility/progress/{task_id}`)
- [x] Results cached in Redis and persisted to `AnalyticsResult` table in PostgreSQL

**Infrastructure**
- [x] JWT authentication with access + refresh token rotation (`routers/auth.py`)
- [x] Rate limiting via `fastapi-limiter` backed by Redis
- [x] GCP deployment scripts with Caddy reverse proxy, auto-TLS, and production Docker Compose (`deployment/gcp/`)

### Scaffolded (UI exists, backend returns stubs)

- [ ] Sharpe Ratio — frontend card and detail page wired, backend returns `{"value": null, "status": "pending"}`
- [ ] Sortino Ratio
- [ ] Treynor Ratio
- [ ] Monte Carlo Simulation
- [ ] Value at Risk (full computation — currently only available as part of volatility output)
- [ ] Maximum Drawdown
- [ ] Beta, Correlation Matrix, R-Squared

### Not Implemented

- [ ] AI-powered portfolio assistant — `/dashboard/ai` renders a "Coming Soon" placeholder, no backend logic
- [ ] Bybit sync (adapter validates credentials but `_load_integration` in `worker/tasks.py` skips Bybit)
- [ ] Ethereum/DeFi integration — `ProviderID.ethereum` enum exists but no adapter is registered

---

## Architecture

![Architecture Diagram](docs/mermaid-diagram.svg)

---

## Tech Stack

| Layer | Technology | Role in Project |
|-------|-----------|----------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Recharts | SPA with App Router, dashboard widgets, analytics charts, treemap |
| Backend | FastAPI, Python 3.11, Pydantic v2 | REST API with 5 routers: auth, dashboard, integrations, users, analytics |
| Database | PostgreSQL 15, SQLAlchemy 2 (async), Alembic | 7 tables: users, integrations, unified_assets, portfolio_snapshots, market_price_history, historical_candles, analytics_results |
| Cache / MQ | Redis | Celery broker + result backend, rate limiting (fastapi-limiter), analytics cache, distributed locks, Pub/Sub for SSE progress |
| Task Queue | Celery 5 | 6 tasks: sync_integration_data, trigger_global_sync, cleanup_price_history, compute_volatility, compute_volatility_custom, backfill_pricing_history |
| Exchange APIs | CCXT (Binance, Bybit), custom Trading212 client, Tradernet SDK (Freedom24) | Read-only API key access to fetch balances and positions |
| Market Data | yfinance, CCXT | OHLCV candle history for volatility and analytics computations |
| FX Rates | open.er-api.com | Live currency conversion rates, cached in memory |
| Containerization | Docker, Docker Compose | Local dev: 6 services (db, redis, backend, worker, celery-beat, frontend); Prod: + Caddy reverse proxy |

---

## Project Structure

```text
quantpulse/
├── backend/
│   ├── adapters/
│   │   ├── base.py                     # BaseAdapter ABC + AssetData dataclass
│   │   ├── binance_adapter.py          # Spot, margin, futures, earn, staking, BNB vault via CCXT
│   │   ├── bybit_adapter.py            # Balance + tickers via CCXT (validation only, sync skipped)
│   │   ├── trading212_adapter.py       # Cash + equity positions via custom HTTP client
│   │   ├── freedom24_adapter.py        # Positions + cash via Tradernet v2 API
│   │   └── factory.py                  # AdapterFactory: ProviderID → adapter instance
│   ├── core/
│   │   ├── config.py                   # Settings (pydantic-settings): DB, Redis, JWT, sync tuning
│   │   ├── database.py                 # Async SQLAlchemy engine + session factory
│   │   ├── deps.py                     # FastAPI dependencies (get_db, get_current_user)
│   │   ├── redis.py                    # Async Redis client singleton
│   │   ├── logging_config.py           # Logging setup
│   │   ├── utils/retries.py            # Tenacity retry decorators
│   │   └── security/
│   │       ├── auth.py                 # Password hashing (bcrypt), JWT creation/verification
│   │       └── encryption.py           # AES credential encryption/decryption
│   ├── models/
│   │   ├── user.py                     # User (id, email, hashed_password, is_active)
│   │   ├── integration.py             # Integration + ProviderID enum (binance, trading212, freedom24, bybit, ethereum)
│   │   ├── assets.py                   # UnifiedAsset, PortfolioSnapshot, PortfolioAggregate, MarketPriceHistory
│   │   ├── market_data.py             # HistoricalCandle (OHLCV)
│   │   └── analytics_result.py        # AnalyticsResult (metric_name, value, confidence, meta)
│   ├── routers/
│   │   ├── auth.py                     # POST /register, /token, /refresh
│   │   ├── dashboard.py               # GET /summary, /history, /assets, /holdings, /history/{symbol}; POST /refresh
│   │   ├── integrations.py            # GET /, POST /, DELETE /{id}
│   │   ├── users.py                    # GET /me
│   │   └── analytics.py               # GET /summary, /metric/{name}; POST /volatility/compute; GET /volatility/progress/{id}
│   ├── schemas/
│   │   ├── user.py                     # UserCreate, UserOut, Token
│   │   ├── integration.py             # IntegrationCreate, IntegrationOut
│   │   └── assets.py                   # AssetOut, PortfolioSnapshotOut
│   ├── services/
│   │   ├── analytics/
│   │   │   ├── base.py                 # AssetFilter enum, PortfolioData, MetricResult dataclasses
│   │   │   ├── data_provider.py        # AnalyticsDataProvider: loads assets + aligns price history into DataFrames
│   │   │   ├── result_store.py         # AnalyticsResultStore: Redis + PostgreSQL dual-write
│   │   │   └── calculators/
│   │   │       └── volatility.py       # VolatilityCalculator: annual risk, daily swing, VaR, rolling 30d, per-asset
│   │   ├── currency.py                 # FX rate fetching from open.er-api.com with in-memory cache
│   │   ├── market_data.py             # Yahoo Finance OHLCV fetch + DB upsert
│   │   ├── history_provider.py        # Abstract HistoryProvider + YahooHistoryProvider + CcxtHistoryProvider
│   │   ├── history_provider_factory.py # ProviderID → history provider mapping
│   │   ├── price_service.py           # Record price, calculate 24h change from MarketPriceHistory
│   │   ├── snapshot_service.py        # Create/update portfolio snapshots with deduplication
│   │   ├── sync_manager.py            # Sync cooldown, active task tracking via Redis
│   │   ├── distributed_lock.py        # Redis-based distributed lock with TTL and retry
│   │   ├── symbol_resolver.py         # ISIN + ticker → Yahoo Finance symbol resolution
│   │   ├── icons.py                    # Asset icon URL resolution (multiple strategies)
│   │   ├── deduplication.py           # Binance balance deduplication across account types
│   │   └── trading212.py             # Trading212 HTTP client (cash, positions, instruments)
│   ├── worker/
│   │   ├── celery_app.py              # Celery instance, Redis broker, beat schedule
│   │   └── tasks.py                    # 6 tasks: sync, global_sync, cleanup, volatility, custom_vol, backfill
│   ├── alembic/                        # Database migrations (11 versions)
│   ├── tests/analytics/               # Volatility math, data provider, history provider tests
│   ├── main.py                         # FastAPI app: CORS, rate limiter, router includes
│   ├── Dockerfile                      # Dev: Python 3.11 + Poetry
│   └── pyproject.toml                  # Dependencies: fastapi, sqlalchemy, celery, ccxt, yfinance, etc.
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    # Landing page with CosmosBackground
│   │   ├── layout.tsx                  # Root layout
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── dashboard/
│   │       ├── page.tsx                # Main dashboard (net worth, stats, history, treemap, allocation, holdings)
│   │       ├── layout.tsx              # Dashboard shell (TopBar, RefreshProvider, ErrorBoundary)
│   │       ├── portfolio/page.tsx      # Portfolio overview (summary cards, filterable holdings table, asset drawer)
│   │       ├── analytics/page.tsx      # Analytics grid (10 metric cards)
│   │       ├── analytics/[slug]/page.tsx # Metric detail: volatility → VolatilityPage; others → MetricDetails (stub)
│   │       ├── integrations/page.tsx   # Connected integrations CRUD
│   │       └── ai/page.tsx             # "Coming Soon" placeholder
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── NetWorthCard.tsx        # Total net worth + 24h change badge
│   │   │   ├── StatsGrid.tsx           # Top gainer, top loser, dominance, cash drag
│   │   │   ├── HistoryChart.tsx        # Portfolio value area chart with range buttons
│   │   │   ├── TreemapWidget.tsx       # Recharts treemap colored by 24h change
│   │   │   ├── AllocationChart.tsx     # Donut chart of portfolio allocation
│   │   │   ├── TopHoldingsWidget.tsx   # Top 5 holdings by value
│   │   │   ├── HoldingsTable.tsx       # Full holdings table with search, filters, sorting
│   │   │   ├── PortfolioSummary.tsx    # Summary cards (balance, share, profitability, active assets)
│   │   │   ├── AssetDetailsDrawer.tsx  # Slide-out drawer: asset info + 24h price chart
│   │   │   ├── SmartRefreshButton.tsx  # Sync trigger with task polling
│   │   │   ├── AssetList.tsx           # (unused) basic asset table
│   │   │   └── MoversWidget.tsx        # (unused) top gainer/loser cards
│   │   ├── analytics/
│   │   │   ├── AnalyticsGrid.tsx       # 3 sections: Performance, Risk, Market Correlation (10 cards)
│   │   │   ├── AnalyticsWidget.tsx     # Clickable metric card (title, description, icon)
│   │   │   ├── MetricDetails.tsx       # Detail view: volatility → real data; others → "under development" stub
│   │   │   ├── volatility/
│   │   │   │   ├── VolatilityPage.tsx  # Full volatility page: fetch data, dispatch compute, receive SSE
│   │   │   │   ├── VolatilityStats.tsx # Annual risk, daily swing, VaR 95%, trading days stats
│   │   │   │   ├── VolatilityChart.tsx # 30-day rolling volatility area chart
│   │   │   │   ├── VolatilityAssetTable.tsx # Per-asset selection table with risk metrics
│   │   │   │   ├── VolatilityFilters.tsx    # Search + provider/type/source filters
│   │   │   │   ├── RiskContributionPanel.tsx # Composition bar by risk weight
│   │   │   │   └── IntervalSelector.tsx     # 1W / 1M / 3M / 1Y preset buttons
│   │   │   └── charts/
│   │   │       ├── Sparkline.tsx       # Generic small area chart
│   │   │       ├── HeatmapMini.tsx     # 3x3 correlation grid (mock data)
│   │   │       └── RiskGauge.tsx       # Half-circle gauge widget
│   │   ├── integrations/
│   │   │   ├── IntegrationCard.tsx     # Connected broker card with disconnect button
│   │   │   ├── AddIntegrationModal.tsx # Two-step: select provider → enter API keys
│   │   │   └── DeleteConfirmationModal.tsx
│   │   ├── layout/
│   │   │   ├── TopBar.tsx              # Navigation icons + refresh button
│   │   │   └── SyncWidget.tsx          # Global refresh state management
│   │   └── ui/                         # CosmosBackground, BackgroundBeams, Button, CustomTooltip
│   ├── context/
│   │   ├── AuthContext.tsx             # JWT token management, login/logout, user state
│   │   └── RefreshContext.tsx          # Shared refresh key for re-fetching dashboard data
│   ├── lib/
│   │   ├── api.ts                      # Axios instance with JWT interceptor + refresh token rotation
│   │   ├── assets.ts                   # Asset utility helpers
│   │   └── utils.ts                    # Tailwind merge, formatters
│   ├── types/
│   │   └── dashboard.ts               # HoldingItem, DetailedHoldingItem, DashboardSummary, VolatilityResult, etc.
│   ├── public/                         # Static assets, broker/exchange SVG icons
│   ├── Dockerfile                      # Dev: Node 20 + npm run dev
│   └── package.json                    # next, react, @tanstack/react-query, recharts, axios, tailwind-merge
├── deployment/
│   └── gcp/
│       ├── docker-compose.prod.yml     # Production: Caddy, frontend (standalone build), backend, worker, beat, db, redis
│       ├── Caddyfile                   # Reverse proxy: /api/* → backend:8000, /* → frontend:3000
│       └── setup_gcp.sh               # Auto-generates secrets, installs Docker, runs migrations
├── docs/screenshots/                   # README screenshots
├── docker-compose.yml                  # Local dev: 6 services (db, redis, backend, worker, beat, frontend)
├── Dockerfile.prod                     # Multi-stage Next.js production build (standalone output)
└── README.md
```

---

## Getting Started

### Prerequisites

- **Docker & Docker Compose** (recommended)
- Python 3.11 + Poetry (for local backend development)
- Node.js 20+ (for local frontend development)

### Docker Quickstart

```bash
git clone https://github.com/ArsenLabovich/quantpulse.git
cd quantpulse

# Create a .env file with secrets (or Docker will use defaults for DB)
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# Start all 6 services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

On first launch, the backend auto-creates database tables via SQLAlchemy. For explicit migrations:

```bash
docker compose exec backend poetry run alembic upgrade head
```

### Local Development (without Docker)

**Backend:**

```bash
cd backend
poetry install
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="$(openssl rand -hex 32)"
export ENCRYPTION_KEY="$(openssl rand -base64 32)"
poetry run alembic upgrade head
poetry run uvicorn main:app --reload --port 8000
```

**Worker & Beat** (separate terminals):

```bash
cd backend
poetry run celery -A worker.celery_app worker --loglevel=info
poetry run celery -A worker.celery_app beat --loglevel=info
```

**Frontend:**

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

### Configuration

All backend settings are in `backend/core/config.py` (loaded via `pydantic-settings` from environment or `.env`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/quantpulse` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for Celery, cache, locks |
| `SECRET_KEY` | *(required)* | JWT signing key |
| `ENCRYPTION_KEY` | *(required)* | AES key for encrypting stored API credentials |
| `BASE_CURRENCY` | `USD` | Currency for portfolio normalization |
| `PRICE_HISTORY_KEEP_HOURS` | `48` | How long raw price records are kept |
| `ANALYTICS_CACHE_TTL` | `300` | Redis cache TTL for analytics results (seconds) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | `1440` | JWT refresh token lifetime (24h) |
| `SYNC_LOCK_TTL_SEC` | `30` | Distributed lock TTL for integration sync |

Provider credentials are entered through the UI and stored **encrypted** in the `integrations.credentials` column. The backend decrypts them at sync time — no API keys are stored in config files.

Frontend uses `NEXT_PUBLIC_API_URL` (set in docker-compose or `.env.local`) to point at the backend.

---

## Supported Integrations

| Platform | Type | Adapter | Sync | Notes |
|----------|------|---------|------|-------|
| Binance | Crypto Exchange | `BinanceAdapter` (CCXT) | Working | Spot, margin, futures, earn, staking, BNB vault |
| Trading 212 | Stock Broker | `Trading212Adapter` (custom HTTP) | Working | Cash + equity positions + instrument metadata |
| Freedom24 | Stock Broker | `Freedom24Adapter` (Tradernet SDK) | Working | Positions + cash via `getPositionJson` v2 API |
| Bybit | Crypto Exchange | `BybitAdapter` (CCXT) | Validation only | Adapter validates credentials; sync worker skips Bybit in `_load_integration` |

`ProviderID.ethereum` exists in the enum but has no registered adapter — attempting to create an Ethereum integration will raise `ValueError`.

---

## Data Models

| Table | Model | Key Columns |
|-------|-------|-------------|
| `users` | `User` | id, email, hashed_password, is_active |
| `integrations` | `Integration` | id, user_id, provider_id (enum), name, credentials (encrypted), is_active, settings (JSON), created_at |
| `unified_assets` | `UnifiedAsset` | id, user_id, integration_id, symbol, name, original_name, asset_type, isin, amount, current_price, currency, change_24h, usd_value, image_url, last_updated |
| `portfolio_snapshots` | `PortfolioSnapshot` | id, user_id, timestamp, total_value_usd, data (JSON) |
| `market_price_history` | `MarketPriceHistory` | id, symbol, provider_id, price, currency, timestamp |
| `historical_candles` | `HistoricalCandle` | symbol + timestamp (composite PK), open, high, low, close, volume, updated_at |
| `analytics_results` | `AnalyticsResult` | id, user_id, metric_name, asset_filter, value, display_value, status, confidence, meta (JSON), computed_at; unique on (user_id, metric_name, asset_filter) |

---

## API Endpoints

| Method | Path | Router | Status |
|--------|------|--------|--------|
| POST | `/auth/register` | auth | Working |
| POST | `/auth/token` | auth | Working |
| POST | `/auth/refresh` | auth | Working |
| GET | `/users/me` | users | Working |
| GET | `/integrations/` | integrations | Working |
| POST | `/integrations/` | integrations | Working |
| DELETE | `/integrations/{id}` | integrations | Working |
| GET | `/dashboard/summary` | dashboard | Working |
| GET | `/dashboard/history` | dashboard | Working |
| GET | `/dashboard/assets` | dashboard | Working |
| GET | `/dashboard/holdings` | dashboard | Working |
| GET | `/dashboard/history/{symbol}` | dashboard | Working |
| POST | `/dashboard/refresh` | dashboard | Working |
| GET | `/dashboard/status/{task_id}` | dashboard | Working |
| GET | `/dashboard/sync-status` | dashboard | Working |
| GET | `/analytics/summary` | analytics | Partial — volatility real, 9 metrics return stubs |
| GET | `/analytics/metric/{name}` | analytics | Partial — volatility real, others return stubs |
| POST | `/analytics/volatility/compute` | analytics | Working |
| GET | `/analytics/volatility/progress/{task_id}` | analytics | Working (SSE) |

---

## Celery Tasks

| Task | Trigger | What It Does |
|------|---------|-------------|
| `sync_integration_data` | Dashboard refresh button or global sync | Fetches balances via adapter, records prices, creates snapshot; uses distributed lock |
| `trigger_global_sync` | Celery Beat (scheduled) | Queries all active integrations, dispatches `sync_integration_data` for each |
| `cleanup_price_history` | Celery Beat (scheduled) | Deletes `MarketPriceHistory` rows older than `PRICE_HISTORY_KEEP_HOURS` |
| `compute_volatility` | After sync completes | Recomputes volatility for a user, saves to DB + Redis |
| `compute_volatility_custom` | User triggers from Volatility page | Custom symbol set + date range; streams progress via Redis Pub/Sub |
| `backfill_pricing_history` | Analytics data provider | Downloads missing OHLCV candles for assets before volatility computation |

---

## Security Audit

Findings from scanning the repository:

- **No `.env` files committed** — `.gitignore` covers `backend/.env`, `frontend/.env`, and root `.env`
- **No hardcoded API keys or secrets** — all secrets loaded from environment variables via `os.getenv()` in `config.py`
- **Credentials encrypted at rest** — `encryption_service.encrypt()` before DB write, `decrypt()` at sync time
- **Docker Compose uses env vars** — `${SECRET_KEY}`, `${ENCRYPTION_KEY}`, `${POSTGRES_PASSWORD}` all reference external env
- **GCP setup script generates secrets** — `openssl rand` for passwords and keys, written to `.env` on first run only
- **Default DB password** — `docker-compose.yml` defaults to `postgres:postgres` which is standard for local development
- **`.agent/` directory ignored** — added to `.gitignore` to prevent committing workspace pictures and transcripts

---

## Roadmap

- [x] Multi-broker portfolio aggregation (Binance, Trading 212, Freedom24)
- [x] Real-time price tracking with 24h change
- [x] Portfolio heatmap / market map (treemap)
- [x] Cross-currency conversion (USD base)
- [x] Historical portfolio snapshots and value charts
- [x] Volatility analytics (annualized risk, daily swing, VaR 95%, 30-day rolling, per-asset breakdown)
- [x] Custom volatility computation with live SSE progress
- [x] Scheduled background sync and price cleanup
- [x] GCP deployment scaffolding (Caddy + Docker Compose prod)
- [ ] Bybit sync support (adapter exists, needs worker integration)
- [ ] Sharpe Ratio, Sortino Ratio, Treynor Ratio backend calculators
- [ ] Value at Risk, Maximum Drawdown, Beta, Correlation, R-Squared
- [ ] Monte Carlo portfolio simulation
- [ ] AI-powered portfolio insights and recommendations
- [ ] Mobile-responsive UI refinements
- [ ] Production deployment with monitoring and observability

---

## Author

**Arsen Labovich**
- GitHub: [@ArsenLabovich](https://github.com/ArsenLabovich)
- LinkedIn: [arsen-labovich](https://linkedin.com/in/arsen-labovich)

---

## License

This project is licensed under the MIT License.
