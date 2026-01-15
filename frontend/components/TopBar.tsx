"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Activity,
    DollarSign,
    Plug,
    Users,
    Settings,
    LogOut,
    Menu,
    X
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TopBarProps {
    userEmail?: string;
    onLogout: () => void;
}

export function TopBar({ userEmail, onLogout }: TopBarProps) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
        { href: "/dashboard/analytics", icon: Activity, label: "Analytics" },
        { href: "/dashboard/trading", icon: DollarSign, label: "Trading" },
        { href: "/dashboard/integrations", icon: Plug, label: "Integrations" },
        { href: "/dashboard/community", icon: Users, label: "Community" },
        { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full bg-[#131722] border-b border-[#2A2E39]">
            <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-8">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3978FF] to-indigo-600" />
                            <span className="text-xl font-bold text-white tracking-tight hidden md:block">QuantPulse</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`
                                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                            ${isActive
                                                ? 'bg-[#1E222D] text-[#3978FF]'
                                                : 'text-[#B2B5BE] hover:text-white hover:bg-[#1E222D]/50'
                                            }
                                        `}
                                    >
                                        <item.icon className={`w-4 h-4 ${isActive ? 'text-[#3978FF]' : 'text-[#B2B5BE]'}`} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right Section: Profile & Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1E222D] rounded-full border border-[#2A2E39]">
                            <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse" />
                            <span className="text-xs font-medium text-[#00C9A7]">Market Open</span>
                        </div>

                        <div className="h-6 w-px bg-[#2A2E39]" />

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-[#B2B5BE]">{userEmail}</span>
                            <button
                                onClick={onLogout}
                                className="p-2 rounded-lg text-[#B2B5BE] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Sign Out"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2 text-[#B2B5BE] hover:text-white"
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
                        className="md:hidden border-t border-[#2A2E39] bg-[#131722] overflow-hidden"
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
                                                ? 'bg-[#1E222D] text-[#3978FF]'
                                                : 'text-[#B2B5BE] hover:text-white hover:bg-[#1E222D]'
                                            }
                                        `}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <div className="border-t border-[#2A2E39] my-2 pt-2">
                                <button
                                    onClick={() => {
                                        onLogout();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-[#B2B5BE] hover:text-red-400 hover:bg-red-500/10"
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
