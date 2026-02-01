"use client";

import { HoldingItem } from "@/types/dashboard";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface TopHoldingsWidgetProps {
    data: HoldingItem[];
    isLoading: boolean;
}

export function TopHoldingsWidget({ data, isLoading }: TopHoldingsWidgetProps) {
    if (isLoading) {
        return <div className="bg-[#1E222D] h-[300px] rounded-xl animate-pulse" />;
    }

    const top5 = [...data]
        .sort((a, b) => b.value_usd - a.value_usd)
        .slice(0, 5);

    return (
        <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] h-full flex flex-col overflow-hidden">
            <div className="p-5 border-b border-[#2A2E39] flex justify-between items-center bg-[#1E222D]">
                <h3 className="text-lg font-bold text-white flex items-center">
                    Top Holdings
                    <span className="ml-2 text-xs font-normal text-gray-500 bg-[#2A2E39] px-2 py-0.5 rounded-full">
                        {data.length} Assets
                    </span>
                </h3>
                <Link href="/portfolio" className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center transition-colors">
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {top5.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm">
                        No assets found.
                    </div>
                ) : (
                    <div className="space-y-px bg-[#2A2E39]">
                        {top5.map((asset) => (
                            <div key={asset.symbol} className="flex items-center justify-between p-4 bg-[#1E222D] hover:bg-[#252A36] transition-colors group">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-[#131722] flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden border border-[#2A2E39] group-hover:border-gray-600 transition-colors">
                                        {asset.icon_url ? (
                                            <img
                                                src={asset.icon_url}
                                                alt={asset.symbol}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.querySelector('span')?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : (
                                            <span>{asset.symbol[0]}</span>
                                        )}
                                        <span className={asset.icon_url ? "hidden" : "block"}>{asset.symbol[0]}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{asset.name}</p>
                                        <p className="text-xs text-gray-500 font-medium">{asset.symbol}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">
                                        ${asset.value_usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </p>
                                    <p className={`text-xs font-bold ${(asset.change_24h || 0) >= 0 ? 'text-[#00C805]' : 'text-[#FF3B30]'
                                        }`}>
                                        {(asset.change_24h || 0) > 0 ? "+" : ""}
                                        {(asset.change_24h || 0).toFixed(2)}%
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="p-3 bg-[#1E222D]/50 border-t border-[#2A2E39] text-center">
                <Link href="/portfolio" className="text-xs text-gray-500 hover:text-white transition-colors">
                    Show full portfolio
                </Link>
            </div>
        </div>
    );
}
