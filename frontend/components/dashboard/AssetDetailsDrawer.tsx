"use client";

import { useEffect, useState } from "react";
import { DetailedHoldingItem, HistoryItem } from "@/types/dashboard";
import { X, Wallet } from "lucide-react";
import api from "@/lib/api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AssetDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    holdings: DetailedHoldingItem[]; // Use plural as we might have multiple entries per symbol
}

export function AssetDetailsDrawer({ isOpen, onClose, holdings }: AssetDetailsDrawerProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const asset = holdings[0]; // Representative asset for shared info (symbol, price, etc.)

    // Aggregates
    const totalBalance = holdings.reduce((sum, h) => sum + h.balance, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.value_usd, 0);
    const weightedPrice = totalValue / totalBalance || asset?.price_usd || 0;

    // Calculate average 24h change (weighted by value)
    const weightedChange = totalValue > 0
        ? holdings.reduce((sum, h) => sum + (h.change_24h || 0) * h.value_usd, 0) / totalValue
        : (asset?.change_24h || 0);

    useEffect(() => {
        if (isOpen && asset?.symbol) {
            fetchHistory(asset.symbol);
        }
    }, [isOpen, asset?.symbol]);

    const fetchHistory = async (symbol: string) => {
        setLoadingHistory(true);
        try {
            const res = await api.get(`/dashboard/history/${symbol}?range=24h`);
            setHistory(res.data);
        } catch (e) {
            console.error("Failed to fetch asset history", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!isOpen || !asset) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-[#1E222D] shadow-2xl h-full flex flex-col border-l border-[#2A2E39] animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="p-6 border-b border-[#2A2E39] flex justify-between items-start bg-[#1E222D]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#131722] flex items-center justify-center text-lg font-bold text-gray-400 overflow-hidden ring-2 ring-[#2A2E39]">
                            {asset.icon_url ? (
                                <img src={asset.icon_url} alt={asset.symbol} className="w-full h-full object-cover" />
                            ) : (
                                <span>{asset.symbol[0]}</span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{asset.name}</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 font-medium">{asset.symbol}</span>
                                <span className="text-[#3978FF] bg-[#3978FF]/10 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {asset.asset_type?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[#2A2E39] rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Key Stats */}
                    <div className="p-6 grid grid-cols-2 gap-4">
                        <div className="bg-[#131722] p-4 rounded-xl border border-[#2A2E39]">
                            <p className="text-gray-500 text-xs font-medium mb-1">Total Value</p>
                            <div className="text-lg font-bold text-white">
                                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="bg-[#131722] p-4 rounded-xl border border-[#2A2E39]">
                            <p className="text-gray-500 text-xs font-medium mb-1">Total Balance</p>
                            <div className="text-lg font-bold text-white">
                                {totalBalance.toLocaleString()} {asset.symbol}
                            </div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="px-6 mb-6">
                        <div className="bg-[#131722] rounded-xl border border-[#2A2E39] p-4 h-[200px] relative">
                            {loadingHistory ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-[#3978FF] border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : history.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={history}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={weightedChange >= 0 ? "#00C805" : "#FF3B30"} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={weightedChange >= 0 ? "#00C805" : "#FF3B30"} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1E222D', border: '1px solid #2A2E39', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                            formatter={(val: number | undefined) => [val != null ? `$${val.toFixed(2)}` : 'N/A', 'Price']}
                                            labelFormatter={() => ''}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={weightedChange >= 0 ? "#00C805" : "#FF3B30"}
                                            fillOpacity={1}
                                            fill="url(#colorPrice)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                    No historical data available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integration Breakdown */}
                    <div className="px-6 mb-6">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-[#3978FF]" />
                            Holdings Breakdown
                        </h3>
                        <div className="space-y-3">
                            {holdings.map((h, idx) => (
                                <div key={idx} className="bg-[#131722] rounded-lg p-4 border border-[#2A2E39] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {/* Integration Icon (Placeholder for now, or use mapped icons) */}
                                        <div className="w-8 h-8 rounded-full bg-[#1E222D] flex items-center justify-center text-xs font-bold text-gray-500 border border-[#2A2E39]">
                                            {h.integration_name[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{h.integration_name}</p>
                                            <p className="text-xs text-gray-500 font-medium capitalize">{h.provider_id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">
                                            {h.balance.toLocaleString()} {h.symbol}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            ${h.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
