"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { HoldingsTable } from "@/components/dashboard/HoldingsTable";
import { useRefresh } from "@/context/RefreshContext";
import { HoldingItem } from "@/types/dashboard";

export default function PortfolioPage() {
    const { refreshKey } = useRefresh();
    const [holdings, setHoldings] = useState<HoldingItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const response = await api.get("/dashboard/summary");
            if (response.data && response.data.holdings) {
                setHoldings(response.data.holdings);
            }
        } catch (error) {
            console.error("Failed to fetch detailed holdings", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [refreshKey]);

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
                        Portfolio
                    </h1>
                    <p className="text-gray-400">Detailed view of all your assets and positions.</p>
                </div>
            </header>

            <div className="min-h-[500px]">
                <HoldingsTable data={holdings} isLoading={loading} />
            </div>
        </div>
    );
}
