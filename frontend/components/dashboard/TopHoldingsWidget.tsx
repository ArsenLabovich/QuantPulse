"use client";

import { HoldingItem } from "@/types/dashboard";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
                <Link href="/dashboard/portfolio" className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center transition-colors">
                    View All <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {/* Column Headers */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr] gap-4 px-5 py-3 border-b border-[#2A2E39] bg-[#151921]">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Asset</div>
                    <div className="text-right text-xs font-semibold text-gray-500 uppercase">Price</div>
                    <div className="text-right text-xs font-semibold text-gray-500 uppercase">24h Change</div>
                    <div className="text-right text-xs font-semibold text-gray-500 uppercase">Balance</div>
                    <div className="text-right text-xs font-semibold text-gray-500 uppercase">Value</div>
                </div>

                {/* List */}
                <div className="overflow-y-auto min-h-0">
                    {top5.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm">
                            No assets found.
                        </div>
                    ) : (
                        <div className="bg-[#2A2E39] space-y-px">
                            {top5.map((asset) => (
                                <div key={asset.symbol} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr] gap-4 px-5 py-4 bg-[#1E222D] hover:bg-[#252A36] transition-colors items-center group">
                                    {/* Col 1: Asset (Icon + Ticker/Name) */}
                                    <div className="flex items-center space-x-4 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-[#131722] flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden shadow-sm border border-[#2A2E39] group-hover:border-gray-600 transition-colors">
                                            {asset.icon_url ? (
                                                <Image
                                                    src={asset.icon_url}
                                                    alt={asset.symbol}
                                                    width={40}
                                                    height={40}
                                                    className="w-full h-full object-cover"
                                                    unoptimized
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        target.parentElement?.querySelector('span')?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : (
                                                <span className="text-lg">
                                                    {{
                                                        'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
                                                        'AUD': 'A$', 'CAD': 'C$', 'CHF': 'Fr', 'CNY': '¥',
                                                        'RUB': '₽', 'NZD': 'NZ$', 'SEK': 'kr', 'KRW': '₩',
                                                        'SGD': 'S$', 'HKD': 'HK$', 'MXN': '$', 'INR': '₹',
                                                        'TRY': '₺', 'BRL': 'R$', 'ZAR': 'R'
                                                    }[asset.symbol.toUpperCase()] || asset.symbol[0]}
                                                </span>
                                            )}
                                            <span className={`hidden ${!asset.icon_url ? "!block" : ""}`}>{asset.symbol[0]}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-white text-base truncate">{asset.symbol}</p>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">{asset.name}</p>
                                        </div>
                                    </div>

                                    {/* Col 2: Price (Original + USD) */}
                                    <div className="text-right flex flex-col justify-center">
                                        {/* Original Currency Price (Top) */}
                                        {(asset.currency && asset.currency !== 'USD') ? (
                                            <>
                                                <p className="text-white font-medium text-sm tabular-nums">
                                                    {new Intl.NumberFormat('en-US', {
                                                        style: 'currency',
                                                        currency: asset.currency,
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: (asset.price < 1) ? 6 : 2,
                                                    }).format(asset.price)}
                                                </p>
                                                <p className="text-gray-500 text-xs tabular-nums mt-0.5">
                                                    ${asset.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: (asset.price_usd < 1) ? 6 : 2 })}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-white font-medium text-sm tabular-nums">
                                                ${asset.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: (asset.price_usd < 1) ? 6 : 2 })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Col 3: 24h Change */}
                                    <div className="text-right flex items-center justify-end">
                                        <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${(asset.change_24h || 0) > 0 ? 'text-[#00C805]' : (asset.change_24h || 0) < 0 ? 'text-[#FF3B30]' : 'text-gray-500'}`}>
                                            {Math.abs(asset.change_24h || 0) >= 0.005 && (asset.change_24h || 0) > 0 ? "+" : ""}
                                            {(asset.change_24h || 0).toFixed(2)}%
                                        </div>
                                    </div>

                                    {/* Col 4: Balance */}
                                    <div className="text-right flex items-center justify-end">
                                        <span className="text-gray-400 text-sm font-medium tabular-nums">
                                            {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                        </span>
                                    </div>

                                    {/* Col 5: Value */}
                                    <div className="text-right flex flex-col justify-center min-w-0">
                                        <p className="text-white font-bold text-base tabular-nums">
                                            ${asset.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        {/* Original Currency Value (Secondary) */}
                                        {asset.currency && asset.currency !== 'USD' && (
                                            <p className="text-gray-500 text-xs tabular-nums mt-0.5">
                                                {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: asset.currency,
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0,
                                                }).format(asset.balance * asset.price)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
