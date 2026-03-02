"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/lib/api";
import { DetailedHoldingItem, VolatilityResult, IntervalPreset, VolatilityFilterState, AssetVolatility } from "@/types/dashboard";
import { aggregateAssetsBySymbol } from "@/lib/assets";
import { Loader2, RefreshCw, Info } from "lucide-react";

// Placeholder imports for subcomponents (will be created next)
import { VolatilityFilters } from "./VolatilityFilters";
import { VolatilityAssetTable } from "./VolatilityAssetTable";
import { RiskContributionPanel } from "./RiskContributionPanel";
import { VolatilityStats } from "./VolatilityStats";
import { VolatilityChart } from "./VolatilityChart";
import { IntervalSelector } from "./IntervalSelector";

export default function VolatilityPage() {
    // --- State ---
    const [assets, setAssets] = useState<DetailedHoldingItem[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(true);

    // Selection & Filters
    const [selectedSymbolIds, setSelectedSymbolIds] = useState<Set<string>>(new Set());
    const [interval, setInterval] = useState<IntervalPreset>({ label: "1Y", value: "1y", days: 365 });
    const [filterState, setFilterState] = useState<VolatilityFilterState>({
        search: "",
        assetType: "all",
        provider: "all"
    });

    // Results
    const [calculationResult, setCalculationResult] = useState<VolatilityResult | null>(null);
    const [volatilityCache, setVolatilityCache] = useState<Map<string, AssetVolatility>>(new Map());
    const [progressState, setProgressState] = useState<{
        stage: string;
        current: number;
        total: number;
        symbol: string;
    } | null>(null);

    const isCalculating = progressState !== null;

    // Dirty State (tracking changes since last calculation)
    const [lastCalculatedHash, setLastCalculatedHash] = useState<string>("");

    // --- Data Fetching ---
    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const res = await api.get("/dashboard/holdings");
                if (res.data) {
                    setAssets(res.data);
                    // Initial selection: All assets
                    const allAssets = res.data.map((a: DetailedHoldingItem) => a.symbol);
                    setSelectedSymbolIds(new Set(allAssets));
                }
            } catch (err) {
                console.error(err);
                // alert("Failed to load assets");
            } finally {
                setLoadingAssets(false);
            }
        };
        fetchAssets();
    }, []);

    // --- Computed ---
    const currentHash = useMemo(() => {
        const ids = Array.from(selectedSymbolIds).sort().join(",");
        return `${ids}|${interval.value}`;
    }, [selectedSymbolIds, interval]);

    const providers = useMemo(() => {
        const set = new Set<string>();
        assets.forEach(a => {
            if (a.integration_name) set.add(a.integration_name);
        });
        return Array.from(set).sort();
    }, [assets]);

    const isDirty = currentHash !== lastCalculatedHash;
    const canCalculate = selectedSymbolIds.size > 0;

    const aggregatedAssets = useMemo(() => {
        return aggregateAssetsBySymbol(assets);
    }, [assets]);

    const filteredAssets = useMemo(() => {
        let res = aggregatedAssets;
        if (filterState.search) {
            const q = filterState.search.toLowerCase();
            res = res.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
        }
        if (filterState.assetType !== "all") {
            res = res.filter(a => a.asset_type?.toLowerCase() === filterState.assetType);
        }
        if (filterState.provider !== "all") {
            // Check original assets to see which symbols are in the selected provider
            const symbolsInProvider = new Set(
                assets.filter(a => a.integration_name === filterState.provider).map(a => a.symbol.trim().toUpperCase())
            );
            res = res.filter(a => symbolsInProvider.has(a.symbol.trim().toUpperCase()));
        }
        return res;
    }, [aggregatedAssets, assets, filterState]);



    // --- Handlers ---
    const handleToggleAsset = useCallback((symbol: string) => {
        setSelectedSymbolIds(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) next.delete(symbol);
            else next.add(symbol);
            return next;
        });
    }, []);

    const handleToggleAll = useCallback(() => {
        const allFilteredSymbols = filteredAssets.map(a => a.symbol);
        const allSelected = allFilteredSymbols.every(s => selectedSymbolIds.has(s));

        setSelectedSymbolIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                // Unselect all that are in the filtered view
                allFilteredSymbols.forEach(s => next.delete(s));
            } else {
                // Select all that are in the filtered view
                allFilteredSymbols.forEach(s => next.add(s));
            }
            return next;
        });
    }, [filteredAssets, selectedSymbolIds]);

    const volatilityDataArray = useMemo(() => {
        return Array.from(volatilityCache.values());
    }, [volatilityCache]);

    const handleCalculate = useCallback(async () => {
        if (!canCalculate || isCalculating) return;

        setProgressState({ stage: "starting", current: 0, total: 0, symbol: "" });

        try {
            const endDate = new Date();
            const startDate = new Date();
            if (interval.days) {
                startDate.setDate(endDate.getDate() - interval.days);
            } else {
                startDate.setFullYear(endDate.getFullYear() - 1);
            }

            const payload = {
                symbols: Array.from(selectedSymbolIds),
                start_date: startDate.toISOString().split("T")[0],
                end_date: endDate.toISOString().split("T")[0],
            };

            // Phase 1: Dispatch task to Celery worker (or get cached result)
            const dispatchRes = await api.post("/analytics/volatility/compute", payload);

            if (dispatchRes.data.status === "cached") {
                setCalculationResult(dispatchRes.data.result);
                setVolatilityCache(prev => {
                    const next = new Map(prev);
                    dispatchRes.data.result.per_asset.forEach((a: AssetVolatility) => next.set(a.symbol, a));
                    return next;
                });
                setLastCalculatedHash(currentHash);
                setProgressState(null);
                return;
            }

            const taskId = dispatchRes.data.task_id;

            // Phase 2: Subscribe to progress via SSE
            const token = localStorage.getItem("token");
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

            const response = await fetch(
                `${baseUrl}/analytics/volatility/progress/${taskId}`,
                {
                    method: "GET",
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error("No response body");

            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            if (event.stage === "done") {
                                setCalculationResult(event.result);
                                setVolatilityCache(prev => {
                                    const next = new Map(prev);
                                    event.result.per_asset.forEach((a: AssetVolatility) => next.set(a.symbol, a));
                                    return next;
                                });
                                setLastCalculatedHash(currentHash);
                            } else if (event.stage === "error") {
                                throw new Error(event.message || "Calculation failed");
                            } else {
                                setProgressState({
                                    stage: event.stage,
                                    current: event.current || 0,
                                    total: event.total || 0,
                                    symbol: event.symbol || "",
                                });
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== "Calculation failed") {
                                /* skip malformed SSE lines */
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error(error);
            alert("Calculation failed");
        } finally {
            setProgressState(null);
        }
    }, [canCalculate, isCalculating, interval, selectedSymbolIds, currentHash]);

    // Progress text for button
    const progressText = useMemo(() => {
        if (!progressState) return "Apply Changes";
        switch (progressState.stage) {
            case "starting":
                return "Starting...";
            case "fetching":
                return `Fetching data ${progressState.current} / ${progressState.total}`;
            case "calculating":
                return "Calculating volatility...";
            default:
                return "Processing...";
        }
    }, [progressState]);

    // Auto-calculate on first load if we have defaults? 
    // Maybe better to wait for user action, or auto-calc for initial 5 assets.
    // Let's doing it once assets are loaded.
    useEffect(() => {
        if (!loadingAssets && assets.length > 0 && lastCalculatedHash === "" && selectedSymbolIds.size > 0) {
            handleCalculate();
        }
    }, [loadingAssets, assets, lastCalculatedHash, selectedSymbolIds, handleCalculate]);

    const totalValue = useMemo(() => {
        return aggregatedAssets.reduce((sum, a) => sum + a.value_usd, 0);
    }, [aggregatedAssets]);


    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#0E1117] relative">
            {/* Header */}
            <div className="shrink-0 px-8 py-6 border-b border-[#2A2E39]/50 bg-[#0E1117] z-20 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Volatility Analysis</h1>
                    <p className="text-gray-400 text-sm">Analyze risk metrics and asset correlation.</p>
                </div>

                <div className="flex items-center gap-4">
                    <IntervalSelector value={interval} onChange={setInterval} />

                    <button
                        onClick={handleCalculate}
                        disabled={!canCalculate || isCalculating || !isDirty}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all min-w-[200px] justify-center ${isCalculating
                            ? "bg-[#2A2E39] text-gray-400 cursor-not-allowed"
                            : canCalculate && isDirty
                                ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                : "bg-[#2A2E39] text-gray-500 cursor-not-allowed"
                            }`}
                    >
                        {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {progressText}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex relative">
                {/* Left: Scrollable Analysis Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-[1920px] mx-auto w-full space-y-6 pb-20">

                        {/* 1. Stats Cards */}
                        <VolatilityStats result={calculationResult} isLoading={isCalculating} totalValue={totalValue} />

                        {/* 2. Chart & Contribution Panel */}
                        {calculationResult && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-[#1E222D] rounded-2xl border border-[#2A2E39] p-6 h-[450px] flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-white">
                                            Risk Trend (30-Day Moving Average)
                                        </h3>
                                        <div 
                                            title="Shows how your portfolio's risk profile has evolved over time. Spikes indicate periods of market turbulence." 
                                            className="cursor-help text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            <Info className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-xs mb-4">
                                        Calculated as annualized volatility on a rolling 30-day window.
                                    </p>
                                    <div className="flex-1 min-h-0">
                                        <VolatilityChart data={calculationResult.portfolio.rolling_30d} />
                                    </div>
                                </div>
                                <div className="lg:col-span-1">
                                    <RiskContributionPanel assets={aggregatedAssets} selectedIds={selectedSymbolIds} />
                                </div>
                            </div>
                        )}

                        {/* 3. Asset Table (Selection & Per-Asset Results) */}
                        <div className="bg-[#1E222D] rounded-2xl border border-[#2A2E39] overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-[#2A2E39] flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white">Asset Selection & Metrics</h3>
                                <VolatilityFilters
                                    state={filterState}
                                    onChange={setFilterState}
                                    providers={providers}
                                />
                            </div>

                            <VolatilityAssetTable
                                assets={filteredAssets}
                                selectedIds={selectedSymbolIds}
                                onToggle={handleToggleAsset}
                                onToggleAll={handleToggleAll}
                                volatilityData={volatilityDataArray}
                                totalValue={totalValue}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
