"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from "framer-motion";
import { useMemo } from "react";
import { HistoryItem } from "@/types/dashboard";

interface HistoryChartProps {
    data: HistoryItem[];
    isLoading?: boolean;
}

export function HistoryChart({ data, isLoading }: HistoryChartProps) {
    if (isLoading) {
        return (
            <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full animate-pulse">
                <div className="h-6 w-32 bg-[#2A2E39] rounded mb-6" />
                <div className="h-[200px] bg-[#2A2E39] rounded" />
            </div>
        );
    }

    const filteredData = useMemo(() => {
        return data.filter(item => item.value > 0);
    }, [data]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full flex flex-col"
        >
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Portfolio History</h3>
                <div className="flex gap-2">
                    <span className="text-xs font-medium text-[#3978FF] bg-[#3978FF]/10 px-2 py-1 rounded">30D</span>
                </div>
            </div>

            <div className="flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={filteredData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3978FF" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3978FF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2A2E39" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#5E626B"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#5E626B"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1E222D', border: '1px solid #2A2E39', borderRadius: '8px' }}
                            itemStyle={{ color: '#3978FF' }}
                            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Value']}
                            labelStyle={{ color: '#909399', marginBottom: '4px' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#3978FF"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
