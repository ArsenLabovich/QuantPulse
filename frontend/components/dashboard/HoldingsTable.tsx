"use client";

import { useMemo, useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    flexRender,
    createColumnHelper,
    SortingState
} from "@tanstack/react-table";

import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { HoldingItem } from "@/types/dashboard";

interface HoldingsTableProps {
    data: HoldingItem[];
    isLoading?: boolean;
}

export function HoldingsTable({ data, isLoading }: HoldingsTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: "value_usd", desc: true }]);
    const [hideDust, setHideDust] = useState(false);

    // Filter logic
    const filteredData = useMemo(() => {
        if (!hideDust) return data;
        return data.filter(item => item.value_usd >= 1.0);
    }, [data, hideDust]);

    const columnHelper = createColumnHelper<HoldingItem>();

    const columns = useMemo(() => [
        columnHelper.accessor("symbol", {
            header: "Asset",
            cell: (info: any) => {
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
                                        // Fallback to professional generic icon on error
                                        e.currentTarget.src = "/icons/generic_asset.png";
                                        // Prevents infinite loop if generic icon fails
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
        columnHelper.accessor("price_usd", {
            header: "Price",
            cell: (info: any) => {
                const priceUsd = info.getValue();
                const row = info.row.original;
                const isNotUsd = row.currency && row.currency !== 'USD';

                const currencySymbols: Record<string, string> = {
                    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CHF': 'Fr'
                };
                const originalSymbol = currencySymbols[row.currency || 'USD'] || '$';

                return (
                    <div className="flex flex-col">
                        <span className="text-white font-semibold text-sm">
                            ${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                        {isNotUsd && (
                            <span className="text-xs text-gray-500 font-medium">
                                {originalSymbol}{row.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </span>
                        )}
                    </div>
                );
            },
        }),
        columnHelper.accessor("change_24h", {
            header: "24h Change",
            cell: (info: any) => {
                const val = info.getValue();
                if (val === null || val === undefined) return <span className="text-gray-500">-</span>;

                // Handle near-zero values (0.00%) as gray
                if (Math.abs(val) < 0.005) {
                    return (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/5 text-gray-500">
                            0.00%
                        </span>
                    );
                }

                const isPositive = val > 0;
                return (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-[#00C805]/10 text-[#00C805]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'}`}>
                        {isPositive ? "+" : ""}{val.toFixed(2)}%
                    </span>
                );
            },
        }),
        columnHelper.accessor("balance", {
            header: "Balance",
            cell: (info: any) => {
                const val = info.getValue();
                return <span className="text-gray-400 text-sm font-medium">{val.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>;
            },
        }),
        columnHelper.accessor("value_usd", {
            header: "Value (USD)",
            cell: (info: any) => {
                const val = info.getValue();
                return <span className="text-white font-bold text-sm min-w-[80px] inline-block text-right">
                    ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>;
            },
        }),
    ], []);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        autoResetPageIndex: false, // Prevent page reset on data update
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-[#1E222D] rounded-lg w-full" />
                <div className="h-64 bg-[#1E222D] rounded-lg w-full" />
            </div>
        );
    }

    // Empty state
    if (data.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 bg-[#1E222D] rounded-xl border border-[#2A2E39]">
                <p>No holdings found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end mb-4">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                    <div className="relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={hideDust}
                            onChange={(e) => setHideDust(e.target.checked)}
                            className="peer appearance-none w-5 h-5 rounded-md border border-[#2A2E39] bg-[#131722] checked:bg-[#3978FF] checked:border-[#3978FF] transition-all cursor-pointer"
                        />
                        <svg
                            className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors font-medium">Hide assets &lt; $1</span>
                </label>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#131722] text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-[#2A2E39]">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className={`p-4 transition-colors hover:text-white cursor-pointer select-none ${header.column.getCanSort() ? 'hover:bg-white/5' : ''}`}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-2">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: <ChevronUp className="w-3 h-3 text-[rgb(57,120,255)]" />,
                                                desc: <ChevronDown className="w-3 h-3 text-[#3978FF]" />,
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
                                className="group hover:bg-white/5 transition-colors duration-150"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="p-4 whitespace-nowrap">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between px-2 pt-2">
                    <div className="text-xs text-gray-500">
                        Page <span className="text-white">{table.getState().pagination.pageIndex + 1}</span> of {table.getPageCount()}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="p-2 rounded-lg bg-[#1E222D] border border-[#2A2E39] text-gray-400 hover:text-white hover:border-[#3978FF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="p-2 rounded-lg bg-[#1E222D] border border-[#2A2E39] text-gray-400 hover:text-white hover:border-[#3978FF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
