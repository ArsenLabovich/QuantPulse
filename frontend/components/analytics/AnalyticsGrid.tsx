"use client";

import { useState, useEffect, useCallback } from "react";
import { AnalyticsWidget } from "./AnalyticsWidget";
import {
    TrendingUp, ShieldAlert, Activity, Award, TrendingDown,
    Anchor, Grid, ArrowDownRight, Target, Scale, Filter
} from "lucide-react";
import api from "@/lib/api";

type AssetFilter = "all" | "crypto" | "stocks";
type MetricData = {
    value: number | null;
    display_value: string;
    status: string;
    confidence: string | null;
};

const FILTER_OPTIONS: { value: AssetFilter; label: string }[] = [
    { value: "all", label: "All Assets" },
    { value: "crypto", label: "Crypto Only" },
    { value: "stocks", label: "Stocks Only" },
];

export function AnalyticsGrid() {
    const [filter, setFilter] = useState<AssetFilter>("all");
    const [volatility, setVolatility] = useState<MetricData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/analytics/summary?asset_filter=${filter}`);
            if (data.volatility) setVolatility(data.volatility);
        } catch {
            setVolatility(null);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    const volDisplay = loading
        ? "..."
        : volatility?.status === "ready"
            ? volatility.display_value
            : "--";

    const volConfidence = volatility?.confidence;

    return (
        <div className="flex flex-col gap-10">

            {/* Asset Filter */}
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#71717A]" />
                <div className="flex gap-1 bg-[#121212] border border-[#27272A] rounded-xl p-1">
                    {FILTER_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filter === opt.value
                                    ? "bg-[#27272A] text-white"
                                    : "text-[#71717A] hover:text-[#A1A1AA]"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {volConfidence && volConfidence !== "high" && (
                    <span className="text-[10px] text-amber-500/70 ml-2">
                        ⚠ {volConfidence} confidence
                    </span>
                )}
            </div>

            {/* Performance */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Performance Attributes</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AnalyticsWidget title="Sharpe Ratio" value="--" description="Evaluates the portfolio performance by adjusting for the level of total risk exposure." subValue="Risk-Adjusted Return" icon={Award} href="/dashboard/analytics/sharpe" theme="green" />
                    <AnalyticsWidget title="Sortino Ratio" value="--" description="Assesses the return profile specifically against negative price fluctuations." subValue="Downside Risk-Adjusted" icon={ArrowDownRight} href="/dashboard/analytics/sortino" theme="green" />
                    <AnalyticsWidget title="Treynor Ratio" value="--" description="Quantifies the relationship between excess returns and systematic market risk." subValue="Excess Return / Beta" icon={Scale} href="/dashboard/analytics/treynor" theme="green" />
                    <AnalyticsWidget title="Monte Carlo Simulation" value="--" description="Employs statistical modeling to project the probability distribution of future results." subValue="Future Projections" icon={TrendingUp} href="/dashboard/analytics/monte-carlo" theme="green" />
                </div>
            </section>

            {/* Risk */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-rose-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Risk Profile</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnalyticsWidget title="Value at Risk" value="--" description="Estimates the maximum potential loss within a specified timeframe and confidence interval." subValue="Potential Daily Loss" icon={ShieldAlert} href="/dashboard/analytics/risk" theme="red" />
                    <AnalyticsWidget title="Maximum Drawdown" value="--" description="Measures the largest peak-to-trough decline in capital before recovery." subValue="Historical Peak-to-Trough" icon={TrendingDown} href="/dashboard/analytics/drawdown" theme="red" />
                    <AnalyticsWidget
                        title="Volatility"
                        value={volDisplay}
                        description="Indicates the degree of variation in asset prices over a defined chronological period."
                        subValue="Annualized Standard Deviation"
                        icon={Activity}
                        href="/dashboard/analytics/volatility"
                        theme="red"
                    />
                </div>
            </section>

            {/* Market Fit */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                    <h2 className="text-lg font-semibold text-white">Market Correlation</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnalyticsWidget title="Beta" value="--" description="Measures the sensitivity of portfolio returns relative to broader market movements." subValue="Market Sensitivity" icon={Anchor} href="/dashboard/analytics/beta" theme="blue" />
                    <AnalyticsWidget title="Correlation Matrix" value="--" description="Analyzes the linear relationship between the price movements of different securities." subValue="Asset Diversification" icon={Grid} href="/dashboard/analytics/correlations" theme="blue" />
                    <AnalyticsWidget title="R-Squared" value="--" description="Determines the percentage of portfolio price movement explained by the benchmark." subValue="Benchmark Correlation" icon={Target} href="/dashboard/analytics/r-squared" theme="blue" />
                </div>
            </section>

        </div>
    );
}
