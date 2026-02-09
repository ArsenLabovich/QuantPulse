"use client";

import { useEffect, useState } from "react";
import { DetailedHoldingItem, HistoryItem } from "@/types/dashboard";
import { X, Wallet } from "lucide-react";
import api from "@/lib/api";
import { AreaChart, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';

import { motion, AnimatePresence } from "framer-motion";

interface AssetDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    holdings: DetailedHoldingItem[];
}

export function AssetDetailsDrawer({ isOpen, onClose, holdings }: AssetDetailsDrawerProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const asset = holdings[0];

    // Aggregates
    const totalBalance = holdings.reduce((sum, h) => sum + h.balance, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.value_usd, 0);
    // const weightedPrice = totalValue / totalBalance || asset?.price_usd || 0;

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

    return (
        <AnimatePresence>
            {isOpen && asset && (
                <motion.div

                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "tween", ease: "easeOut", duration: 0.3 }}
                    className="fixed top-16 right-0 h-[calc(100vh-64px)] z-40 shadow-2xl"
                >
                    <div className="w-[440px] h-full bg-[#1E222D]/95 border-l border-[#2A2E39] rounded-l-2xl overflow-hidden flex flex-col backdrop-blur-sm">
                        {/* Header Section */}
                        <div className="shrink-0 p-5 border-b border-[#2A2E39] flex justify-between items-start bg-[#1E222D]/0 z-10"> {/* bg transparent to inherit from parent */}
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#131722] flex items-center justify-center text-lg font-bold text-gray-400 overflow-hidden ring-1 ring-[#2A2E39]">
                                    {asset.icon_url ? (
                                        <img
                                            src={asset.icon_url || undefined}
                                            alt={asset.symbol}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = "/icons/generic_asset.png";
                                                e.currentTarget.onerror = null;
                                            }}
                                        />
                                    ) : (
                                        <span className="text-xl">
                                            {{
                                                'USD': '$',
                                                'EUR': '€',
                                                'GBP': '£',
                                                'JPY': '¥',
                                                'AUD': 'A$',
                                                'CAD': 'C$',
                                                'CHF': 'Fr',
                                                'CNY': '¥',
                                                'RUB': '₽',
                                                'NZD': 'NZ$',
                                                'SEK': 'kr',
                                                'KRW': '₩',
                                                'SGD': 'S$',
                                                'HKD': 'HK$',
                                                'MXN': '$',
                                                'INR': '₹',
                                                'TRY': '₺',
                                                'BRL': 'R$',
                                                'ZAR': 'R',
                                            }[asset.symbol.toUpperCase()] || asset.symbol[0]}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-white leading-tight">{asset.symbol}</h2>
                                        <span className="text-[#3978FF] bg-[#3978FF]/10 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                            {asset.asset_type}
                                        </span>
                                    </div>
                                    <span className="text-gray-400 text-sm font-medium">
                                        {(asset.asset_type.toLowerCase() === 'fiat' || asset.asset_type.toLowerCase() === 'cash')
                                            ? asset.symbol
                                            : asset.name}
                                    </span>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-[#2A2E39] rounded-lg text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>


                        {/* Stats & Chart Section */}
                        <div className="shrink-0">
                            <div className="p-5 grid grid-cols-2 gap-3">
                                <div className="bg-[#131722] p-3 rounded-xl border border-[#2A2E39]">
                                    <p className="text-gray-500 text-xs font-medium mb-1 uppercase tracking-wider">Total Value</p>
                                    <div className="text-lg font-bold text-white font-mono">
                                        ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="bg-[#131722] p-3 rounded-xl border border-[#2A2E39]">
                                    <p className="text-gray-500 text-xs font-medium mb-1 uppercase tracking-wider">Total Balance</p>
                                    <div className="text-lg font-bold text-white font-mono flex items-baseline gap-1">
                                        <span>{totalBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
                                        <span className="text-xs font-normal text-gray-500">{asset.symbol}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 mb-5">
                                <div className="bg-[#131722] rounded-xl border border-[#2A2E39] p-4 h-[180px] relative">
                                    {loadingHistory ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-6 h-6 border-2 border-[#3978FF] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : history.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3978FF" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3978FF" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E39" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#5E626B"
                                                    tick={{ fontSize: 10 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    minTickGap={30}
                                                    tickFormatter={(str) => {
                                                        const d = new Date(str);
                                                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    }}
                                                />
                                                <YAxis
                                                    stroke="#5E626B"
                                                    tick={{ fontSize: 10 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    domain={['auto', 'auto']}

                                                    tickFormatter={(val) => {
                                                        return new Intl.NumberFormat('en-US', {
                                                            style: 'currency',
                                                            currency: asset.currency || 'USD',
                                                            notation: "compact",
                                                            maximumFractionDigits: 1,
                                                        }).format(val);
                                                    }}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#1E222D', border: '1px solid #2A2E39', borderRadius: '8px', fontSize: '12px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(val: number | undefined) => [
                                                        val != null ? new Intl.NumberFormat('en-US', {
                                                            style: 'currency',
                                                            currency: asset.currency || 'USD',
                                                            minimumFractionDigits: 2
                                                        }).format(val) : 'N/A',
                                                        'Price'
                                                    ]}
                                                    labelFormatter={(label) => new Date(label).toLocaleString()}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="value"
                                                    stroke="#3978FF"
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
                        </div>

                        {/* Scrollable Breakdown Section */}
                        <div className="flex-1 min-h-0 px-5 pb-5 overflow-y-auto custom-scrollbar">
                            <div className="sticky top-0 bg-[#1E222D]/95 z-20 pb-2 backdrop-blur-md mb-2">
                                <h3 className="text-[#909399] font-bold py-2 flex items-center gap-2 text-xs uppercase tracking-widest">
                                    <Wallet className="w-4 h-4 text-[#3978FF]" />
                                    Holdings Breakdown
                                </h3>
                                <div className="flex items-center justify-between px-4 border-b border-[#2A2E39] pb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Platform</span>
                                    <div className="flex items-center gap-6 text-right">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Price</span>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">Holdings</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-1">
                                {holdings.map((h, idx) => {
                                    // Robust Provider Detection
                                    const knownProviders = ['trading212', 'freedom24', 'binance', 'bybit', 'kraken', 'coinbase', 'kucoin', 'gate.io'];

                                    let providerKey = h.provider_id.toLowerCase();
                                    let instanceLabel = h.integration_name;

                                    // If provider_id doesn't look like a known provider but integration_name does, swap them
                                    // This handles the case where backend sends "FREEDOM24" in integration_name and "mainfreedom24" in provider_id
                                    if (!knownProviders.includes(providerKey) && knownProviders.includes(h.integration_name.toLowerCase())) {
                                        providerKey = h.integration_name.toLowerCase();
                                        instanceLabel = h.provider_id;
                                    }

                                    // Format Provider Name for Display
                                    const providerDisplayName = providerKey === 'trading212' ? 'Trading 212' :
                                        providerKey === 'freedom24' ? 'Freedom24' :
                                            providerKey.charAt(0).toUpperCase() + providerKey.slice(1);

                                    return (
                                        <div key={idx} className="bg-[#131722] rounded-xl p-4 border border-[#2A2E39] flex items-center justify-between transition-all hover:border-[#3978FF]/40 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-[#1E222D] flex items-center justify-center overflow-hidden border border-[#2A2E39] group-hover:border-[#3978FF]/30 transition-colors">
                                                    <img
                                                        src={`/icons/square_icon/${providerKey}.svg`}
                                                        alt={instanceLabel}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.innerText = instanceLabel[0] || '?';
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-[#3978FF] transition-colors">{providerDisplayName}</p>

                                                    {/* Show instance label if it's different from the provider name, to disambiguate accounts */}
                                                    {(instanceLabel.toLowerCase().replace(/\s/g, '') !== providerDisplayName.toLowerCase().replace(/\s/g, '')) && (
                                                        <p className="text-[10px] text-gray-500 font-medium tracking-tight">{instanceLabel}</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                {/* Price Section */}
                                                <div className="text-right flex flex-col justify-center w-[80px]">
                                                    {h.currency && h.currency !== 'USD' ? (
                                                        <>
                                                            <p className="text-white font-medium text-sm tabular-nums">
                                                                {new Intl.NumberFormat('en-US', {
                                                                    style: 'currency',
                                                                    currency: h.currency,
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: (h.price < 1) ? 6 : 2,
                                                                }).format(h.price)}
                                                            </p>
                                                            <p className="text-gray-500 text-xs tabular-nums mt-0.5">
                                                                ${h.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: (h.price_usd < 1) ? 6 : 2 })}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <p className="text-white font-medium text-sm tabular-nums">
                                                            ${h.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: (h.price_usd < 1) ? 6 : 2 })}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Balance & Value Section */}
                                                <div className="text-right w-[80px]">
                                                    <p className="text-sm font-bold text-white font-mono flex items-center justify-end gap-1">
                                                        <span className="text-[10px] text-gray-500 font-sans font-normal">Qty:</span>
                                                        {h.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                                    </p>
                                                    <p className="text-xs text-gray-400 font-mono">
                                                        ${h.value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                    {h.currency && h.currency !== 'USD' && (
                                                        <p className="text-[10px] text-gray-500 font-mono">
                                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: h.currency }).format(h.balance * h.price)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
