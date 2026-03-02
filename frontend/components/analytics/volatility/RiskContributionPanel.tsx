import { memo, useMemo } from "react";
import { DetailedHoldingItem } from "@/types/dashboard";
import Image from "next/image";
import { CustomTooltip } from "@/components/ui/CustomTooltip";

interface RiskContributionPanelProps {
    assets: DetailedHoldingItem[];
    selectedIds: Set<string>;
}

export const RiskContributionPanel = memo(function RiskContributionPanel({
    assets,
    selectedIds,
}: RiskContributionPanelProps) {
    const data = useMemo(() => {
        // Only consider selected assets for the composition
        const activeAssets = assets.filter(a => selectedIds.has(a.symbol));
        const totalValue = activeAssets.reduce((sum, a) => sum + a.value_usd, 0);
        
        return activeAssets
            .map(a => ({
                ...a,
                weight: totalValue > 0 ? a.value_usd / totalValue : 0,
            }))
            .sort((a, b) => b.weight - a.weight);
    }, [assets, selectedIds]);

    if (data.length === 0) {
        return (
            <div className="bg-[#1E222D] rounded-2xl border border-[#2A2E39] p-6 h-full flex flex-col items-center justify-center text-gray-500">
                <p>No assets selected to show composition.</p>
            </div>
        );
    }

    // Top 5 assets get their own colors, rest is "Other"
    const colors = ["#3978FF", "#FF9500", "#00C805", "#FF3B30", "#8A2BE2", "#F012BE", "#3D9970", "#FFDC00", "#01FF70"];
    
    return (
        <div className="bg-[#1E222D] rounded-2xl border border-[#2A2E39] p-6 flex flex-col h-[450px]">
            <h3 className="text-lg font-bold text-white mb-1">Portfolio Composition</h3>
            <p className="text-gray-500 text-xs mb-6">Weight by USD value for selected assets</p>

            <div className="h-4 w-full flex rounded-full overflow-hidden mb-6 bg-[#131722]">
                {data.map((asset, index) => {
                    const width = `${(asset.weight * 100).toFixed(2)}%`;
                    const color = colors[index % colors.length];
                    return (
                        <CustomTooltip 
                            key={asset.symbol} 
                            content={`${asset.symbol}: ${width} of selected portfolio value`}
                            className="h-full shrink-0"
                            style={{ width }}
                        >
                            <div
                                style={{ backgroundColor: color }}
                                className="w-full h-full hover:opacity-80 transition-opacity"
                            />
                        </CustomTooltip>
                    );
                })}
            </div>

            {/* Legend / List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                {data.map((asset, index) => {
                    const color = colors[index % colors.length];
                    return (
                        <div key={asset.symbol} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#131722] flex items-center justify-center text-[10px] font-bold text-gray-500 border border-[#2A2E39] overflow-hidden relative shrink-0">
                                    {asset.icon_url && asset.icon_url.trim() !== "" ? (
                                        <Image
                                            src={asset.icon_url}
                                            alt={asset.symbol}
                                            width={32}
                                            height={32}
                                            className="w-full h-full object-cover z-10"
                                            unoptimized
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = "/icons/generic_asset.png";
                                                target.onerror = () => { target.style.display = 'none'; };
                                            }}
                                        />
                                    ) : (
                                        <Image
                                            src="/icons/generic_asset.png"
                                            alt={asset.symbol}
                                            width={32}
                                            height={32}
                                            className="w-full h-full object-cover opacity-80"
                                            unoptimized
                                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                        {asset.symbol}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate max-w-[120px]">{asset.name}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-white tabular-nums">
                                    {(asset.weight * 100).toFixed(2)}%
                                </span>
                                <span className="text-xs text-gray-500 tabular-nums">
                                    ${asset.value_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
