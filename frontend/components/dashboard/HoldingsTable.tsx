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
import { ChevronDown, ChevronUp, Search, Layers, Filter, Check } from "lucide-react";
import { DetailedHoldingItem } from "@/types/dashboard";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

export type ViewMode = 'aggregated' | 'detailed';

export interface PortfolioFilterState {
    search: string;
    hideDust: boolean;
    selectedProvider: string;
    viewMode: ViewMode;
    groupByProvider: boolean;
}

interface PortfolioTableProps {
    data: DetailedHoldingItem[]; // Already filtered & processed data
    allData: DetailedHoldingItem[]; // For generating filter options
    filters: PortfolioFilterState;
    onFilterChange: (newFilters: PortfolioFilterState) => void;
    isLoading?: boolean;
    onAssetSelect?: (asset: DetailedHoldingItem) => void;
}
// --- Sub-Component: Custom Provider Dropdown ---
const ProviderDropdown = ({
    providers,
    selectedProvider,
    onSelect
}: {
    providers: { name: string; id: string }[];
    selectedProvider: string;
    onSelect: (providerName: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    // Close on outside click (simple implementation or ref needed)
    // For now, let's use a simple backdrop or rely on local state
    // To make it robust without extra libs, a backdrop is easiest:

    const selectedProviderItem = providers.find(p => p.name === selectedProvider);

    return (
        <div className="relative">
            {isOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-3 bg-[#131722] border rounded-xl pl-3 pr-3 py-2 text-sm min-w-[180px] transition-all relative z-20 ${isOpen ? 'border-[#3978FF] text-white shadow-lg shadow-[#3978FF]/10' : 'border-[#2A2E39] text-gray-300 hover:text-white hover:border-[#3978FF]/50'}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {selectedProvider === 'all' ? (
                        <div className={`w-8 h-8 rounded-lg bg-[#2A2E39] p-2 flex items-center justify-center border border-[#2A2E39] ${selectedProvider !== 'all' ? 'text-[#3978FF]' : 'text-gray-500'}`}>
                            <Filter className="w-4 h-4" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#2A2E39] p-1.5 flex items-center justify-center overflow-hidden shrink-0 border border-[#2A2E39]">
                            <img
                                src={`/icons/square_icon/${(selectedProviderItem?.id || 'binance').toLowerCase()}.svg`}
                                className="w-full h-full object-contain rounded-md"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                        </div>
                    )}
                    <span className="truncate font-medium">
                        {selectedProvider === 'all' ? 'All Platforms' : selectedProvider}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#3978FF]' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-[#1E222D] border border-[#2A2E39] rounded-xl shadow-xl overflow-hidden z-30"
                    >
                        <div className="max-h-[300px] overflow-y-auto py-1 custom-scrollbar">
                            <button
                                onClick={() => { onSelect('all'); setIsOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${selectedProvider === 'all' ? 'bg-[#3978FF]/10 text-[#3978FF]' : 'text-gray-300 hover:bg-[#2A2E39] hover:text-white'}`}
                            >
                                <div className="w-8 h-8 rounded-lg bg-[#2A2E39] p-2 flex items-center justify-center border border-[#2A2E39]">
                                    <Filter className="w-4 h-4 text-gray-400" />
                                </div>
                                <span className="font-medium">All Platforms</span>
                                {selectedProvider === 'all' && <Check className="w-4 h-4 ml-auto" />}
                            </button>

                            {providers.map((p) => (
                                <button
                                    key={p.name}
                                    onClick={() => { onSelect(p.name); setIsOpen(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${selectedProvider === p.name ? 'bg-[#3978FF]/10 text-[#3978FF]' : 'text-gray-300 hover:bg-[#2A2E39] hover:text-white'}`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#2A2E39] p-1.5 flex items-center justify-center overflow-hidden shrink-0 border border-[#2A2E39]">
                                        <img
                                            src={`/icons/square_icon/${(p.id || 'binance').toLowerCase()}.svg`}
                                            className="w-full h-full object-contain rounded-md"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                    </div>
                                    <span className="font-medium truncate">{p.name}</span>
                                    {selectedProvider === p.name && <Check className="w-4 h-4 ml-auto" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};


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
                        <div className="flex items-center gap-4 py-2">
                            {/* Large Square Icon */}
                            <div className="w-12 h-12 rounded-2xl bg-[#131722] flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden shadow-sm border border-[#2A2E39]">
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
                                ) : (
                                    <span className="text-xl">
                                        {{
                                            'USD': '$',
                                            'EUR': '€',
                                            'GBP': '£',
                                            'JPY': '¥',
                                            'AUD': 'A$',
                                            'CAD': 'C$',
                                            'CHF': 'Fr',
                                            'CNY': '¥',
                                            'RUB': '₽',
                                            'NZD': 'NZ$',
                                            'SEK': 'kr',
                                            'KRW': '₩',
                                            'SGD': 'S$',
                                            'HKD': 'HK$',
                                            'MXN': '$',
                                            'INR': '₹',
                                            'TRY': '₺',
                                            'BRL': 'R$',
                                            'ZAR': 'R',
                                        }[row.symbol.toUpperCase()] || row.symbol[0]}
                                    </span>
                                )}
                            </div>
                            <div>
                                <div className="font-bold text-white text-base">{row.symbol}</div>
                                <div className="text-xs text-gray-400 font-medium mt-0.5">{row.name}</div>
                            </div>
                        </div>
                    );
                },
            }),
            showIntegrationCol ? columnHelper.accessor("integration_name", {
                header: "Source",
                cell: (info) => (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-white p-0.5 flex items-center justify-center overflow-hidden">
                            {/* Try to load icon based on ID logic if we had it, for now rely on text or generic */}
                            <img src={`/icons/square_icon/${(info.row.original.provider_id || 'binance').toLowerCase()}.svg`}
                                className="w-full h-full object-contain"
                                onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                        </div>
                        <span className="text-sm font-medium text-gray-300">{info.getValue()}</span>
                    </div>
                )
            }) : null,
            columnHelper.accessor("price_usd", {
                header: "Price",
                cell: (info) => {
                    const priceUsd = info.getValue();
                    return <span className="text-white font-medium text-sm tabular-nums">
                        ${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>;
                },
            }),
            columnHelper.accessor("change_24h", {
                header: "24h Change",
                cell: (info) => {
                    const val = info.getValue();
                    if (val === null || val === undefined) return <span className="text-gray-500">-</span>;
                    if (Math.abs(val) < 0.005) return <span className="text-xs font-bold text-gray-500">0.00%</span>;
                    const isPos = val > 0;
                    return (
                        <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${isPos ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                            {isPos ? "+" : ""}{val.toFixed(2)}%
                        </div>
                    );
                },
            }),
            columnHelper.accessor("balance", {
                header: "Balance",
                cell: (info) => <span className="text-gray-400 text-sm font-medium tabular-nums">{info.getValue().toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>,
            }),
            columnHelper.accessor("value_usd", {
                header: "Value (USD)",
                cell: (info) => <span className="text-white font-bold text-base tabular-nums">
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
        <div className="overflow-x-auto rounded-2xl border border-[#2A2E39] bg-[#1E222D]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-[#151921] text-xs font-semibold text-gray-400 uppercase border-b border-[#2A2E39]">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                                <th key={header.id} className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={header.column.getToggleSortingHandler()}>
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
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="p-12 text-center text-gray-500">
                                No assets match your filters.
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map(row => (
                            <tr
                                key={row.id}
                                className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                onClick={() => onAssetClick(row.original)}
                            >
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

// --- Main Component ---

export function PortfolioTable({ data, allData, filters, onFilterChange, isLoading, onAssetSelect }: PortfolioTableProps) {

    // Derived Providers for Filter
    const providers = useMemo(() => {
        const map = new Map<string, string>();
        allData.forEach(item => {
            if (!map.has(item.integration_name)) {
                map.set(item.integration_name, item.provider_id || item.integration_name);
            }
        });
        return Array.from(map.entries()).map(([name, id]) => ({ name, id }));
    }, [allData]);

    const handleAssetClick = (asset: DetailedHoldingItem) => {
        onAssetSelect?.(asset);
    };

    // Grouping for Render (if detailed + grouped)
    const groupedData = useMemo(() => {
        if (!filters.groupByProvider || filters.viewMode === 'aggregated') return null;
        const groups: Record<string, DetailedHoldingItem[]> = {};
        data.forEach(item => {
            const key = item.integration_name;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [data, filters.groupByProvider, filters.viewMode]);

    if (isLoading) return <div className="h-64 bg-[#1E222D] rounded-xl animate-pulse" />;

    return (
        <div className="space-y-6">
            {/* Controls Bar */}
            <div className="flex flex-col xl:flex-row gap-4 justify-between bg-[#1E222D] p-5 rounded-2xl border border-[#2A2E39] shadow-lg">
                {/* Search */}
                <div className="relative w-full xl:w-80 group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#3978FF] transition-colors">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search assets..."
                        className="w-full bg-[#131722] border border-[#2A2E39] rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-[#3978FF]/20 focus:border-[#3978FF] outline-none transition-all placeholder:text-gray-600"
                        value={filters.search}
                        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                    />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Provider Filter (Custom Drodown) */}
                    <ProviderDropdown
                        providers={providers}
                        selectedProvider={filters.selectedProvider}
                        onSelect={(val) => onFilterChange({ ...filters, selectedProvider: val })}
                    />


                    {/* Dust Toggle */}
                    <div className="flex items-center px-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                checked={filters.hideDust}
                                onChange={() => onFilterChange({ ...filters, hideDust: !filters.hideDust })}
                                className="w-4 h-4 rounded border-[#2A2E39] bg-[#131722] text-[#3978FF] accent-[#3978FF] focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer transition-colors"
                            />
                            <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">
                                Hide assets {'<'} $1
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Content */}
            {groupedData ? (
                <div className="space-y-8">
                    {Object.entries(groupedData).map(([provider, items]) => {
                        const groupTotal = items.reduce((sum, i) => sum + i.value_usd, 0);
                        return (
                            <div key={provider} className="animate-in fade-in duration-500">
                                <div className="flex items-end justify-between mb-4 px-2">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center">
                                            <img src={`/icons/square_icon/${(items[0]?.provider_id || 'binance').toLowerCase()}.svg`}
                                                className="w-full h-full object-contain"
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        </div>
                                        {provider}
                                    </h3>
                                    <span className="text-sm font-bold text-[#00C805] bg-[#00C805]/10 px-4 py-1.5 rounded-full border border-[#00C805]/20">
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
                    data={data}
                    showIntegrationCol={filters.viewMode === 'detailed'}
                    onAssetClick={handleAssetClick}
                />
            )}
        </div>
    );
}
