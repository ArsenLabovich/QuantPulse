"use client";

import { motion, useSpring, useTransform, useMotionValue, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Layers, Wallet, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { DetailedHoldingItem } from "@/types/dashboard";

interface PortfolioSummaryProps {
    filteredData: DetailedHoldingItem[];
    totalPortfolioValue: number;
    totalAssetCount: number;
    isLoading: boolean;
}

// Helper for animated numbers
function AnimatedCounter({ value, currency = false, percentage = false, decimals = 2 }: { value: number, currency?: boolean, percentage?: boolean, decimals?: number }) {
    const motionValue = useMotionValue(0);
    const springValue = useSpring(motionValue, { damping: 30, stiffness: 200 });
    const displayValue = useTransform(springValue, (latest) => {
        if (currency) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }).format(latest);
        }
        if (percentage) {
            return `${latest > 0 ? '+' : ''}${latest.toFixed(decimals)}%`;
        }
        return Math.round(latest).toString();
    });

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    return <motion.span>{displayValue}</motion.span>;
}

// Helper for asset icon
type AssetIconProps = {
    url?: string | null;
    symbol: string;
    className: string;
};

const AssetIcon = ({ url, symbol, className }: AssetIconProps) => {
    const [imgSrc, setImgSrc] = useState(url || "/icons/generic_asset.png");

    useEffect(() => {
        setImgSrc(url || "/icons/generic_asset.png");
    }, [url]);

    // Handle image error by falling back to generic asset icon
    const handleError = () => {
        if (imgSrc !== "/icons/generic_asset.png") {
            setImgSrc("/icons/generic_asset.png");
        }
    };

    return (
        <img
            src={imgSrc}
            className={className}
            alt={symbol}
            onError={handleError}
        />
    );
};

export function PortfolioSummary({ filteredData, totalPortfolioValue, totalAssetCount, isLoading }: PortfolioSummaryProps) {
    if (isLoading) {
        return <div className="h-40 bg-[#1E222D] rounded-xl animate-pulse w-full mb-8" />;
    }

    // 1. Calculate Metrics based on FILTERED data
    const totalValue = filteredData.reduce((sum, item) => sum + item.value_usd, 0);

    // Weighted 24h Change
    const totalWeightedChange = totalValue > 0
        ? filteredData.reduce((sum, item) => sum + (item.change_24h || 0) * item.value_usd, 0) / totalValue
        : 0;

    const totalPnLValue = totalValue * (totalWeightedChange / 100);

    const assetCount = filteredData.length;

    // Top Mover in Selection
    // If all changes are 0 or collection is small, we still pick the first one
    const sortedMovers = [...filteredData].sort((a, b) => (b.change_24h || 0) - (a.change_24h || 0));
    const topMover = sortedMovers[0];

    // Check if there's any actual movement data
    const hasMovementData = sortedMovers.some(item => (item.change_24h || 0) !== 0);

    // --- NEW METRICS ---

    // 1. Portfolio Allocation
    const allocationPercentage = totalPortfolioValue > 0 ? (totalValue / totalPortfolioValue) * 100 : 0;

    // 2. Profitability Split
    const winners = filteredData.filter(i => (i.change_24h || 0) > 0).length;
    const neutrals = filteredData.filter(i => (i.change_24h || 0) === 0).length;
    const losers = filteredData.filter(i => (i.change_24h || 0) < 0).length;

    // Total for calculating bar widths
    const totalForBar = winners + neutrals + losers || 1; // avoid division by zero

    const winnersWidth = (winners / totalForBar) * 100;
    const neutralsWidth = (neutrals / totalForBar) * 100;
    const losersWidth = (losers / totalForBar) * 100;

    // 3. Top Allocation (Dominance)
    const topAllocationAsset = [...filteredData].sort((a, b) => b.value_usd - a.value_usd)[0];
    const dominancePercentage = topAllocationAsset && totalValue > 0 ? (topAllocationAsset.value_usd / totalValue) * 100 : 0;


    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mb-8">
            {/* 
                ROW 1 
            */}

            {/* 1. Filtered Balance (Compacted yet Premium) */}
            <div className="lg:col-span-6 bg-gradient-to-br from-[#1E222D] to-[#131722] rounded-2xl p-6 border border-[#2A2E39] relative overflow-hidden group">
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <h2 className="text-[#909399] font-medium text-sm mb-1 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-[#3978FF]" />
                            Filtered Balance
                        </h2>
                        <div className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-2">
                            <AnimatedCounter value={totalValue} currency />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                        {(() => {
                            const isNeutral = Math.abs(totalWeightedChange) < 0.005;
                            const isPositive = totalWeightedChange >= 0;
                            
                            let colorClass = "";
                            let Icon = null;
                            let sign = "";

                            if (isNeutral) {
                                colorClass = "bg-gray-500/10 border-gray-500/20 text-gray-400";
                                Icon = Minus;
                                sign = "";
                            } else if (isPositive) {
                                colorClass = "bg-[#00C805]/10 border-[#00C805]/20 text-[#00C805]";
                                Icon = TrendingUp;
                                sign = "+";
                            } else {
                                colorClass = "bg-[#FF3B30]/10 border-[#FF3B30]/20 text-[#FF3B30]";
                                Icon = TrendingDown;
                                sign = "-";
                            }

                            return (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass}`}>
                                    <Icon className="w-4 h-4" />
                                    <span className="font-bold">
                                        <AnimatedCounter value={Math.abs(totalWeightedChange)} percentage />
                                    </span>
                                    <span className="text-xs opacity-80 font-medium ml-1">
                                        {sign} <AnimatedCounter value={Math.abs(totalPnLValue)} currency />
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                {/* Background Decor */}
                <div className="absolute right-[-20px] top-[-20px] p-8 opacity-[0.03] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-500">
                    <div className="text-white text-9xl">$</div>
                </div>
            </div>

            {/* 2. Portfolio Allocation (Donut) */}
            <div className="lg:col-span-3 bg-[#1E222D] rounded-2xl p-5 border border-[#2A2E39] flex flex-col items-center justify-center gap-4 group hover:border-[#3978FF]/30 transition-colors relative overflow-hidden">
                <p className="text-[#909399] font-medium text-sm z-10 absolute top-5 left-5">Selection Share</p>

                <div className="relative w-28 h-28 mt-4 z-10">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="56" cy="56" r="48"
                            stroke="#2A2E39" strokeWidth="8" fill="transparent"
                        />
                        <circle
                            cx="56" cy="56" r="48"
                            stroke="#3978FF" strokeWidth="8" fill="transparent"
                            strokeDasharray={301.59}
                            strokeDashoffset={301.59 - (301.59 * allocationPercentage) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                        {(totalValue < totalPortfolioValue && allocationPercentage > 99.99) ? "99.99" : allocationPercentage.toFixed(2)}%
                    </div>
                </div>

                <div className="text-center z-10 flex flex-col items-center">
                    <p className="text-sm font-bold text-gray-300 mb-1 flex items-center gap-1">
                        <AnimatedCounter value={totalValue} currency decimals={2} />
                        <span className="text-[#5E626B] font-normal">of</span>
                        <AnimatedCounter value={totalPortfolioValue} currency decimals={2} />
                    </p>
                    <p className="text-xs text-[#5E626B]">
                        Total Portfolio
                    </p>
                </div>

                {/* Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#3978FF]/5 blur-2xl rounded-full pointer-events-none" />
            </div>

            {/* 3. Top Allocation / Dominance */}
            <div className="lg:col-span-3 bg-[#1E222D] rounded-2xl p-5 border border-[#2A2E39] flex flex-col justify-between group hover:border-[#3978FF]/30 transition-colors relative overflow-hidden">
                <p className="text-[#909399] font-medium text-sm z-10">Top Allocation</p>

                {topAllocationAsset ? (
                    <div className="mt-4 flex flex-col items-center justify-between flex-1 z-10">
                        {/* Centered Icon & Name */}
                        <div className="flex flex-col items-center gap-3 mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-[#2A2E39] flex items-center justify-center shrink-0 overflow-hidden p-2 shadow-lg border border-[#2A2E39]">
                                <AssetIcon
                                    url={topAllocationAsset.icon_url}
                                    symbol={topAllocationAsset.symbol}
                                    className="w-full h-full object-cover rounded-xl"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="font-bold text-white text-2xl tracking-tight">{topAllocationAsset.symbol}</span>
                                {topAllocationAsset.name && (
                                    <span className="text-xs font-medium text-[#909399] mt-1 text-center max-w-[200px] truncate">
                                        {topAllocationAsset.name}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Stats Row & Bar */}
                        <div className="w-full mt-auto">
                            <div className="flex items-center justify-between text-sm mb-2 px-1">
                                <span className="text-[#909399] font-medium">
                                    <AnimatedCounter value={topAllocationAsset.value_usd} currency decimals={0} />
                                </span>
                                <span className="text-[#3978FF] font-bold text-lg">{Math.round(dominancePercentage)}%</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-[#2A2E39] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${dominancePercentage}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-[#3978FF] rounded-full"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-2 text-sm text-gray-500">No assets</div>
                )
                }
                {/* Glow */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#3978FF]/5 blur-2xl rounded-full pointer-events-none" />
            </div >


            {/* 
                ROW 2 
            */}

            {/* 4. Profitability Split (Winners vs Neutrals vs Losers) */}
            <div className="lg:col-span-4 bg-[#1E222D] rounded-2xl p-5 border border-[#2A2E39] flex flex-col justify-center group hover:border-[#3978FF]/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[#909399] font-medium text-sm">Profitability (24h)</p>
                    <div className="flex gap-3 text-sm font-bold">
                        <span className="text-[#00C805] flex items-center gap-1" title="Gainers">
                            <ArrowUpRight className="w-3 h-3" /> {winners}
                        </span>
                        <span className="text-gray-400 flex items-center gap-1" title="Neutral">
                            <Minus className="w-3 h-3" /> {neutrals}
                        </span>
                        <span className="text-[#FF3B30] flex items-center gap-1" title="Losers">
                            <ArrowDownRight className="w-3 h-3" /> {losers}
                        </span>
                    </div>
                </div>

                {/* Visual Split Bar */}
                <div className="w-full h-2 bg-[#2A2E39] rounded-full overflow-hidden flex">
                    {/* Winners */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${winnersWidth}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-[#00C805]"
                    />
                    {/* Neutrals */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${neutralsWidth}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                        className="h-full bg-gray-500"
                    />
                    {/* Losers */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${losersWidth}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-[#FF3B30]"
                    />
                </div>
            </div>

            {/* 5. Active Assets (Simple Count) */}
            <div className="lg:col-span-4 bg-[#1E222D] rounded-2xl p-5 border border-[#2A2E39] flex items-center justify-between group hover:border-[#3978FF]/30 transition-colors relative overflow-hidden h-[120px]">
                <div className="relative z-10">
                    <p className="text-[#909399] font-medium text-sm mb-1">Active Assets</p>
                    <p className="text-4xl font-bold text-white">
                        <AnimatedCounter value={assetCount} decimals={0} />
                    </p>
                </div>

                {/* Centered Stats */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
                    <p className="text-2xl font-bold text-[#909399] opacity-90">
                        {assetCount}<span className="text-[#5E626B] text-lg font-medium mx-1">/</span>{totalAssetCount}
                    </p>
                    <p className="text-[10px] text-[#5E626B] font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap">
                        Total Assets
                    </p>
                </div>

                {/* Background Decor */}
                <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-500 scale-150">
                    <Layers className="w-24 h-24 text-white" />
                </div>
            </div>

            {/* 6. Top Performer */}
            <div className="lg:col-span-4 bg-[#1E222D] rounded-2xl p-5 border border-[#2A2E39] flex flex-col justify-center group hover:border-[#3978FF]/30 transition-colors relative overflow-hidden">

                <div className="relative z-10">
                    <p className="text-[#909399] font-medium text-sm mb-3">Top Performer (24h)</p>
                    {topMover ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#2A2E39] flex items-center justify-center shrink-0 overflow-hidden">
                                    <AssetIcon
                                        url={topMover.icon_url}
                                        symbol={topMover.symbol}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-base truncate max-w-[120px]">{topMover.symbol}</p>
                                    <p className="text-xs text-[#909399]">${topMover.price_usd.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className={`text-right ${hasMovementData && topMover.change_24h && topMover.change_24h >= 0 ? 'text-[#00C805]' : (!hasMovementData ? 'text-gray-500' : 'text-[#FF3B30]')}`}>
                                <p className="font-bold text-base flex items-center justify-end gap-1">
                                    {!hasMovementData ? (
                                        <span>--</span>
                                    ) : (
                                        <>
                                            {topMover.change_24h && topMover.change_24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                            {Math.abs(topMover.change_24h || 0).toFixed(2)}%
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-xs">No data available</p>
                    )}
                </div>

                {/* Background Decor */}
                <div className="absolute right-[-10px] top-[-10px] opacity-[0.05] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-500">
                    <TrendingUp className="w-32 h-32 text-white" />
                </div>
            </div>
        </div >
    );
}
