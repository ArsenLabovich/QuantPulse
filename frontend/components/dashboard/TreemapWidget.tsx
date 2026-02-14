"use client";

import { HoldingItem } from "@/types/dashboard";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";

interface TreemapWidgetProps {
    data: HoldingItem[];
    isLoading: boolean;
}

// Custom Content Component for Treemap Cells
const CustomizedContent = (props: {
    depth?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    value?: number;
    change?: number;
}) => {
    const { depth = 0, x = 0, y = 0, width = 0, height = 0, name = "", value = 0, change = 0 } = props;

    // Ignore root node (depth 1 is usually the root in a flat hierarchy in Recharts? Or depth 0?)
    // In Recharts flat data, depth 1 are the items. depth 0 is root.
    // If we see a huge value equals to total, it's likely root.
    // Let's rely on depth.
    // However, sometimes Recharts is tricky. Let's check if payload has symbol.
    // Our items have payload.name = symbol. Root usually doesn't or has generic name.

    // Safe check: if we are at depth < 1, return null (don't render root background over items)
    // Actually, let's verify depth via console if needed, but standard is depth 1 for items.
    // Also, our items are filtered to be > 10 USD.

    // NOTE: Recharts Treemap with flat list:
    // Root is depth 0. Items are depth 1.
    if (depth < 1) return null;

    const isPositive = change >= 0;
    const isZero = Math.abs(change) < 0.005;

    // Color Logic
    const color = isZero ? "#9ca3af" : (isPositive ? "#00C805" : "#FF3B30"); // gray-400 for zero

    // Font Size Logic
    // Scale font based on width/height
    // Allow going down to 4px for extremely small blocks (Nano mode)
    const fontSize = Math.min(12, Math.max(4, width / 3.5));

    // Aggressive threshold for symbol: show almost always if we have at least 8px
    const showSymbol = width > 8 && height > 8;

    // Only show extras if we have decent space
    const showChange = height > 25 && width > 30;
    const showValue = height > 35 && width > 40;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: color,
                    fillOpacity: 0.15,
                    stroke: color,
                    strokeWidth: 1,
                    strokeOpacity: 0.3,
                }}
                rx={Math.min(4, width / 4)}
                ry={Math.min(4, height / 4)}
            />
            {showSymbol && (
                <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'hidden' }}>
                    <div className="flex flex-col items-center justify-center h-full p-[0.5px] text-center select-none cursor-default leading-none">
                        <span
                            className="text-white font-bold w-full block"
                            style={{
                                fontSize: `${fontSize}px`,
                                lineHeight: '1',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'clip' // No ellipsis (...)
                            }}
                            title={name}
                        >
                            {name}
                        </span>

                        {showChange && (
                            <span
                                className="font-bold mt-[1px]"
                                style={{
                                    fontSize: `${Math.max(6, fontSize - 2)}px`,
                                    lineHeight: '1',
                                    color: color,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'clip'
                                }}
                            >
                                {!isZero && (change > 0 ? "+" : "")}{change ? change.toFixed(1) : "0.0"}%
                            </span>
                        )}

                        {showValue && (
                            <span
                                className="text-gray-500 mt-[1px]"
                                style={{
                                    fontSize: `${Math.max(6, fontSize - 2)}px`,
                                    lineHeight: '1',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'clip'
                                }}
                            >
                                ${(value / (value >= 1000 ? 1000 : 1)).toFixed(value >= 1000 ? 1 : 0)}{value >= 1000 ? 'k' : ''}
                            </span>
                        )}
                    </div>
                </foreignObject>
            )}
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
                            isAnimationActive={false}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-[#131722] border border-[#2A2E39] p-3 rounded-lg shadow-xl">
                                            <p className="font-bold text-white">{d.name}</p>
                                            <p className="text-gray-400 text-xs">Value: ${d.value.toLocaleString()}</p>
                                            <p className={`text-xs font-bold ${Math.abs(d.change) < 0.005
                                                ? 'text-gray-400'
                                                : d.change > 0
                                                    ? 'text-[#00C805]'
                                                    : 'text-[#FF3B30]'
                                                }`}>
                                                Change: {Math.abs(d.change) >= 0.005 && d.change > 0 ? "+" : ""}{d.change.toFixed(2)}%
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
