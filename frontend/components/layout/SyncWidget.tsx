"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react";
import api from "@/lib/api";
import { useRefresh } from "@/context/RefreshContext";

export function SyncWidget() {
    const { triggerRefresh } = useRefresh();
    // IDLE | SYNCING | SUCCESS | COOLDOWN | ERROR
    const [status, setStatus] = useState<string>("IDLE");
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [autoSyncInterval, setAutoSyncInterval] = useState<number | null>(null);
    const [nextAutoSyncTime, setNextAutoSyncTime] = useState<Date | null>(null);
    const [timeToAutoSync, setTimeToAutoSync] = useState<number | null>(null);

    // Progress State
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncMessage, setSyncMessage] = useState("Initializing...");

    // To prevent multiple auto-sync triggers
    const isSyncingRef = useRef(false);

    // Load cached state immediately
    useEffect(() => {
        const cachedLastSync = localStorage.getItem("last_sync_time");
        const cachedInterval = localStorage.getItem("auto_sync_interval");

        if (cachedInterval) {
            const interval = parseInt(cachedInterval, 10);
            setAutoSyncInterval(interval);

            if (cachedLastSync) {
                const last = new Date(cachedLastSync);
                const next = new Date(last.getTime() + interval * 1000);
                setNextAutoSyncTime(next);
                // Calculate diff immediately for UI
                const now = new Date();
                const diff = Math.ceil((next.getTime() - now.getTime()) / 1000);
                setTimeToAutoSync(diff);
            }
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get("/dashboard/sync-status");
            const { remaining_cooldown, active_task_id, last_sync_time, auto_sync_interval } = response.data;

            if (auto_sync_interval) {
                setAutoSyncInterval(auto_sync_interval);
                localStorage.setItem("auto_sync_interval", auto_sync_interval.toString());

                if (last_sync_time) {
                    const last = new Date(last_sync_time);
                    localStorage.setItem("last_sync_time", last_sync_time);

                    const next = new Date(last.getTime() + auto_sync_interval * 1000);
                    setNextAutoSyncTime(next);
                }
            }

            if (active_task_id) {
                setTaskId(active_task_id);
                setStatus("SYNCING");
                isSyncingRef.current = true;

                // Immediately fetch task details to restore progress
                try {
                    const taskResponse = await api.get(`/dashboard/status/${active_task_id}`);
                    const taskData = taskResponse.data;
                    if (taskData.info && typeof taskData.info === 'object') {
                        if (taskData.info.current && taskData.info.total) {
                            const pct = Math.round((taskData.info.current / taskData.info.total) * 100);
                            setSyncProgress(pct);
                        }
                        if (taskData.info.message) {
                            setSyncMessage(taskData.info.message);
                        }
                    }
                } catch (e) {
                    console.error("Failed to restore task progress", e);
                }
            } else if (remaining_cooldown > 0) {
                setCooldownRemaining(remaining_cooldown);
                setStatus("COOLDOWN");
                isSyncingRef.current = false;
            } else {
                isSyncingRef.current = false;
            }
            return remaining_cooldown;
        } catch (error) {
            console.error("Failed to fetch sync status", error);
            return 0;
        }
    }, []);

    const handleSync = useCallback(async () => {
        // Rely on status to prevent double-submit, but allow retry if previously failed (IDLE/ERROR)
        if (status === "SYNCING" || status === "COOLDOWN") return;

        try {
            // Clear auto-sync timer immediately to prevent loops
            setNextAutoSyncTime(null);
            setTimeToAutoSync(null);

            setStatus("SYNCING");
            setSyncProgress(0);
            setSyncMessage("Initializing...");
            isSyncingRef.current = true;

            const response = await api.post("/dashboard/refresh");
            setTaskId(response.data.task_id);
        } catch (error: any) {
            isSyncingRef.current = false;
            // If failed, restore auto-sync? Or just wait for user?
            // Let's set error
            if (error.response?.status === 429) {
                const retryAfter = error.response.data.detail.retry_after || 20;
                setCooldownRemaining(retryAfter);
                setStatus("COOLDOWN");
            } else {
                console.error("Sync trigger failed", error);
                setStatus("ERROR");
                setTimeout(() => setStatus("IDLE"), 3000);
            }
        }
    }, [status]);

    // Initial Load
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Auto-Sync and Cooldown Timer
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();

            // 1. Handle Cooldown
            if (status === "COOLDOWN") {
                setCooldownRemaining((prev) => {
                    if (prev <= 1) {
                        setStatus("IDLE");
                        return 0;
                    }
                    return prev - 1;
                });
            }

            // 2. Handle Auto-Sync Countdown
            if (nextAutoSyncTime && status === "IDLE") {
                const diff = Math.ceil((nextAutoSyncTime.getTime() - now.getTime()) / 1000);
                setTimeToAutoSync(diff);

                if (diff <= 0) {
                    // Trigger Auto Sync
                    console.log("Auto-sync triggered");
                    handleSync();
                }
            } else {
                setTimeToAutoSync(null);
            }

        }, 1000);

        return () => clearInterval(timer);
    }, [status, nextAutoSyncTime, handleSync]);


    // Polling Logic
    useEffect(() => {
        if (status !== "SYNCING" || !taskId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await api.get(`/dashboard/status/${taskId}`);
                const data = response.data;

                // Update Progress
                if (data.info && typeof data.info === 'object') {
                    if (data.info.current && data.info.total) {
                        const pct = Math.round((data.info.current / data.info.total) * 100);
                        setSyncProgress(pct);
                    }
                    if (data.info.message) {
                        setSyncMessage(data.info.message);
                    }
                }

                if (data.status === "SUCCESS" || (data.info && data.info.stage === "DONE")) {
                    setStatus("SUCCESS");
                    setSyncProgress(100);
                    // Update next auto sync time immediately based on local time + interval
                    // (Double check with server later)
                    if (autoSyncInterval) {
                        setNextAutoSyncTime(new Date(Date.now() + autoSyncInterval * 1000));
                    }

                    // Trigger global refresh
                    triggerRefresh();
                    isSyncingRef.current = false; // Release lock

                    // Fetch authoritative info
                    setTimeout(async () => {
                        const remaining = await fetchStatus();
                        setTaskId(null);
                        if (remaining > 0) {
                            setStatus("COOLDOWN");
                        } else {
                            setStatus("IDLE");
                        }
                    }, 1000);

                } else if (data.status === "FAILURE") {
                    setStatus("ERROR");
                    setTaskId(null);
                    isSyncingRef.current = false;
                    setTimeout(() => setStatus("IDLE"), 3000);
                }
            } catch (error) {
                console.error("Poll error", error);
            }
        }, 800); // Poll slightly faster for smooth progress

        return () => clearInterval(pollInterval);
    }, [status, taskId, triggerRefresh, fetchStatus, autoSyncInterval]);


    const formatTime = (seconds: number) => {
        if (seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                onClick={handleSync}
                disabled={status !== "IDLE" && status !== "ERROR"}
                className={`
                    flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                    border relative overflow-hidden
                    ${status === "IDLE"
                        ? "border-[#2A2E39] bg-transparent text-gray-400 hover:text-white hover:border-gray-500"
                        : status === "SYNCING"
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-400 cursor-default"
                            : status === "SUCCESS"
                                ? "border-green-500/50 bg-green-500/10 text-green-400"
                                : status === "COOLDOWN"
                                    ? "border-transparent bg-[#131722] text-gray-600 cursor-not-allowed"
                                    : "border-red-500/50 bg-red-500/10 text-red-400"
                    }
                `}
            >
                {/* Progress Bar Background */}
                {status === "SYNCING" && (
                    <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-500/20 transition-all duration-300 ease-out"
                        style={{ width: `${syncProgress}%` }}
                    />
                )}

                {status === "IDLE" && (
                    <>
                        <RefreshCw className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">Refresh Data</span>
                    </>
                )}

                {status === "SYNCING" && (
                    <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10 shrink-0" />
                        <span className="relative z-10 truncate max-w-[200px]">{syncMessage}</span>
                    </>
                )}

                {status === "SUCCESS" && (
                    <>
                        <CheckCircle2 className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">Synced</span>
                    </>
                )}

                {status === "COOLDOWN" && (
                    <>
                        <Clock className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">Wait {formatTime(cooldownRemaining)}</span>
                    </>
                )}

                {status === "ERROR" && (
                    <span className="relative z-10">Sync Failed</span>
                )}
            </button>

            {/* Auto-Sync Timer Caption */}
            {status === "IDLE" && timeToAutoSync !== null && (
                <span className="text-[10px] text-gray-500 pr-1 tabular-nums">
                    Auto-update in {formatTime(timeToAutoSync)}
                </span>
            )}
            {status === "IDLE" && timeToAutoSync === null && (
                <span className="text-[10px] text-gray-700 pr-1 animate-pulse">
                    loading...
                </span>
            )}
            {status === "COOLDOWN" && (
                <span className="text-[10px] text-gray-500 pr-1 tabular-nums">
                    cooling down...
                </span>
            )}
        </div>
    );
}
