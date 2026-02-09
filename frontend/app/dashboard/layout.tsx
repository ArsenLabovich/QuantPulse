"use client";

import { TopBar } from "@/components/TopBar";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { RefreshProvider } from "@/context/RefreshContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout } = useAuth();
    const pathname = usePathname();
    const isPortfolio = pathname?.endsWith("/portfolio");

    // If loading, show a minimal loading state consistent with the dashboard
    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-[#131722] text-[#B2B5BE] font-sans">Initialize Terminal...</div>;
    }

    // AuthContext handles redirect if not logged in, but we can return null here to avoid flicker
    if (!user) return null;

    return (
        <RefreshProvider>
            <div className="h-screen flex flex-col overflow-hidden bg-[#000000] font-sans text-[#909399]">
                <TopBar userEmail={user.email} onLogout={logout} />
                <main className={`flex-1 min-h-0 relative w-full ${isPortfolio ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
                    {isPortfolio ? (
                        children
                    ) : (
                        <div className="p-6">
                            {children}
                        </div>
                    )}
                </main>
            </div>
        </RefreshProvider>
    );
}
