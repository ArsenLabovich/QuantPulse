"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

interface SparklineProps {
    data: { value: number }[];
    color?: string; // Hex color for the line/fill
    height?: number;
    showTooltip?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#1F2123] border border-[#2A2D31] px-2 py-1 rounded text-xs text-white">
                {payload[0].value.toFixed(2)}
            </div>
        );
    }
    return null;
};

export function Sparkline({
    data,
    color = "#3978FF",
    height = 60,
    showTooltip = false
}: SparklineProps) {
    if (!data || data.length === 0) return null;

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        fill={`url(#gradient-${color})`}
                        isAnimationActive={false}
                    />
                    {showTooltip && <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2A2D31' }} />}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Helper for generating mock data
export const generateMockData = (points: number = 20, trend: 'up' | 'down' | 'volatile' = 'volatile') => {
    let current = 100;
    return Array.from({ length: points }).map(() => {
        const change = (Math.random() - 0.5) * 10;
        if (trend === 'up') current += Math.abs(change);
        else if (trend === 'down') current -= Math.abs(change);
        else current += change;
        return { value: current };
    });
};
