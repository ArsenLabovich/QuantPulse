"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useRefresh } from "@/context/RefreshContext";
// import { formatCurrency } from "@/lib/utils"; // Not used currently
// Actually I don't know if lib/utils exists. Let's inline formatting.

function formatUSD(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
}

interface Asset {
    id: string;
    symbol: string;
    name: string;
    amount: number;
    usd_value: number;
    original_name: string;
}

export function AssetList() {
    const { refreshKey } = useRefresh();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const response = await api.get("/dashboard/assets");
                setAssets(response.data);
            } catch (error) {
                console.error("Failed to fetch assets", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, [refreshKey]);

    if (loading) return <div className="text-gray-500 text-sm">Loading assets...</div>;

    if (assets.length === 0) return <div className="text-gray-500 text-sm">No assets found.</div>;

    return (
        <div className="bg-[#131722] rounded-xl border border-[#2A2E39] overflow-hidden">
            <div className="p-4 border-b border-[#2A2E39]">
                <h3 className="text-lg font-semibold text-white">Holdings</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="bg-[#1E222D] text-gray-300 uppercase font-medium">
                        <tr>
                            <th className="px-6 py-3">Asset</th>
                            <th className="px-6 py-3 text-right">Balance</th>
                            <th className="px-6 py-3 text-right">Value (USD)</th>
                            <th className="px-6 py-3 text-right">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((asset) => (
                            <tr key={asset.id} className="border-b border-[#2A2E39] hover:bg-[#1E222D]/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-white flex items-center space-x-2">
                                    <span>{asset.name}</span>
                                    <span className="text-gray-500 text-xs">({asset.symbol})</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {Number(asset.amount).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right text-white">
                                    {formatUSD(asset.usd_value)}
                                </td>
                                <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">
                                    {asset.original_name}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
