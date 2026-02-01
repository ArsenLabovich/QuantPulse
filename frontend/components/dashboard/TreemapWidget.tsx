"use client";

import { HoldingItem } from "@/types/dashboard";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";

interface TreemapWidgetProps {
    data: HoldingItem[];
    isLoading: boolean;
}

// Custom Content Component for Treemap Cells
const CustomizedContent = (props: any) => {
    const { root, depth, x, y, width, height, index, payload, name, value, change } = props;

    // Filter out very small blocks to avoid clutter
    if (width < 30 || height < 30) return null;

    const isPositive = change >= 0;
    // Calculate color based on change: Green for +, Red for -
    // Simple logic: Base green/red with some opacity or variation could be better, but flat is safe for now.
    // Let's use specific hexes to match our theme.
    // We can use opacity to indicate magnitude if we wanted, but let's stick to simple Red/Green.
    const fillColor = isPositive ? "#00C805" : "#FF3B30";

    // Opacity based on magnitude? Let's just use a solid color with varying opacity
    // Or simpler: Green background with opacity 0.2 and green border.
    // Actually standard heatmap style is solid background.
    // Let's go with: Dark background, Colored Text? No, Treemap usually fills the box.
    // Design decision: Fill with low opacity color, solid border.

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: isPositive ? "#00C805" : "#FF3B30",
                    fillOpacity: 0.15, // Subtle fill
                    stroke: isPositive ? "#00C805" : "#FF3B30",
                    strokeWidth: 1,
                    strokeOpacity: 0.3,
                }}
                rx={4}
                ry={4}
            />
            {width > 50 && height > 40 ? (
                <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'hidden' }}>
                    <div className="flex flex-col items-center justify-center h-full p-1 text-center select-none cursor-default">
                        <span className="text-white font-bold text-xs truncate w-full px-1">{name}</span>
                        <span className={`text-[10px] font-bold ${isPositive ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                            {change > 0 ? "+" : ""}{change?.toFixed(2)}%
                        </span>
                        {height > 60 && (
                            <span className="text-[10px] text-gray-500 mt-0.5">
                                ${(value / 1000).toFixed(1)}k
                            </span>
                        )}
                    </div>
                </foreignObject>
            ) : null}
        </g>
    );
};

export function TreemapWidget({ data, isLoading }: TreemapWidgetProps) {
    if (isLoading) {
        return <div className="bg-[#1E222D] h-[300px] rounded-xl animate-pulse" />;
    }

    if (!data || data.length === 0) return null;

    // Prepare data for Recharts Treemap
    // It expects a nested structure or flat list.
    const treeData = data
        .filter(i => i.value_usd > 10) // Filter dust
        .map(item => ({
            name: item.symbol,
            value: item.value_usd, // Size
            change: item.change_24h || 0 // Custom prop for color
        }))
        .sort((a, b) => b.value - a.value);

    return (
        <div className="bg-[#1E222D] rounded-xl border border-[#2A2E39] h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#2A2E39]">
                <h3 className="text-lg font-bold text-white">Market Map</h3>
            </div>
            <div className="flex-1 min-h-[250px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        stroke="#131722"
                        content={<CustomizedContent />}
                        isAnimationActive={false} // Disable animation for crisp rendering
                    >
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-[#131722] border border-[#2A2E39] p-3 rounded-lg shadow-xl">
                                            <p className="font-bold text-white">{d.name}</p>
                                            <p className="text-gray-400 text-xs">Value: ${d.value.toLocaleString()}</p>
                                            <p className={`text-xs font-bold ${d.change >= 0 ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                                                Change: {d.change > 0 ? "+" : ""}{d.change.toFixed(2)}%
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
