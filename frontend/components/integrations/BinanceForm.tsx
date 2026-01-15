"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthMethod = "api_key" | "oauth";

export default function BinanceForm() {
    const [authMethod, setAuthMethod] = useState<AuthMethod>("api_key");
    const [connectionName, setConnectionName] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [apiSecret, setApiSecret] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);
        setLoading(true);

        try {
            // TODO: Implement API call using React Query
            // This will be done in the state-management todo
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to connect to Binance");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Binance Integration</h2>
                <p className="text-slate-400">Connect your Binance account to sync trading data</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    type="button"
                    onClick={() => setAuthMethod("api_key")}
                    className={cn(
                        "px-4 py-2 font-medium text-sm transition-colors border-b-2",
                        authMethod === "api_key"
                            ? "text-primary border-primary"
                            : "text-slate-400 border-transparent hover:text-white"
                    )}
                >
                    API Key
                </button>
                <button
                    type="button"
                    onClick={() => setAuthMethod("oauth")}
                    disabled
                    className={cn(
                        "px-4 py-2 font-medium text-sm transition-colors border-b-2",
                        "text-slate-500 border-transparent cursor-not-allowed"
                    )}
                >
                    OAuth (Coming Soon)
                </button>
            </div>

            {/* Security Warning */}
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-200 mb-1">Security Recommendation</p>
                    <p className="text-xs text-yellow-300/80">
                        For your security, please disable &quot;Enable Withdrawals&quot; in your Binance API settings.
                        Only use Read-Only API keys.
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Connection Name
                    </label>
                    <input
                        type="text"
                        placeholder="e.g., Main Binance Account"
                        className="w-full p-3 rounded-md bg-surface border border-border text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                        value={connectionName}
                        onChange={(e) => setConnectionName(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        API Key
                    </label>
                    <input
                        type="text"
                        placeholder="Enter your Binance API Key"
                        className={cn(
                            "w-full p-3 rounded-md bg-surface border text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all",
                            error ? "border-red-500/50 focus:ring-red-500/50" : "border-border"
                        )}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        API Secret
                    </label>
                    <input
                        type="password"
                        placeholder="Enter your Binance API Secret"
                        className={cn(
                            "w-full p-3 rounded-md bg-surface border text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all",
                            error ? "border-red-500/50 focus:ring-red-500/50" : "border-border"
                        )}
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        required
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                        Binance Connected Successfully!
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !connectionName || !apiKey || !apiSecret}
                    className={cn(
                        "w-full py-3 px-4 rounded-md font-medium text-white transition-all",
                        "bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center justify-center gap-2"
                    )}
                >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? "Connecting..." : "Connect Binance"}
                </button>
            </form>
        </div>
    );
}
