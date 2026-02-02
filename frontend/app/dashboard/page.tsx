"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { NetWorthCard } from "@/components/dashboard/NetWorthCard";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HistoryChart } from "@/components/dashboard/HistoryChart";
import { TopHoldingsWidget } from "@/components/dashboard/TopHoldingsWidget";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TreemapWidget } from "@/components/dashboard/TreemapWidget";
import { useRefresh } from "@/context/RefreshContext";
import { DashboardSummary } from "@/types/dashboard";

export default function DashboardPage() {
    const { refreshKey } = useRefresh();
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [historyRange, setHistoryRange] = useState("1d");

    const fetchData = async () => {
        try {
            const response = await api.get("/dashboard/summary");
            setSummary(response.data);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [refreshKey]);

    // Placeholder data for initial skeleton
    const skeletonData: DashboardSummary = {
        net_worth: 0,
        daily_change: 0,
        allocation: [],
        history: [],
        holdings: [],
        movers: { top_gainer: null, top_loser: null }
    };

    const displayData = summary || skeletonData;

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
                        Dashboard
                    </h1>
                    <p className="text-gray-400">Overview of your portfolio performance.</p>
                </div>
            </header>

            {/* Row 1: Net Worth & Key Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Net Worth (1 col) */}
                <div className="lg:col-span-1 h-full min-h-[220px]">
                    <NetWorthCard
                        totalValue={displayData.net_worth}
                        dailyChange={displayData.daily_change}
                        isLoading={loading}
                    />
                </div>

                {/* Stats Grid (2 cols) */}
                <div className="lg:col-span-2">
                    <StatsGrid
                        movers={displayData.movers}
                        allocation={displayData.allocation}
                        holdings={displayData.holdings}
                        cashValue={displayData.cash_value}
                        isLoading={loading}
                    />
                </div>
            </div>

            {/* Row 2: Performance History */}
            <div className="h-[400px]">
                <HistoryChart
                    data={displayData.history}
                    isLoading={loading}
                    range={historyRange}
                    onRangeChange={setHistoryRange}
                />
            </div>

            {/* Row 3: Composition (Treemap + Allocation) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                {/* Treemap (2 cols) */}
                <div className="lg:col-span-2 h-full">
                    <TreemapWidget
                        data={displayData.holdings}
                        isLoading={loading}
                    />
                </div>

                {/* Allocation (1 col) */}
                <div className="lg:col-span-1 h-full">
                    <AllocationChart
                        data={displayData.allocation}
                        isLoading={loading}
                    />
                </div>
            </div>

            {/* Row 4: Top Holdings List */}
            <div>
                <TopHoldingsWidget
                    data={displayData.holdings}
                    isLoading={loading}
                />
            </div>
        </div>
    );
}
