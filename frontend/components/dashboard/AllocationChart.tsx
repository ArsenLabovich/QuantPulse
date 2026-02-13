"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AllocationItem } from '@/types/dashboard';


interface AllocationChartProps {
    data: AllocationItem[];
    isLoading?: boolean;
}

const COLORS = ['#3978FF', '#00C805', '#FFCE00', '#FF3B30', '#FF9500', '#BF5AF2', '#5E626B'];

export function AllocationChart({ data, isLoading }: AllocationChartProps) {
    if (isLoading) {
        return (
            <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full animate-pulse">
                <div className="h-6 w-32 bg-[#2A2E39] rounded mb-6" />
                <div className="flex justify-center items-center h-[200px]">
                    <div className="w-40 h-40 rounded-full border-8 border-[#2A2E39]" />
                </div>
            </div>
        );
    }

    // Filter out zero values for chart
    const chartData = data.filter(item => item.value > 0);

    return (
        <div className="bg-[#1E222D] rounded-xl p-6 border border-[#2A2E39] h-full flex flex-col overflow-hidden outline-none">
            <h3 className="text-lg font-bold text-white mb-4">Allocation</h3>

            <div className="flex-1 w-full min-h-[250px] overflow-hidden outline-none">
                <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none' }}>
                    <PieChart style={{ outline: 'none' }} tabIndex={-1} accessibilityLayer={false} role="img">
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            activeShape={false}
                            isAnimationActive={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#2A2E39', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Value']}
                        />
                        <Legend
                            verticalAlign="bottom"
                            align="left"
                            layout="horizontal"
                            wrapperStyle={{ paddingTop: "20px", fontSize: '10px' }}
                            formatter={(value) => {
                                const item = chartData.find(i => i.name === value);
                                return (
                                    <span className="text-[#C0C4CC] ml-1 mr-2">
                                        {value} <span className="text-[#5E626B]">({item?.percentage}%)</span>
                                    </span>
                                );
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
