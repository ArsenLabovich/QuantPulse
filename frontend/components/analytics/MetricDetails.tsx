"use client";

import { useMemo } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ZAxis
} from "recharts";
import { ArrowLeft, Info, HelpCircle } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

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

const generateRandomSeries = (length = 30, base = 100, vol = 2) => {
    let current = base;
    return Array.from({ length }, () => {
        current += (Math.random() - 0.5) * vol;
        return current;
    });
};

const generateDrawdownSeries = (length = 30) => {
    let peak = 100;
    let current = 100;
    return Array.from({ length }, () => {
        const move = (Math.random() - 0.45) * 5;
        current += move;
        if (current > peak) peak = current;
        return ((current - peak) / peak) * 100;
    });
};

const generateScatterData = (length = 50) => {
    return Array.from({ length }, () => ({
        x: (Math.random() - 0.5) * 4, // Market Return
        y: ((Math.random() - 0.5) * 4) * 0.9 + (Math.random() - 0.5) // Asset Return (correlated)
    }));
};

const DATES = generateDateSeries(90);

// Configuration for each metric
const METRIC_CONFIG: Record<string, any> = {
    "monte-carlo": {
        title: "Monte Carlo Simulation",
        description: "Projects thousands of possible future price paths based on historical volatility and drift. The chart shows 5 representative outcomes.",
        color: "#10B981", // Emerald
        type: "multi-line",
        data: DATES.map((date, i) => ({
            date,
            sim1: generateRandomSeries(90, 100, 3)[i],
            sim2: generateRandomSeries(90, 100, 3)[i],
            sim3: generateRandomSeries(90, 100, 3)[i],
            simMean: generateRandomSeries(90, 100, 1)[i],
        })),
        stats: [
            { label: "P95 Outcome", value: "$1.45M" },
            { label: "Mean Outcome", value: "$1.20M" },
            { label: "P5 Outcome", value: "$0.85M" },
        ]
    },
    "drawdown": {
        title: "Max Drawdown Analysis",
        description: "Visualizes the decline from a historical peak. Helps understand the depth and duration of losses.",
        color: "#F43F5E", // Rose
        type: "area-negative",
        data: DATES.map((date, i) => ({
            date,
            value: generateDrawdownSeries(90)[i]
        })),
        stats: [
            { label: "Max Drawdown", value: "-18.4%" },
            { label: "Current Depth", value: "-4.2%" },
            { label: "Recovery Time", value: "42 Days" },
        ]
    },
    "volatility": {
        title: "Rolling Volatility (30D)",
        description: "Measures the standard deviation of returns over a rolling 30-day window. Higher values indicate higher risk.",
        color: "#F59E0B", // Amber
        type: "line",
        data: DATES.map((date, i) => ({
            date,
            value: 10 + Math.random() * 15
        })),
        stats: [
            { label: "Current Vol", value: "14.2%" },
            { label: "Avg Vol (1Y)", value: "18.5%" },
            { label: "Vol Spike", value: "Nov 12" },
        ]
    },
    "risk": { // VaR
        title: "Value at Risk (VaR)",
        description: "The maximum expected loss over a specific time horizon at a given confidence level (95%).",
        color: "#F43F5E",
        type: "bar-distribution", // Mock distribution
        data: Array.from({ length: 20 }, (_, i) => ({
            range: `${(i - 10)}%`,
            frequency: Math.exp(-Math.pow(i - 10, 2) / 8) * 100 // Bell curveish
        })),
        stats: [
            { label: "VaR (95%)", value: "-$420" },
            { label: "VaR (99%)", value: "-$650" },
            { label: "CVaR (Expected Shortfall)", value: "-$510" },
        ]
    },
    "sharpe": {
        title: "Sharpe Ratio Trend",
        description: "Risk-adjusted return relative to the risk-free rate. A ratio > 1.0 is considered good.",
        color: "#10B981",
        type: "line",
        data: DATES.map((date, i) => ({
            date,
            value: 1.5 + (Math.random() - 0.5)
        })),
        stats: [
            { label: "Current Ratio", value: "1.85" },
            { label: "1Y High", value: "2.40" },
            { label: "Risk-Free Rate", value: "4.2%" },
        ]
    },
    "sortino": {
        title: "Sortino Ratio Trend",
        description: "Similar to Sharpe, but only penalizes downside volatility. Better for strategies with upside skew.",
        color: "#10B981",
        type: "line",
        data: DATES.map((date, i) => ({
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
        description: "Measures returns earned in excess of that which could have been earned on a riskless investment per each unit of market risk.",
        color: "#10B981",
        type: "line",
        data: DATES.map((date, i) => ({
            date,
            value: 12 + Math.random() * 2
        })),
        stats: [
            { label: "Current", value: "12.5" },
            { label: "Beta", value: "0.92" },
            { label: "Excess Return", value: "11.5%" },
        ]
    },
    "beta": {
        title: "Beta vs Benchmark (SPY)",
        description: "Measures the volatility of an asset or portfolio in relation to the overall market.",
        color: "#3B82F6", // Blue
        type: "scatter",
        data: generateScatterData(100),
        stats: [
            { label: "Beta", value: "0.92" },
            { label: "Alpha", value: "+2.4%" },
            { label: "Correlation", value: "0.85" },
        ]
    },
    "r-squared": {
        title: "R-Squared Analysis",
        description: "Represents the percentage of a fund or security's movements that can be explained by movements in a benchmark index.",
        color: "#3B82F6",
        type: "bar-simple", // Just a visual bar
        data: [{ name: "Explained", value: 85 }, { name: "Unexplained", value: 15 }],
        stats: [
            { label: "R-Squared", value: "85%" },
            { label: "Benchmark", value: "SPY" },
            { label: "Tracking Error", value: "3.2%" },
        ]
    },
    "correlations": {
        title: "Correlation Matrix",
        description: "Shows how assets in the portfolio move in relation to each other. Lower correlation means better diversification.",
        color: "#3B82F6",
        type: "heatmap", // Custom render
        data: null, // Custom
        stats: [
            { label: "Avg Correlation", value: "0.45" },
            { label: "Highest Pair", value: "BTC-ETH (0.82)" },
            { label: "Lowest Pair", value: "USDT-AAPL (0.02)" },
        ]
    }
};

export function MetricDetails({ slug }: MetricDetailsProps) {
    const config = METRIC_CONFIG[slug] || {
        title: "Metric Analysis",
        description: "Detailed breakdown not yet available for this metric.",
        color: "#52525B",
        type: "placeholder"
    };

    const renderChart = () => {
        switch (config.type) {
            case 'multi-line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={config.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                            <XAxis dataKey="date" stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis stroke="#52525B" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                            <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }} itemStyle={{ color: '#E4E4E7' }} />
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
                            <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }} />
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
                            <Tooltip contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '8px' }} />
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
                    {config.stats.map((stat: any, i: number) => (
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
            <div className="p-4 rounded-lg bg-[#18181B] border border-[#27272A] flex gap-3 items-start">
                <Info className="w-5 h-5 text-[#52525B] mt-0.5 shrink-0" />
                <div className="text-sm text-[#71717A] leading-relaxed">
                    Tip: This analysis is currently demonstrating mock data for frontend validation. Once the portfolio backend is fully synchronized, these charts will reflect your live asset performance.
                </div>
            </div>
        </div>
    );
}
