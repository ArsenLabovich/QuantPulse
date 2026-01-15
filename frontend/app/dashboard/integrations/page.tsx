"use client";

import { useState } from "react";
import { Plug, Wallet } from "lucide-react";
import BinanceForm from "@/components/integrations/BinanceForm";

type Provider = "binance" | "trading212" | "ethereum";

interface ProviderInfo {
    id: Provider;
    name: string;
    status: "active" | "coming_soon";
    icon: React.ReactNode;
}

const providers: ProviderInfo[] = [
    {
        id: "binance",
        name: "Binance",
        status: "active",
        icon: <Plug className="w-5 h-5" />
    },
    {
        id: "trading212",
        name: "Trading212",
        status: "coming_soon",
        icon: <Wallet className="w-5 h-5" />
    },
    {
        id: "ethereum",
        name: "Ethereum",
        status: "coming_soon",
        icon: <Wallet className="w-5 h-5" />
    }
];

export default function IntegrationsPage() {
    const [selectedProvider, setSelectedProvider] = useState<Provider>("binance");

    const selectedProviderInfo = providers.find(p => p.id === selectedProvider);

    return (
        <div className="min-h-screen bg-background flex text-white">
            {/* Left Menu */}
            <aside className="w-64 border-r border-border bg-background flex flex-col p-4">
                <div className="mb-8 px-4">
                    <h2 className="text-lg font-semibold text-white">Integrations</h2>
                    <p className="text-sm text-slate-400 mt-1">Connect your accounts</p>
                </div>

                <nav className="flex-1 space-y-1">
                    {providers.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setSelectedProvider(provider.id)}
                            disabled={provider.status === "coming_soon"}
                            className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-md transition-all ${
                                selectedProvider === provider.id
                                    ? "bg-primary/20 text-white border border-primary/30"
                                    : provider.status === "coming_soon"
                                    ? "text-slate-500 cursor-not-allowed"
                                    : "text-slate-300 hover:text-white hover:bg-surface"
                            }`}
                        >
                            {provider.icon}
                            <div className="flex-1 flex items-center justify-between">
                                <span className="font-medium">{provider.name}</span>
                                {provider.status === "coming_soon" && (
                                    <span className="text-xs text-slate-500">Soon</span>
                                )}
                            </div>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Right Workspace */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    {selectedProviderInfo && selectedProviderInfo.status === "active" && selectedProvider === "binance" && (
                        <BinanceForm />
                    )}
                    {selectedProviderInfo && selectedProviderInfo.status === "coming_soon" && (
                        <div className="flex flex-col items-center justify-center h-96 text-center">
                            <div className="p-4 rounded-full bg-surface border border-border mb-4">
                                {selectedProviderInfo.icon}
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">{selectedProviderInfo.name}</h3>
                            <p className="text-slate-400">Coming soon</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
