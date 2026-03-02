"use client";

import { useMemo, useState, memo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import Image from "next/image";
import { DetailedHoldingItem, AssetVolatility } from "@/types/dashboard";
import { CustomTooltip } from "@/components/ui/CustomTooltip";

interface VolatilityAssetTableProps {
    assets: DetailedHoldingItem[];
    selectedIds: Set<string>;
    onToggle: (symbol: string) => void;
    onToggleAll: () => void;
    volatilityData?: AssetVolatility[];
    totalValue: number;
}

type EnrichedAsset = DetailedHoldingItem & { 
    volatility?: AssetVolatility;
    risk_contribution?: number;
    annual_vol?: number;
    daily_vol?: number;
    data_points?: number;
};

const columnHelper = createColumnHelper<EnrichedAsset>();

const columns = [
    // Selection Checkbox
    columnHelper.display({
        id: "select",
        header: ({ table }) => {
            const { selectedIds, onToggleAll, assets } = table.options.meta as {
                selectedIds: Set<string>;
                onToggleAll: () => void;
                assets: EnrichedAsset[];
            };
            const allSelected = assets.length > 0 && assets.every(a => selectedIds.has(a.symbol));

            return (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleAll();
                        }}
                        className="w-5 h-5 rounded border-[#2A2E39] bg-[#131722] text-primary accent-primary focus:ring-0 cursor-pointer"
                    />
                </div>
            );
        },
        cell: ({ row, table }) => {
            const { selectedIds, onToggle } = table.options.meta as {
                selectedIds: Set<string>;
                onToggle: (s: string) => void
            };
            const isSelected = selectedIds.has(row.original.symbol);

            return (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(row.original.symbol)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-[#2A2E39] bg-[#131722] text-primary accent-primary focus:ring-0 cursor-pointer"
                    />
                </div>
            );
        },
    }),
    // Asset Info
    columnHelper.accessor("symbol", {
        header: "Asset",
        cell: (info) => {
            const row = info.row.original;
            return (
                <div className="flex items-center gap-3 py-1">
                    <div className="w-10 h-10 rounded-xl bg-[#131722] flex items-center justify-center text-xs font-bold text-gray-500 border border-[#2A2E39] overflow-hidden relative">
                        {row.icon_url && row.icon_url.trim() !== "" ? (
                            <Image
                                src={row.icon_url}
                                alt={row.symbol}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover z-10"
                                unoptimized
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = "/icons/generic_asset.png";
                                    target.onerror = () => {
                                        target.style.display = 'none';
                                    };
                                }}
                            />
                        ) : (
                            <Image
                                src="/icons/generic_asset.png"
                                alt={row.symbol}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover opacity-80"
                                unoptimized
                                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                            />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center select-none uppercase">
                            {row.symbol[0]}
                        </span>
                    </div>
                    <div>
                        <div className="font-bold text-white">{row.symbol}</div>
                        <div className="text-xs text-gray-400">{row.name}</div>
                    </div>
                </div>
            );
        },
    }),
    // Value
    columnHelper.accessor("value_usd", {
        header: "Value",
        cell: (info) => (
            <span className="text-gray-300 font-medium tabular-nums">
                ${info.getValue().toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
        ),
    }),
    // Volatility Columns
    columnHelper.accessor("annual_vol", {
        id: "annual_vol",
        header: () => (
            <div className="flex items-center gap-1.5">
                <span>Annual Risk</span>
                <CustomTooltip content="Annualized expected price fluctuation based on historical data.">
                    <Info className="w-3 h-3 text-gray-500" />
                </CustomTooltip>
            </div>
        ),
        cell: (info) => {
            const val = info.getValue();
            if (val === undefined || val === null) return <span className="text-gray-600">--</span>;
            return (
                <span className="font-bold text-white tabular-nums">
                    {(val * 100).toFixed(2)}%
                </span>
            );
        },
    }),
    columnHelper.accessor("daily_vol", {
        id: "daily_vol",
        header: () => (
            <div className="flex items-center gap-1.5">
                <span>Daily Swing</span>
                <CustomTooltip content="Average expected price swing for a single trading day.">
                    <Info className="w-3 h-3 text-gray-500" />
                </CustomTooltip>
            </div>
        ),
        cell: (info) => {
            const val = info.getValue();
            if (val === undefined || val === null) return <span className="text-gray-600">--</span>;
            return <span className="text-gray-400 tabular-nums">{(val * 100).toFixed(2)}%</span>;
        },
    }),
    columnHelper.accessor("data_points", {
        id: "data_points",
        header: () => (
            <div className="flex items-center gap-1.5">
                <span>History</span>
                <CustomTooltip content="Number of trading days used for this asset's risk calculation.">
                    <Info className="w-3 h-3 text-gray-500" />
                </CustomTooltip>
            </div>
        ),
        cell: (info) => {
            const val = info.getValue();
            const status = info.row.original.volatility?.status;
            if (val === undefined || val === null || status === "insufficient_data") {
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-gray-600">--</span>
                        <CustomTooltip content="Excluded from calculation: This asset lacks at least 1 year of price history.">
                            <AlertTriangle className="w-4 h-4 text-[#FF3B30]" />
                        </CustomTooltip>
                    </div>
                );
            }
            const isLow = val < 20;
            return (
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md tabular-nums ${isLow ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#2A2E39] text-gray-300"}`}>
                        {val}
                    </span>
                    {isLow && <AlertTriangle className="w-4 h-4 text-[#FF3B30]" />}
                </div>
            );
        },
    }),
    columnHelper.accessor("value_usd", {
        id: "share",
        header: "Share",
        cell: (info) => {
            const { totalValue } = info.table.options.meta as { totalValue: number };
            const valUsd = info.getValue();
            const share = totalValue > 0 ? (valUsd / totalValue) * 100 : 0;
            return (
                <span className="text-gray-500 text-xs font-bold tabular-nums">
                    {share.toFixed(2)}%
                </span>
            );
        },
    }),
    columnHelper.accessor("risk_contribution", {
        id: "risk_contribution",
        header: () => (
            <div className="flex items-center gap-1.5">
                <span>Risk Contr.</span>
                <CustomTooltip content="Approximate contribution to total portfolio risk. Calculation: (Asset Weight * Asset Volatility) / Sum(Weights * Volatilities). Note: This is an approximation and does not fully account for cross-asset correlations.">
                    <Info className="w-3 h-3 text-gray-500" />
                </CustomTooltip>
            </div>
        ),
        cell: (info) => {
            const contrib = info.getValue() || 0;
            
            return (
                <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-bold tabular-nums w-12 text-right">
                        {(contrib * 100).toFixed(2)}%
                    </span>
                    <div className="w-16 h-1.5 bg-[#131722] rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#FF3B30] rounded-full" 
                            style={{ width: `${Math.min(contrib * 100, 100)}%` }} 
                        />
                    </div>
                </div>
            );
        },
    }),
];

export const VolatilityAssetTable = memo(function VolatilityAssetTable({
    assets,
    selectedIds,
    onToggle,
    onToggleAll,
    volatilityData,
    totalValue,
}: VolatilityAssetTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "value_usd", desc: true }]);

    const volMap = useMemo(() => {
        return new Map(volatilityData?.map((v) => [v.symbol, v]) || []);
    }, [volatilityData]);

    const totalRiskWeightedSum = useMemo(() => {
        if (!totalValue) return 0;
        return assets.reduce((sum, a) => {
            const vol = volMap.get(a.symbol)?.annual_vol || 0;
            const weight = a.value_usd / totalValue;
            return sum + (weight * vol);
        }, 0);
    }, [assets, totalValue, volMap]);

    const enrichedData = useMemo<EnrichedAsset[]>(() => {
        return assets.map((asset) => {
            const vol = volMap.get(asset.symbol);
            let riskContrib = 0;
            
            if (vol?.annual_vol && totalValue && totalRiskWeightedSum) {
                const weight = asset.value_usd / totalValue;
                riskContrib = (weight * vol.annual_vol) / totalRiskWeightedSum;
            }

            return {
                ...asset,
                volatility: vol,
                risk_contribution: riskContrib,
                annual_vol: vol?.annual_vol,
                daily_vol: vol?.daily_vol,
                data_points: vol?.data_points
            } as EnrichedAsset;
        });
    }, [assets, volMap, totalValue, totalRiskWeightedSum]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: enrichedData,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        meta: {
            selectedIds,
            onToggle,
            onToggleAll,
            assets: enrichedData,
            totalValue,
            totalRiskWeightedSum
        }
    });

    if (enrichedData.length === 0) {
        return <div className="p-8 text-center text-gray-500">No assets found.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[#151921] text-xs font-semibold text-gray-400 uppercase border-b border-[#2A2E39]">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="px-6 py-3 cursor-pointer hover:text-white transition-colors select-none"
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    <div className="flex items-center gap-2">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        {{
                                            asc: <ChevronUp className="w-3 h-3 text-primary" />,
                                            desc: <ChevronDown className="w-3 h-3 text-primary" />,
                                        }[header.column.getIsSorted() as string] ?? null}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-[#2A2E39]">
                    {table.getRowModel().rows.map((row) => (
                        <tr
                            key={row.id}
                            className="hover:bg-white/2 transition-colors cursor-pointer"
                            onClick={() => onToggle(row.original.symbol)}
                        >
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="px-6 py-3 whitespace-nowrap">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});
