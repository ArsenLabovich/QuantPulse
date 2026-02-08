"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { PortfolioTable, PortfolioFilterState } from "@/components/dashboard/HoldingsTable";
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary";
import { AssetDetailsDrawer } from "@/components/dashboard/AssetDetailsDrawer";
import { useRefresh } from "@/context/RefreshContext";
import { DetailedHoldingItem } from "@/types/dashboard";
import { motion, AnimatePresence } from "framer-motion";

// Helper: Aggregation Logic (Lifted State)
function aggregateBySymbol(items: DetailedHoldingItem[]): DetailedHoldingItem[] {
    const map = new Map<string, DetailedHoldingItem>();

    for (const item of items) {
        if (!map.has(item.symbol)) {
            map.set(item.symbol, { ...item, integration_name: "Multiple", provider_id: "multiple" });
        } else {
            const existing = map.get(item.symbol)!;
            const totalVal = existing.value_usd + item.value_usd;
            const totalBal = existing.balance + item.balance;
            const existingWeight = existing.value_usd * (existing.change_24h || 0);
            const itemWeight = item.value_usd * (item.change_24h || 0);
            const newChange = totalVal > 0 ? (existingWeight + itemWeight) / totalVal : 0;

            existing.value_usd = totalVal;
            existing.balance = totalBal;
            existing.change_24h = newChange;
            existing.price_usd = totalBal > 0 ? totalVal / totalBal : existing.price_usd;

            if (!existing.icon_url && item.icon_url) {
                existing.icon_url = item.icon_url;
            }
        }
    }
    return Array.from(map.values());
}

export default function PortfolioPage() {
    const { refreshKey } = useRefresh();
    const [holdings, setHoldings] = useState<DetailedHoldingItem[]>([]);
    const [selectedAsset, setSelectedAsset] = useState<DetailedHoldingItem | null>(null);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [filters, setFilters] = useState<PortfolioFilterState>({
        search: "",
        hideDust: true,
        selectedProvider: "all",
        viewMode: "aggregated",
        groupByProvider: false
    });

    const fetchData = async () => {
        try {
            const response = await api.get("/dashboard/holdings");
            if (response.data) {
                setHoldings(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch detailed holdings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [refreshKey]);

    // Derived Filtered Data for Summary & Table
    const filteredData = useMemo(() => {
        let result = holdings;

        // 1. Filter
        if (filters.hideDust) result = result.filter(i => i.value_usd >= 1.0);
        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
        }
        if (filters.selectedProvider !== 'all') {
            result = result.filter(i => i.integration_name === filters.selectedProvider);
        }

        // 2. Aggregation
        if (filters.viewMode === 'aggregated' && !filters.groupByProvider) {
            result = aggregateBySymbol(result);
        }

        return result;
    }, [holdings, filters]);

    // Calculate aggregated count for summary
    const assetCount = useMemo(() => {
        return filters.viewMode === 'aggregated' && !filters.groupByProvider
            ? aggregateBySymbol(holdings).length
            : holdings.length;
    }, [holdings, filters.viewMode, filters.groupByProvider]);

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#0E1117] relative"> {/* Fixed height, no window scroll */}

            {/* 1. Fixed Header Section */}
            <div className="shrink-0 px-8 py-6 border-b border-[#2A2E39]/50 bg-[#0E1117] z-20">
                <div className="max-w-[1920px] mx-auto w-full">
                    <h1 className="text-3xl font-bold text-white mb-1">Portfolio Overview</h1>
                    <p className="text-gray-400 text-sm">Deep dive into your assets, performance, and allocation.</p>
                </div>
            </div>

            {/* 2. Main Content Area (Flex Row) */}
            <div className="flex-1 min-h-0 flex relative">

                {/* Left Column: Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-[1920px] mx-auto w-full space-y-6 pb-20">
                        {/* Smart Summary */}
                        <PortfolioSummary
                            filteredData={filteredData}
                            totalPortfolioValue={holdings.reduce((sum, item) => sum + item.value_usd, 0)}
                            totalAssetCount={assetCount}
                            isLoading={loading}
                        />

                        {/* Main Table */}
                        <div className="min-h-[500px]">
                            <PortfolioTable
                                data={filteredData}
                                allData={holdings}
                                filters={filters}
                                onFilterChange={setFilters}
                                isLoading={loading}
                                onAssetSelect={setSelectedAsset}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Static Sidebar Widget */}
                {/* It sits here in the flex row, taking up valid space when open */}
                <AssetDetailsDrawer
                    isOpen={!!selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    holdings={selectedAsset ? holdings.filter(h => h.symbol === selectedAsset.symbol) : []}
                />

            </div>
        </div>
    );
}
