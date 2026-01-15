"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { motion } from "framer-motion";
import { Activity, CreditCard, DollarSign, Users } from "lucide-react";

interface User {
    id: number;
    email: string;
    is_active: boolean;
}

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await api.get("/users/me");
                setUser(response.data);
            } catch (error) {
                console.error("Failed to fetch user", error);
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        router.push("/login");
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-[#131722] text-[#B2B5BE] font-sans">Initialize Terminal...</div>;
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#131722] font-sans text-[#B2B5BE]" suppressHydrationWarning>
            <TopBar userEmail={user.email} onLogout={handleLogout} />

            <main className="max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-8">
                    {/* Welcome Section */}
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                            <p className="mt-1 text-[#B2B5BE]">Market Overview & Portfolio Performance</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Balance"
                            value="$24,500.00"
                            change="+12.5%"
                            icon={<DollarSign className="text-[#3978FF]" />}
                            active
                        />
                        <StatCard
                            title="Active Positions"
                            value="8"
                            change="+2"
                            icon={<Activity className="text-[#00C9A7]" />}
                        />
                        <StatCard
                            title="Win Rate"
                            value="68%"
                            change="-1.2%"
                            icon={<Users className="text-purple-400" />}
                        />
                        <StatCard
                            title="Monthly PnL"
                            value="+$3,240"
                            change="+8.1%"
                            icon={<CreditCard className="text-[#00C9A7]" />}
                        />
                    </div>

                    {/* Main Content Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Chart Area */}
                        <div className="lg:col-span-2 rounded-2xl bg-[#1E222D] border border-[#2A2E39] h-[500px] flex flex-col items-center justify-center p-8 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
                            <Activity className="w-16 h-16 mb-4 text-[#2A2E39] group-hover:text-[#3978FF]/50 transition-colors duration-500" />
                            <p className="text-lg font-medium text-[#B2B5BE]">Trading Chart Placeholder</p>
                            <p className="text-sm text-[#2A2E39] mt-2 group-hover:text-[#3978FF]/30 transition-colors">Integrate TradingView Chart Here</p>
                        </div>

                        {/* Recent Activity */}
                        <div className="flex flex-col gap-6">
                            <div className="rounded-2xl bg-[#1E222D] border border-[#2A2E39] p-6 flex-1">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                                    <button className="text-xs font-medium text-[#3978FF] hover:text-white transition-colors">View All</button>
                                </div>
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#131722] border border-[#2A2E39] hover:border-[#3978FF]/30 transition-colors cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#2A2E39] flex items-center justify-center group-hover:bg-[#3978FF]/20 transition-colors">
                                                    <span className="text-xs caret-blue-500 font-bold text-white">BTC</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">Buy Bitcoin</p>
                                                    <p className="text-xs text-[#B2B5BE] mt-0.5">2 mins ago</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium text-[#00C9A7]">+$120.50</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, change, icon, active = false }: { title: string, value: string, change: string, icon: React.ReactNode, active?: boolean }) {
    const isPositive = change.startsWith('+');
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={`
                p-6 rounded-2xl border transition-all duration-300
                ${active
                    ? 'bg-gradient-to-br from-[#1E222D] to-[#1E222D]/50 border-[#3978FF]/50 shadow-lg shadow-[#3978FF]/10'
                    : 'bg-[#1E222D] border-[#2A2E39] hover:border-[#3978FF]/30'
                }
            `}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 rounded-xl bg-[#131722] border border-[#2A2E39]">
                    {icon}
                </div>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isPositive ? 'text-[#00C9A7] bg-[#00C9A7]/10' : 'text-red-400 bg-red-400/10'}`}>
                    {change}
                </span>
            </div>
            <h3 className="text-[#B2B5BE] text-sm font-medium">{title}</h3>
            <p className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</p>
        </motion.div>
    )
}
