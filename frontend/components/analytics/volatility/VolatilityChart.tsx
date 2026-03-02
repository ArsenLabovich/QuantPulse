import { memo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface VolatilityChartProps {
    data: { date: string; value: number }[];
}

export const VolatilityChart = memo(function VolatilityChart({ data }: VolatilityChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                No chart data available
            </div>
        );
    }

    return (
        <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3978FF" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3978FF" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2E39" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#6B7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        stroke="#6B7280"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#1E222D",
                            borderColor: "#2A2E39",
                            borderRadius: "12px",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        }}
                        itemStyle={{ color: "#fff", fontWeight: "bold" }}
                        labelStyle={{ color: "#9CA3AF", marginBottom: "4px" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => {
                            if (typeof value === "number") return [`${value.toFixed(2)}%`, "Volatility"];
                            return [value, "Volatility"];
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3978FF"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorVol)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
});
