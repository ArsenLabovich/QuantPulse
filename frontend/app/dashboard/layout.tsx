"use client";

import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/context/AuthContext";
import { RefreshProvider } from "@/context/RefreshContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, logout } = useAuth();

    // If loading, show a minimal loading state consistent with the dashboard
    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-[#131722] text-[#B2B5BE] font-sans">Initialize Terminal...</div>;
    }

    // AuthContext handles redirect if not logged in, but we can return null here to avoid flicker
    if (!user) return null;

    return (
        <RefreshProvider>
            <div className="min-h-screen bg-[#000000] font-sans text-[#909399]">
                <TopBar userEmail={user.email} onLogout={logout} />
                <main className="max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
                    {children}
                </main>
            </div>
        </RefreshProvider>
    );
}
