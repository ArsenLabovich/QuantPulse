export interface HoldingItem {
    symbol: string;
    name: string;
    icon_url?: string | null;
    price: number;
    price_usd: number;
    currency?: string;
    balance: number;
    value_usd: number;
    change_24h?: number | null;
}

export interface DetailedHoldingItem extends HoldingItem {
    integration_id: string;
    integration_name: string;
    provider_id: string;
    asset_type: string;
}

export interface Movers {
    top_gainer?: HoldingItem | null;
    top_loser?: HoldingItem | null;
}

export interface AllocationItem {
    name: string;
    value: number;
    percentage: number;
    color?: string;
    [key: string]: unknown;
}

export interface HistoryItem {
    date: string;
    value: number;
    [key: string]: unknown;
}

export interface IntervalPreset {
    label: "1W" | "1M" | "3M" | "1Y" | "Custom";
    value: string; // "1w", "1m", "3m", "1y", "custom"
    days?: number;
}

export interface VolatilityFilterState {
    search: string;
    assetType: "all" | "crypto" | "stock";
    provider: string;
}

export interface AssetVolatility {
    symbol: string;
    daily_vol: number | null;
    annual_vol: number | null;
    data_points: number;
    status: "ready" | "insufficient_data" | "pending";
}

export interface PortfolioVolatility {
    annual_vol: number | null;
    daily_vol: number | null;
    display_value: string;
    data_points: number;
    alignment_loss: number;
    confidence: "low" | "moderate" | "high" | null;
    rolling_30d: { date: string; value: number }[];
    status: string;
}

export interface VolatilityResult {
    portfolio: PortfolioVolatility;
    per_asset: AssetVolatility[];
}

export interface DashboardSummary {
    net_worth: number;
    daily_change: number;
    allocation: AllocationItem[];
    history: HistoryItem[];
    holdings: HoldingItem[];
    movers: Movers;
    cash_value?: number;
}
