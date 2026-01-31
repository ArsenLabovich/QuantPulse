"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { NetWorthCard } from "@/components/dashboard/NetWorthCard";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { HistoryChart } from "@/components/dashboard/HistoryChart";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { MoversWidget } from "@/components/dashboard/MoversWidget";
import { useRefresh } from "@/context/RefreshContext";
import { motion } from "framer-motion";
import { DashboardSummary } from "@/types/dashboard";

export default function DashboardPage() {
    const { refreshKey } = useRefresh();
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [historyRange, setHistoryRange] = useState("1d");

    const fetchData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
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
        // Initial load (show loading) or Refresh trigger (silent or animated)
        fetchData(refreshKey === 0);
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
        <motion.div
            key={refreshKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-8 space-y-8"
        >
            <header className="flex justify-between items-start mb-8 relative z-20">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
                        Dashboard
                    </h1>
                    <p className="text-gray-400">Overview of your portfolio performance.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Hero / Net Worth */}
                <div className="md:col-span-1 h-[300px]">
                    <NetWorthCard
                        totalValue={displayData.net_worth}
                        dailyChange={displayData.daily_change}
                        isLoading={loading}
                    />
                </div>

                {/* Allocation Donut */}
                <div className="md:col-span-2 h-[300px]">
                    <AllocationChart
                        data={displayData.allocation}
                        isLoading={loading}
                    />
                </div>
            </div>

            {/* History Chart */}
            <div className="h-[400px] mb-8">
                <HistoryChart
                    data={displayData.history}
                    isLoading={loading}
                    range={historyRange}
                    onRangeChange={setHistoryRange}
                />
            </div>

            {/* Movers & Holdings */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4">Assets</h2>

                {displayData.movers && (
                    <MoversWidget
                        gainer={displayData.movers.top_gainer}
                        loser={displayData.movers.top_loser}
                    />
                )}

                <HoldingsTable
                    data={displayData.holdings}
                    isLoading={loading}
                />
            </div>
        </motion.div>
    );
}
