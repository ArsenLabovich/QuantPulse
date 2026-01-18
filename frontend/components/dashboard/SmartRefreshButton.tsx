"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import api from "@/lib/api";

interface SmartRefreshButtonProps {
    onRefreshComplete: () => Promise<void>;
}

export default function SmartRefreshButton({ onRefreshComplete }: SmartRefreshButtonProps) {
    const [status, setStatus] = useState<"IDLE" | "PROGRESS" | "DONE" | "ERROR">("IDLE");
    const [message, setMessage] = useState("Initializing...");
    const [taskId, setTaskId] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    // Initial load of cooldown from local storage
    useEffect(() => {
        const savedCooldown = localStorage.getItem("refresh_cooldown");
        if (savedCooldown) {
            const expiry = parseInt(savedCooldown, 10);
            const now = Date.now();
            if (expiry > now) {
                setCooldown(Math.ceil((expiry - now) / 1000));
            }
        }
    }, []);

    // Cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setInterval(() => {
                setCooldown((prev) => {
                    if (prev <= 1) {
                        localStorage.removeItem("refresh_cooldown");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [cooldown]);

    const startRefresh = async () => {
        if (cooldown > 0 || status === "PROGRESS") return;

        try {
            setStatus("PROGRESS");
            setMessage("Processing...");
            const response = await api.post("/dashboard/refresh");
            setTaskId(response.data.task_id);
        } catch (error) {
            console.error(error);
            setStatus("ERROR");
            setMessage("Failed to start");
            setTimeout(() => {
                setStatus("IDLE");
            }, 3000);
        }
    };

    // Polling Logic with Retry Limit
    const failureCount = useRef(0);

    useEffect(() => {
        if (!taskId || status !== "PROGRESS") return;

        const checkStatus = async () => {
            try {
                const response = await api.get(`/dashboard/status/${taskId}`);
                const data = response.data;

                // Reset failure count on success
                failureCount.current = 0;

                if (data.status === "SUCCESS" || (data.info && data.info.stage === "DONE")) {
                    setStatus("DONE");
                    setMessage("Synced!");

                    await onRefreshComplete();

                    const cooldownSeconds = 300; // 5 min
                    const expiry = Date.now() + cooldownSeconds * 1000;
                    localStorage.setItem("refresh_cooldown", expiry.toString());
                    setCooldown(cooldownSeconds);

                    setTimeout(() => {
                        setStatus("IDLE");
                        setTaskId(null);
                    }, 3000);

                } else if (data.status === "FAILURE") {
                    setStatus("ERROR");
                    setMessage(data.info?.error || "Sync Failed");
                    setTimeout(() => {
                        setStatus("IDLE");
                        setTaskId(null);
                    }, 5000);

                } else if (data.status === "PROGRESS" && data.info) {
                    setMessage(data.info.message || "Working...");
                } else if (data.status === "PENDING" || data.status === "STARTED") {
                    setMessage("Queued...");
                }
            } catch (error) {
                console.error("Polling error", error);
                failureCount.current += 1;
                if (failureCount.current >= 5) {
                    setStatus("ERROR");
                    setMessage("Network Error");
                    setTaskId(null); // Stop polling
                    setTimeout(() => setStatus("IDLE"), 3000);
                }
            }
        };

        pollInterval.current = setInterval(checkStatus, 1000);
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [taskId, status, onRefreshComplete]);

    // Helpers for coloring
    const getStatusColor = () => {
        switch (status) {
            case "PROGRESS": return "bg-blue-500";
            case "DONE": return "bg-green-500";
            case "ERROR": return "bg-red-500";
            default: return "bg-gray-500";
        }
    };

    // Calculate progress bar width based on stages roughly
    // INIT -> CONNECTING -> FETCHING_BALANCES -> FETCHING_PRICES -> DONE
    const getProgressPercent = () => {
        if (message.includes("Initializing")) return 10;
        if (message.includes("Queued")) return 5;
        if (message.includes("Connecting")) return 30;
        if (message.includes("Fetching balances")) return 50;
        if (message.includes("Fetching prices")) return 70;
        if (message.includes("Synced")) return 100;
        return 0; // default for unknown or error
    };

    // UI Logic
    const isDisabled = cooldown > 0 || status === "PROGRESS" || status === "DONE";

    return (
        <div className="relative flex flex-col items-end">
            {/* Main Button */}
            <button
                onClick={startRefresh}
                disabled={isDisabled}
                className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors border border-[#2A2E39]
                    ${isDisabled
                        ? 'bg-[#131722] text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-[#1C202B] hover:bg-[#252A36] text-white'}
                `}
            >
                <RefreshCw className={`w-4 h-4 ${status === "PROGRESS" ? "animate-spin" : ""}`} />
                <span className="text-sm font-medium">
                    {cooldown > 0
                        ? `Wait ${(cooldown / 60).toFixed(0)}:${(cooldown % 60).toString().padStart(2, '0')}`
                        : status === "PROGRESS" ? "Syncing..." : "Refresh Data"}
                </span>
            </button>

            {/* Status Indicator (Below) */}
            {(status !== "IDLE" || cooldown > 0) && (
                <div className="absolute top-full right-0 mt-2 w-[200px] flex flex-col items-end z-[9999]">
                    {/* Text + Dot */}
                    <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs text-gray-500 font-medium truncate">
                            {cooldown > 0 ? "Cooldown active" : message}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()} ${status === "PROGRESS" ? "animate-pulse" : ""}`} />
                    </div>

                    {/* Minimal Progress Line */}
                    {status === "PROGRESS" && (
                        <div className="w-full bg-[#131722] h-0.5 rounded-full overflow-hidden mt-1">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                                style={{ width: `${getProgressPercent()}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
