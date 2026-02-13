"use client";

import { HoldingItem, Movers, AllocationItem } from "@/types/dashboard";
import { TrendingUp, TrendingDown, Award, Wallet } from "lucide-react";
import Image from "next/image";

interface StatsGridProps {
    movers: Movers;
    allocation: AllocationItem[];
    holdings: HoldingItem[];
    cashValue?: number; // New optional prop
    isLoading: boolean;
}

export function StatsGrid({ movers, allocation, holdings, cashValue, isLoading }: StatsGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#1E222D] h-28 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    // Calculate Total Portfolio Value (Net Worth)
    const totalValue = holdings.reduce((sum, h) => sum + h.value_usd, 0);

    // 1. Calculate Cash
    // Use explicit backend value (includes stablecoins) or fallback to allocation search
    const allocationCashItem = allocation.find(a => a.name === "Cash" || a.name === "FIAT");
    const allocationCashValue = allocationCashItem ? allocationCashItem.value : 0;

    const finalCashValue = Math.max(cashValue || 0, allocationCashValue);
    const cashPercent = totalValue > 0 ? (finalCashValue / totalValue) * 100 : 0;

    // 2. Calculate Top Asset Dominance (Share of Portfolio)
    const sortedHoldings = [...holdings].sort((a, b) => b.value_usd - a.value_usd);
    const topAsset = sortedHoldings[0];
    const dominance = topAsset ? (topAsset.value_usd / totalValue) * 100 : 0;

    const stats = [
        {
            title: "Top Gainer",
            asset: movers.top_gainer,
            type: "asset",
            icon: TrendingUp,
            color: "text-[#00C805]",
            bgColor: "bg-[#00C805]/10"
        },
        {
            title: "Top Loser",
            asset: movers.top_loser,
            type: "asset",
            icon: TrendingDown,
            color: "text-[#FF3B30]",
            bgColor: "bg-[#FF3B30]/10"
        },
        {
            title: "Dominance",
            asset: topAsset,
            valueOverride: `${dominance.toFixed(1)}%`,
            type: "asset", // It's an asset but we highlight dominance
            icon: Award,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10"
        },
        {
            title: "Cash Drag",
            valueOverride: `${cashPercent.toFixed(1)}%`,
            subValueOverride: `$${finalCashValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
            type: "cash",
            icon: Wallet, // Changed to Wallet for better semantics
            color: "text-yellow-500",
            bgColor: "bg-yellow-500/10"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {stats.map((stat, idx) => {
                const Icon = stat.icon;
                const asset = stat.asset;

                // Prepare display values
                let name = "N/A";
                const symbol = "";
                let price = "";
                let changeStr = "";
                let changeColor = "text-gray-500";
                const iconUrl = asset?.icon_url;

                if (stat.type === "cash") {
                    name = "Liquid Cash";
                    price = stat.valueOverride || "0%";
                    changeStr = stat.subValueOverride || "$0";
                    changeColor = "text-gray-400";
                } else if (asset) {
                    name = asset.name; // Full Name

                    // Format Price in Original Currency
                    const currencyCode = asset.currency || "USD";
                    const priceValue = asset.price; // Use price (original) not price_usd

                    // Simple formatter
                    const formatter = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currencyCode,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });

                    // For Dominance, we show the % share as the main number
                    if (stat.title === "Dominance") {
                        price = stat.valueOverride || "0%";
                        changeStr = formatter.format(priceValue);
                    } else {
                        // Standard Asset (Gainer/Loser)
                        price = formatter.format(priceValue);

                        const change = asset.change_24h || 0;
                        const absChange = Math.abs(change);
                        const isZero = absChange < 0.01; // Treat < 0.01% as zero

                        changeStr = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;

                        if (isZero) {
                            changeColor = "text-gray-400"; // Gray for 0.00%
                        } else {
                            changeColor = change >= 0 ? "text-[#00C805]" : "text-[#FF3B30]";
                        }
                    }
                }

                return (
                    <div key={idx} className="bg-[#1E222D] rounded-xl p-5 border border-[#2A2E39] flex justify-between items-center hover:bg-[#252A36] transition-colors group">
                        {/* Left Side: Icon & Name */}
                        <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stat.bgColor} ${stat.color} relative overflow-hidden`}>
                                {iconUrl ? (
                                    <Image
                                        src={iconUrl}
                                        alt={symbol}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = "/icons/generic_asset.png";
                                        }}
                                    />
                                ) : (
                                    <Icon className="w-6 h-6" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1 pr-2">
                                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-0.5">{stat.title}</span>
                                <div className="flex flex-col justify-center">
                                    <span className="text-white font-bold text-sm leading-tight break-words line-clamp-2" title={name}>
                                        {name}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Price & Change */}
                        <div className="text-right">
                            <div className={`text-xl font-bold ${stat.title === 'Dominance' || stat.type === 'cash' ? stat.color : 'text-white'}`}>
                                {price}
                            </div>
                            {stat.type !== 'cash' && stat.title !== 'Dominance' && asset && asset.currency && asset.currency !== 'USD' && (
                                <div className="text-xs font-medium text-gray-500 mb-0.5">
                                    ${asset.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            )}
                            <div className={`text-xs font-bold ${changeColor}`}>
                                {changeStr}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
