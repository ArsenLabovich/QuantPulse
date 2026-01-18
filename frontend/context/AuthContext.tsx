"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

interface User {
    id: number;
    email: string;
    is_active: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string, refreshToken: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem("token");

            if (!token) {
                setLoading(false);
                if (pathname !== "/login" && pathname !== "/" && !pathname.startsWith("/register")) {
                    router.push("/login");
                }
                return;
            }

            // Quick check: If we have a token and are on a public page, redirect immediately (optimistic)
            // But we still need to verify it.
            if (pathname === "/login" || pathname === "/" || pathname.startsWith("/register")) {
                router.push("/dashboard");
            }

            try {
                // Verify token by fetching user profile
                const response = await api.get("/users/me");
                setUser(response.data);

                // Double check redirect after verification (in case optimistic failed or was skipped)
                if (
                    typeof window !== 'undefined' &&
                    (window.location.pathname === "/login" || window.location.pathname === "/" || window.location.pathname.startsWith("/register"))
                ) {
                    router.push("/dashboard");
                }

            } catch (error) {
                console.error("Auth initialization failed:", error);
                logout();
            } finally {
                setLoading(false);
            }
        };

        if (typeof window !== 'undefined') {
            initAuth();
        }
    }, [pathname]);

    const login = (token: string, refreshToken: string) => {
        localStorage.setItem("token", token);
        localStorage.setItem("refreshToken", refreshToken);
        // We can optionally set user here immediately if we have the data, 
        // or let the effect handle it. A fetch is safer to ensure valid token.
        // For speed, let's assume valid if we just got it.
        // But better to fetch or decode. For now, let's trigger a reload or push.
        router.push("/dashboard");
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
