"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo, useState, useEffect } from "react";
import { HistoryItem } from "@/types/dashboard";
import api from '@/lib/api';

interface HistoryChartProps {
    data: HistoryItem[];
    isLoading?: boolean;
    range?: string;
    onRangeChange?: (range: string) => void;
}

const RANGES = [
    { label: '1h', value: '1h' },
    { label: '6h', value: '6h' },
    { label: '1d', value: '1d' },
    { label: '1w', value: '1w' },
    { label: '1M', value: '1M' },
    { label: 'ALL', value: 'ALL' },
];

export function HistoryChart({
    data: initialData,
    isLoading: initialLoading,
    range: selectedRange = '1d',
    onRangeChange
}: HistoryChartProps) {
    const [historyData, setHistoryData] = useState<HistoryItem[]>(initialData);
    const [isLoading, setIsLoading] = useState(initialLoading);

    useEffect(() => {
        // If the summary (1d) changed, only use it if we are currently on 1d.
        // If we are on a different range, we must re-fetch that range.
        if (selectedRange === '1d') {
            setHistoryData(initialData);
        } else {
            fetchHistory(selectedRange);
        }
    }, [initialData, selectedRange]);

    useEffect(() => {
        setIsLoading(initialLoading);
    }, [initialLoading]);

    const fetchHistory = async (range: string) => {
        setIsLoading(true);
        try {
            const response = await api.get(`/dashboard/history?range=${range}`);
            setHistoryData(response.data);
        } catch (error) {
            console.error("Failed to fetch history", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRangeChange = (range: string) => {
        if (onRangeChange) {
            onRangeChange(range);
        }
        fetchHistory(range);
    };

    const chartData = useMemo(() => {
        const uniqueMap = new Map();

        historyData
            .filter(item => item.value > 0)
            .forEach(item => {
                const ts = new Date(item.date).getTime();
                // Map automatically handles deduplication (latest wins)
                uniqueMap.set(ts, { ...item, timestamp: ts });
            });

        return Array.from(uniqueMap.values())
            .sort((a, b) => a.timestamp - b.timestamp);
    }, [historyData]);

    if (isLoading && historyData.length === 0) {
        return (
            <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full animate-pulse">
                <div className="h-6 w-32 bg-[#2A2E39] rounded mb-6" />
                <div className="h-[200px] bg-[#2A2E39] rounded" />
            </div>
        );
    }

    return (
        <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full flex flex-col overflow-hidden outline-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-bold text-white">Portfolio History</h3>
                <div className="flex flex-wrap gap-1 bg-[#2A2E39]/30 p-1 rounded-lg">
                    {RANGES.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => handleRangeChange(r.value)}
                            className={`
                                text-[10px] font-bold px-2 py-1 rounded-md transition-all
                                ${selectedRange === r.value
                                    ? "bg-[#3978FF] text-white shadow-lg shadow-[#3978FF]/20"
                                    : "text-[#5E626B] hover:text-[#C0C4CC] hover:bg-[#2A2E39]"
                                }
                                focus:outline-none
                            `}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 w-full min-h-[250px] relative overflow-hidden outline-none">
                {isLoading && (
                    <div className="absolute inset-0 bg-[#1E222D]/40 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
                        <div className="w-6 h-6 border-2 border-[#3978FF] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        style={{ outline: 'none' }}
                        tabIndex={-1}
                        accessibilityLayer={false}
                        role="img"
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3978FF" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3978FF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2E39" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            stroke="#5E626B"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                            tickFormatter={(ts) => {
                                const d = new Date(ts);
                                if (selectedRange === '1M') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }}
                        />
                        <YAxis
                            stroke="#5E626B"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => {
                                return new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                    maximumFractionDigits: 0,
                                }).format(value);
                            }}
                        />
                        <Tooltip
                            animationDuration={100}
                            contentStyle={{ backgroundColor: '#1E222D', border: '1px solid #2A2E39', borderRadius: '8px' }}
                            itemStyle={{ color: '#3978FF' }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Value']}
                            labelStyle={{ color: '#909399', marginBottom: '4px' }}
                            labelFormatter={(str) => {
                                const d = new Date(str);
                                return d.toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                });
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#3978FF"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
