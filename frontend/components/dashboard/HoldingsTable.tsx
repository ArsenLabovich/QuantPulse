"use client";

import { useMemo, useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
    ColumnDef
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Search, Layers, Filter } from "lucide-react";
import { DetailedHoldingItem } from "@/types/dashboard";
import { AssetDetailsDrawer } from "./AssetDetailsDrawer";

// --- Types ---

interface HoldingsTableProps {
    data: DetailedHoldingItem[];
    isLoading?: boolean;
}

type ViewMode = 'aggregated' | 'detailed';

// --- Helper: Aggregation Logic ---

function aggregateBySymbol(items: DetailedHoldingItem[]): DetailedHoldingItem[] {
    const map = new Map<string, DetailedHoldingItem>();

    for (const item of items) {
        if (!map.has(item.symbol)) {
            // Clone to avoid mutating original
            map.set(item.symbol, { ...item, integration_name: "Multiple", provider_id: "multiple" });
        } else {
            const existing = map.get(item.symbol)!;
            const totalVal = existing.value_usd + item.value_usd;
            const totalBal = existing.balance + item.balance;

            // Weighted avg for change 24h
            const existingWeight = existing.value_usd * (existing.change_24h || 0);
            const itemWeight = item.value_usd * (item.change_24h || 0);
            const newChange = totalVal > 0 ? (existingWeight + itemWeight) / totalVal : 0;

            // Update
            existing.value_usd = totalVal;
            existing.balance = totalBal;
            existing.change_24h = newChange;
            // Weighted avg price
            existing.price_usd = totalBal > 0 ? totalVal / totalBal : existing.price_usd;

            // Fix: If existing item has no icon but new one does, update it
            if (!existing.icon_url && item.icon_url) {
                existing.icon_url = item.icon_url;
            }
        }
    }
    return Array.from(map.values());
}

// --- Sub-Component: Asset Table ---

interface AssetTableProps {
    data: DetailedHoldingItem[];
    showIntegrationCol: boolean;
    onAssetClick: (asset: DetailedHoldingItem) => void;
}

function AssetTable({ data, showIntegrationCol, onAssetClick }: AssetTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "value_usd", desc: true }]);

    const columnHelper = createColumnHelper<DetailedHoldingItem>();

    const columns = useMemo(() => {
        return [
            columnHelper.accessor("symbol", {
                header: "Asset",
                cell: (info) => {
                    const row = info.row.original;
                    return (
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 overflow-hidden shrink-0 ring-2 ring-[#1E222D]">
                                {row.icon_url ? (
                                    <img
                                        src={row.icon_url}
                                        alt={row.symbol}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = "/icons/generic_asset.png";
                                            e.currentTarget.onerror = null;
                                        }}
                                    />
                                ) : null}
                                <span className={row.icon_url ? "hidden" : "block"}>{row.symbol[0]}</span>
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm">{row.symbol}</div>
                                <div className="text-xs text-gray-500 hidden sm:block font-medium">{row.name}</div>
                            </div>
                        </div>
                    );
                },
            }),
            showIntegrationCol ? columnHelper.accessor("integration_name", {
                header: "Source",
                cell: (info) => <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">{info.getValue()}</span>
            }) : null,
            columnHelper.accessor("price_usd", {
                header: "Price",
                cell: (info) => {
                    const priceUsd = info.getValue();
                    return <span className="text-white font-semibold text-sm">
                        ${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>;
                },
            }),
            columnHelper.accessor("change_24h", {
                header: "24h",
                cell: (info) => {
                    const val = info.getValue();
                    if (val === null || val === undefined) return <span className="text-gray-500">-</span>;
                    if (Math.abs(val) < 0.005) return <span className="text-xs font-bold text-gray-500">0.00%</span>;
                    const isPos = val > 0;
                    return (
                        <span className={`text-xs font-bold ${isPos ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                            {isPos ? "+" : ""}{val.toFixed(2)}%
                        </span>
                    );
                },
            }),
            columnHelper.accessor("balance", {
                header: "Balance",
                cell: (info) => <span className="text-gray-400 text-sm">{info.getValue().toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>,
            }),
            columnHelper.accessor("value_usd", {
                header: "Value",
                cell: (info) => <span className="text-white font-bold text-sm">
                    ${info.getValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>,
            }),
        ].filter(Boolean) as ColumnDef<DetailedHoldingItem, any>[];
    }, [showIntegrationCol]);

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 50 } },
    });

    return (
        <div className="overflow-x-auto rounded-xl border border-[#2A2E39] bg-[#1E222D]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[#131722] text-xs font-semibold text-gray-400 uppercase border-b border-[#2A2E39]">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th key={header.id} className="p-4 cursor-pointer hover:text-white" onClick={header.column.getToggleSortingHandler()}>
                                    <div className="flex items-center gap-2">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        {{
                                            asc: <ChevronUp className="w-3 h-3 text-[#3978FF]" />,
                                            desc: <ChevronDown className="w-3 h-3 text-[#3978FF]" />,
                                        }[header.column.getIsSorted() as string] ?? null}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-[#2A2E39]">
                    {table.getRowModel().rows.map(row => (
                        <tr
                            key={row.id}
                            className="hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => onAssetClick(row.original)}
                        >
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="p-4 whitespace-nowrap">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- Main Component ---

export function HoldingsTable({ data, isLoading }: HoldingsTableProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('aggregated');
    const [search, setSearch] = useState("");
    const [hideDust, setHideDust] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<string>('all');
    const [groupByProvider, setGroupByProvider] = useState(false);

    // Drawer State
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Derived Data
    const providers = useMemo(() => Array.from(new Set(data.map(i => i.integration_name))), [data]);

    const processedData = useMemo(() => {
        let result = data;

        // 1. Filter
        if (hideDust) result = result.filter(i => i.value_usd >= 1.0);
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
        }
        if (selectedProvider !== 'all') {
            result = result.filter(i => i.integration_name === selectedProvider);
        }

        // 2. View Mode (Aggregate or Detailed)
        // If grouped by provider, we MUST use detailed.
        if (viewMode === 'aggregated' && !groupByProvider) {
            result = aggregateBySymbol(result);
        }

        return result;
    }, [data, viewMode, search, hideDust, selectedProvider, groupByProvider]);

    // Grouping for Render
    const groupedData = useMemo(() => {
        if (!groupByProvider) return null;
        const groups: Record<string, DetailedHoldingItem[]> = {};
        processedData.forEach(item => {
            const key = item.integration_name;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [processedData, groupByProvider]);

    // Drawer Data
    const drawerHoldings = useMemo(() => {
        if (!selectedAssetSymbol) return [];
        return data.filter(i => i.symbol === selectedAssetSymbol);
    }, [data, selectedAssetSymbol]);

    const handleAssetClick = (asset: DetailedHoldingItem) => {
        setSelectedAssetSymbol(asset.symbol);
        setIsDrawerOpen(true);
    };

    if (isLoading) return <div className="h-64 bg-[#1E222D] rounded-xl animate-pulse" />;

    return (
        <div className="space-y-4">
            {/* Controls Bar */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between bg-[#1E222D] p-4 rounded-xl border border-[#2A2E39]">
                {/* Search */}
                <div className="relative w-full xl:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        className="w-full bg-[#131722] border border-[#2A2E39] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-[#3978FF] outline-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex bg-[#131722] rounded-lg p-1 border border-[#2A2E39]">
                        <button
                            onClick={() => { setViewMode('aggregated'); setGroupByProvider(false); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'aggregated' ? 'bg-[#3978FF] text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Aggregated
                        </button>
                        <button
                            onClick={() => setViewMode('detailed')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'detailed' ? 'bg-[#3978FF] text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Detailed
                        </button>
                    </div>

                    {/* Provider Filter (Only in Detailed) */}
                    {viewMode === 'detailed' && (
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3 h-3" />
                            <select
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                                className="bg-[#131722] border border-[#2A2E39] rounded-lg pl-8 pr-4 py-2 text-xs text-white outline-none appearance-none cursor-pointer hover:border-gray-600"
                            >
                                <option value="all">All Platforms</option>
                                {providers.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Group Toggle (Only in Detailed) */}
                    {viewMode === 'detailed' && (
                        <button
                            onClick={() => setGroupByProvider(!groupByProvider)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${groupByProvider ? 'bg-[#3978FF]/20 border-[#3978FF] text-[#3978FF]' : 'bg-[#131722] border-[#2A2E39] text-gray-400 hover:text-white'}`}
                        >
                            <Layers className="w-3 h-3" />
                            Group by Platform
                        </button>
                    )}

                    {/* Dust Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
                        <input
                            type="checkbox"
                            checked={hideDust}
                            onChange={e => setHideDust(e.target.checked)}
                            className="accent-[#3978FF] w-4 h-4 rounded"
                        />
                        <span className="text-xs text-gray-400 hover:text-white">Hide Dust</span>
                    </label>
                </div>
            </div>

            {/* Content */}
            {groupByProvider && groupedData ? (
                <div className="space-y-8">
                    {Object.entries(groupedData).map(([provider, items]) => {
                        const groupTotal = items.reduce((sum, i) => sum + i.value_usd, 0);
                        return (
                            <div key={provider} className="animate-in fade-in duration-500">
                                <div className="flex items-end justify-between mb-3 px-1">
                                    <h3 className="text-lg font-bold text-white">{provider}</h3>
                                    <span className="text-sm font-bold text-[#00C805] bg-[#00C805]/10 px-3 py-1 rounded-full">
                                        ${groupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <AssetTable
                                    data={items}
                                    showIntegrationCol={false}
                                    onAssetClick={handleAssetClick}
                                />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <AssetTable
                    data={processedData}
                    showIntegrationCol={viewMode === 'detailed'}
                    onAssetClick={handleAssetClick}
                />
            )}

            <AssetDetailsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                holdings={drawerHoldings}
            />
        </div>
    );
}
