"use client";

import { useMemo, useState, useEffect } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { ArrowLeft, Info, HelpCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

interface MetricDetailsProps {
    slug: string;
}

// Mock Data Generators (Utils)
const generateDateSeries = (days = 30) => {
    return Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - i));
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
};


const DATES = generateDateSeries(90);

interface MetricConfig {
    title: string;
    description: string;
    color: string;
    type: string;
    data?: { date: string; value: number }[] | Record<string, unknown>[];
    stats?: { label: string; value: string }[];
    live?: boolean;
}

// Configuration for each metric
const METRIC_CONFIG: Record<string, MetricConfig> = {
    "monte-carlo": {
        title: "Monte Carlo Simulation",
        description: "Projects thousands of possible future price paths based on historical volatility and drift.",
        color: "#10B981",
        type: "placeholder",
    },
    "drawdown": {
        title: "Max Drawdown Analysis",
        description: "Visualizes the decline from a historical peak. Helps understand the depth and duration of losses.",
        color: "#F43F5E",
        type: "placeholder",
    },
    "volatility": {
        title: "Rolling Volatility (30D)",
        description: "Measures the standard deviation of returns over a rolling 30-day window. Higher values indicate higher risk.",
        color: "#F59E0B",
        type: "line",
        data: [],
        stats: [],
        live: true,
    },
    "risk": {
        title: "Value at Risk (VaR)",
        description: "The maximum expected loss over a specific time horizon at a given confidence level (95%).",
        color: "#F43F5E",
        type: "placeholder",
    },
    "sharpe": {
        title: "Sharpe Ratio Trend",
        description: "Risk-adjusted return relative to the risk-free rate. A ratio > 1.0 is considered good.",
        color: "#10B981",
        type: "placeholder",
    },
    "sortino": {
        title: "Sortino Ratio Trend",
        description: "Similar to Sharpe, but only penalizes downside volatility. Better for strategies with upside skew.",
        color: "#10B981",
        type: "line",
        data: DATES.map((date) => ({
            date,
            value: 2.0 + (Math.random() - 0.4)
        })),
        stats: [
            { label: "Current Ratio", value: "2.10" },
            { label: "Downside Dev", value: "8.4%" },
            { label: "MAR Ratio", value: "1.2" },
        ]
    },
    "treynor": {
        title: "Treynor Ratio",
        description: "Risk-adjusted return based on systematic risk (Beta) rather than total risk.",
        color: "#10B981",
        type: "placeholder",
    },
    "beta": {
        title: "Portfolio Beta",
        description: "Measures the volatility of the portfolio in relation to the overall market.",
        color: "#3B82F6",
        type: "placeholder",
    },
    "r-squared": {
        title: "R-Squared",
        description: "Represents the percentage of a fund or security's movements that can be explained by movements in a benchmark index.",
        color: "#3B82F6",
        type: "placeholder",
    },
    "correlations": {
        title: "Correlation Matrix",
        description: "Shows how assets in the portfolio move in relation to each other. Lower correlation means better diversification.",
        color: "#3B82F6",
        type: "placeholder",
    }
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: { name?: string; value: number; stroke?: string; fill?: string; dataKey?: string; payload: { date?: string } }[];
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-[#18181B] border border-[#27272A] rounded-md shadow-lg text-sm text-white">
                <p className="font-bold mb-1">{payload[0].payload.date}</p>
                {payload.map((entry, index) => (
                    <p key={`item-${index}`} style={{ color: entry.stroke || entry.fill }}>
                        {entry.name || entry.dataKey}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

interface MetricData {
    status: string;
    display_value: string;
    actual_days: number;
    meta?: {
        daily_vol?: number;
        rolling_30d?: { date: string; value: number }[];
    };
}

export function MetricDetails({ slug }: MetricDetailsProps) {
    const baseConfig = useMemo(() => METRIC_CONFIG[slug] || {
        title: "Metric Analysis",
        description: "Detailed breakdown not yet available for this metric.",
        color: "#52525B",
        type: "placeholder"
    }, [slug]);

    const [liveData, setLiveData] = useState<MetricData | null>(null);
    const [loading, setLoading] = useState(!!baseConfig.live);
    const [prevSlug, setPrevSlug] = useState(slug);

    if (slug !== prevSlug) {
        setPrevSlug(slug);
        if (baseConfig.live) {
            setLoading(true);
        }
    }

    useEffect(() => {
        if (!baseConfig.live) return;

        const controller = new AbortController();
        // setLoading(true); // Moved to render phase for prop changes

        api.get(`/analytics/metric/${slug}`, { signal: controller.signal })
            .then(({ data }) => {
                setLiveData(data);
                setLoading(false);
            })
            .catch((err) => {
                if (err.name !== 'CanceledError') {
                    setLiveData(null);
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [slug, baseConfig.live]);

    const config = useMemo(() => {
        if (!baseConfig.live || !liveData || liveData.status !== "ready") return baseConfig;

        const rolling = liveData.meta?.rolling_30d || [];
        return {
            ...baseConfig,
            data: rolling,
            stats: [
                { label: "Current Vol", value: liveData.display_value },
                { label: "Daily Vol", value: `${((liveData.meta?.daily_vol || 0) * 100).toFixed(3)}%` },
                { label: "Data Points", value: `${liveData.actual_days} days` },
            ],
        };
    }, [baseConfig, liveData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-[#71717A]">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading analysis...
            </div>
        );
    }

    const renderChart = () => {
        switch (config.type) {
            case 'multi-line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={config.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="sim1" stroke={config.color} strokeOpacity={0.3} dot={false} strokeWidth={1} />
                            <Line type="monotone" dataKey="sim2" stroke={config.color} strokeOpacity={0.3} dot={false} strokeWidth={1} />
                            <Line type="monotone" dataKey="sim3" stroke={config.color} strokeOpacity={0.3} dot={false} strokeWidth={1} />
                            <Line type="monotone" dataKey="simMean" stroke="#fff" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'area-negative':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={config.data}>
                            <defs>
                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#52525B" />
                            <Area type="monotone" dataKey="value" stroke={config.color} fillOpacity={1} fill="url(#colorVal)" />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={config.data}>
                            <defs>
                                <linearGradient id={`grad-${slug}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={config.color} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="value" stroke={config.color} fill={`url(#grad-${slug})`} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'bar-distribution':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={config.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="range" stroke="#52525B" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis stroke="#52525B" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }} cursor={{ fill: '#27272A' }} />
                            <Bar dataKey="frequency" fill={config.color} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                            <XAxis type="number" dataKey="x" name="Market" stroke="#52525B" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis type="number" dataKey="y" name="Portfolio" stroke="#52525B" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Returns" data={config.data} fill={config.color} />
                            {/* Ideal line */}
                            <ReferenceLine segment={[{ x: -2, y: -2 }, { x: 2, y: 2 }]} stroke="#52525B" strokeDasharray="3 3" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            case 'heatmap':
                return (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="grid grid-cols-5 gap-1">
                            {Array.from({ length: 25 }).map((_, i) => {
                                const val = Math.random();
                                const color = val > 0.7 ? "bg-rose-500" : val > 0.4 ? "bg-amber-500" : "bg-emerald-500";
                                return (
                                    <div key={i} className={`w-12 h-12 rounded-sm ${color} opacity-${Math.floor(val * 100)} hover:opacity-100 transition-opacity cursor-pointer`} title={`Corr: ${val.toFixed(2)}`} />
                                );
                            })}
                        </div>
                    </div>
                );
            case 'bar-simple':
                return (
                    <div className="w-full h-full flex items-center justify-center px-10">
                        <div className="w-full h-8 bg-gray-800 rounded-full overflow-hidden relative">
                            <div className="h-full bg-blue-500" style={{ width: '85%' }} />
                            <div className="absolute top-0 right-0 h-full w-[15%] flex items-center justify-center text-xs text-gray-500">Unexplained</div>
                            <div className="absolute top-0 left-0 h-full w-[85%] flex items-center justify-center text-xs text-white font-bold">85% Explained</div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center justify-center h-full text-[#52525B] flex-col gap-2">
                        <HelpCircle className="w-10 h-10 opacity-20" />
                        <span>Analysis visualization pending</span>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <Link
                    href="/dashboard/analytics"
                    className="inline-flex items-center gap-2 text-[#909399] hover:text-white transition-colors text-sm mb-2 w-fit group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </Link>
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full`} style={{ backgroundColor: config.color }} />
                    <h1 className="text-3xl font-bold text-white tracking-tight">{config.title}</h1>
                </div>
                <p className="text-[#A1A1AA] max-w-2xl text-lg leading-relaxed">
                    {config.description}
                </p>
            </div>

            {/* Key Stats Grid */}
            {config.stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {config.stats.map((stat, i) => (
                        <div key={i} className="p-5 rounded-xl bg-[#121212] border border-[#27272A] flex flex-col items-center text-center hover:border-[#3F3F46] transition-colors">
                            <span className="text-xs text-[#71717A] uppercase tracking-wider font-medium mb-1">{stat.label}</span>
                            <span className="text-2xl font-bold text-white">{stat.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Chart Area */}
            <div className="h-[400px] w-full p-6 rounded-2xl bg-[#121212] border border-[#27272A] relative overflow-hidden">
                {renderChart()}
            </div>

            {/* Info Block */}
            {!config.live && (
                <div className="p-4 rounded-lg bg-[#18181B] border border-[#27272A] flex gap-3 items-start">
                    <Info className="w-5 h-5 text-[#52525B] mt-0.5 shrink-0" />
                    <div className="text-sm text-[#71717A] leading-relaxed">
                        This metric is currently under development. Detailed analysis will be available in the next update.
                    </div>
                </div>
            )}
        </div>
    );
}
