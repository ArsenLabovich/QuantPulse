"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Activity,
    DollarSign,
    Plug,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Bot,
    Briefcase
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomTooltip } from "@/components/ui/CustomTooltip";
import { SyncWidget } from "./layout/SyncWidget";

interface TopBarProps {
    userEmail?: string;
    onLogout: () => void;
}

export function TopBar({ userEmail, onLogout }: TopBarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
        { href: "/dashboard/portfolio", icon: Briefcase, label: "Portfolio" },
        { href: "/dashboard/analytics", icon: Activity, label: "X-Ray" },
        { href: "/dashboard/ai", icon: Bot, label: "Assistant" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full bg-[#000000] border-b border-[#1F2123]">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Left: Logo */}
                    <div onClick={() => router.push("/dashboard")} className="flex items-center gap-3 group cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-[#3978FF] flex items-center justify-center shadow-[0_0_15px_rgba(57,120,255,0.3)] group-hover:shadow-[0_0_25px_rgba(57,120,255,0.5)] transition-all">
                            <div className="w-4 h-4 rounded-full bg-white/20" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-wide hidden md:block">QuantPulse</span>
                    </div>

                    {/* Center: Navigation Icons */}
                    <nav className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-3 p-1.5 rounded-full bg-[#101010] border border-[#1F2123]">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <CustomTooltip key={item.href} content={item.label} delay={100}>
                                        <div
                                            onClick={() => router.push(item.href)}
                                            className={`
                                                p-3 rounded-full transition-all duration-300 relative group cursor-pointer
                                                ${isActive
                                                    ? 'text-[#3978FF] bg-[#1F2123]'
                                                    : 'text-[#909399] hover:text-white hover:bg-[#1F2123]/50'
                                                }
                                            `}
                                        >
                                            <item.icon className="w-5 h-5" />
                                            {isActive && (
                                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#3978FF]" />
                                            )}
                                        </div>
                                    </CustomTooltip>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Right: Actions */}
                    <div className="hidden md:flex items-center gap-5">
                        <div className="flex items-center gap-4">
                            <SyncWidget />
                            <CustomTooltip content="Integrations Hub" delay={100}>
                                <button
                                    onClick={() => router.push("/dashboard/integrations")}
                                    className="text-[#909399] hover:text-white transition-colors"
                                >
                                    <Plug className="w-5 h-5" />
                                </button>
                            </CustomTooltip>

                            {/* Profile & Logout */}
                            <div className="flex items-center gap-2 pl-4 border-l border-[#1F2123]">
                                <CustomTooltip content="Settings" delay={100}>
                                    <button
                                        className="w-9 h-9 rounded-full bg-[#1F2123] flex items-center justify-center text-[#909399] hover:bg-[#2A2E39] hover:text-white transition-all group"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                </CustomTooltip>

                                <CustomTooltip content="Sign Out" delay={100}>
                                    <button
                                        onClick={onLogout}
                                        className="w-9 h-9 rounded-full bg-[#1F2123] flex items-center justify-center text-[#909399] hover:bg-red-500/10 hover:text-red-400 transition-all"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </CustomTooltip>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-[#909399] hover:text-white"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden border-t border-[#1F2123] bg-[#000000] overflow-hidden"
                    >
                        <div className="px-2 pt-2 pb-3 space-y-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`
                                            flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium
                                            ${isActive
                                                ? 'bg-[#1F2123] text-[#3978FF]'
                                                : 'text-[#909399] hover:text-white hover:bg-[#1F2123]'
                                            }
                                        `}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <div className="border-t border-[#1F2123] my-2 pt-2">
                                <button
                                    onClick={() => {
                                        onLogout();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-[#909399] hover:text-red-400 hover:bg-red-500/10"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
