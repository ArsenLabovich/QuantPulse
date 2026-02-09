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
}

export interface HistoryItem {
    date: string;
    value: number;
    [key: string]: any;
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
