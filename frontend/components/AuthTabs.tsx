"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "register";

function PasswordStrengthMeter({ password, isRegister }: { password: string, isRegister: boolean }) {
    if (!isRegister || !password) return null;

    const getStrength = (pass: string) => {
        if (!pass) return 0;

        // Criteria checks
        const hasLower = /[a-z]/.test(pass);
        const hasUpper = /[A-Z]/.test(pass);
        const hasNumber = /[0-9]/.test(pass);
        const hasSpecial = /[^A-Za-z0-9]/.test(pass);
        const isLong = pass.length >= 8;

        // Mandatory Requirements Check
        // If basic requirements aren't met, it's automatically Weak (0)
        if (!hasLower || !hasUpper || !hasNumber || !isLong) {
            return 0;
        }

        // If mandatory requirements ARE met, start scoring
        let score = 1; // Start at Fair/Orange because it's valid

        // Bonus points
        if (pass.length >= 12) score += 1;
        if (hasSpecial) score += 1;
        if (hasLower && hasUpper && hasNumber && hasSpecial && pass.length >= 12) score += 1;

        return Math.min(score, 4);
    };

    const strength = getStrength(password);
    const bars = [1, 2, 3, 4];

    // 0 = Weak (Red), 1 = Fair (Orange), 2 = Good (Yellow), 3 = Strong (Green), 4 = Very Strong (Emerald)
    const colors = [
        "bg-red-500",
        "bg-orange-500",
        "bg-yellow-500",
        "bg-green-500",
        "bg-[#00C9A7]"
    ];

    const labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];

    return (
        <div className="space-y-1">
            <div className="flex gap-1 h-1.5">
                {bars.map((bar) => (
                    <div
                        key={bar}
                        className={cn(
                            "h-full flex-1 rounded-full transition-all duration-300",
                            // Only show colored bars up to the current strength
                            // If strength is 0 (Weak), show 1st bar red. 
                            bar <= strength + 1 ? colors[strength] : "bg-[#2A2E39]"
                        )}
                    />
                ))}
            </div>
            <p className={cn("text-xs text-right font-medium transition-colors duration-300", strength > 0 ? "text-[#B2B5BE]" : "text-red-400")}>
                {labels[strength] || "Weak"}
            </p>
        </div>
    );
}

export function AuthTabs({ initialMode = "login" }: { initialMode?: AuthMode }) {
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    const router = useRouter();
    const { login } = useAuth();

    // Real-time validation
    useEffect(() => {
        if (mode === "register" && password) {
            const hasLower = /[a-z]/.test(password);
            const hasUpper = /[A-Z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const isLong = password.length >= 8;

            if (!hasLower || !hasUpper || !hasNumber || !isLong) {
                setPasswordError("Password must contain at least 8 characters, 1 uppercase, 1 lowercase letter and 1 number");
            } else {
                setPasswordError("");
            }
        } else {
            setPasswordError("");
        }
    }, [password, mode]);

    // Email validation helper
    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const isFormValid = () => {
        if (mode === "login") {
            return email && password;
        }
        // Register mode
        return (
            isValidEmail(email) &&
            !passwordError &&
            password &&
            password === confirmPassword &&
            confirmPassword
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const formEmail = formData.get("email") as string || email;
        const formPassword = formData.get("password") as string || password;
        const formConfirmPassword = formData.get("confirmPassword") as string || confirmPassword;

        if (mode === "register") {
            if (!isValidEmail(formEmail)) {
                setError("Please enter a valid email address");
                return;
            }
            if (formPassword !== formConfirmPassword) {
                setError("Passwords do not match");
                return;
            }
            if (passwordError) return;
        } else {
            // Login mode validation
            if (!formEmail || !formPassword) {
                setError("Please enter both email and password");
                return;
            }
        }

        // Clear any existing tokens before attempting new login
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");

        setLoading(true);

        try {
            if (mode === "register") {
                const response = await api.post("/auth/register", { email: formEmail, password: formPassword });

                // Auto-login logic
                login(response.data.access_token, response.data.refresh_token);
            } else {
                const submitData = new URLSearchParams();
                submitData.append("username", formEmail);
                submitData.append("password", formPassword);

                const response = await api.post("/auth/token", submitData, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });

                login(response.data.access_token, response.data.refresh_token);
            }
        } catch (err: any) {
            let errorMessage = "An unexpected error occurred";
            if (err.response) {
                const detail = err.response.data?.detail;
                if (typeof detail === "string") {
                    errorMessage = detail;
                } else if (Array.isArray(detail)) {
                    errorMessage = detail.map((e: any) => e.msg).join(", ");
                } else if (detail && typeof detail === "object") {
                    errorMessage = JSON.stringify(detail);
                } else if (mode === "login") {
                    errorMessage = "Invalid email or password";
                } else {
                    errorMessage = "Registration failed. Please try again.";
                }
            } else if (err.request) {
                errorMessage = "Network error. Please check your connection.";
            } else {
                errorMessage = err.message || "Something went wrong.";
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md" suppressHydrationWarning>
            {/* Tabs */}
            <div className="flex p-1 mb-8 bg-[#1E222D]/50 rounded-xl border border-[#2A2E39] backdrop-blur-sm">
                <button
                    onClick={() => { setMode("login"); setError(""); setPasswordError(""); }}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300",
                        mode === "login"
                            ? "bg-[#1E222D] text-white shadow-lg"
                            : "text-[#B2B5BE] hover:text-white"
                    )}
                >
                    Login
                </button>
                <button
                    onClick={() => { setMode("register"); setError(""); setPasswordError(""); }}
                    className={cn(
                        "flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300",
                        mode === "register"
                            ? "bg-[#1E222D] text-white shadow-lg"
                            : "text-[#B2B5BE] hover:text-white"
                    )}
                >
                    Sign Up
                </button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full p-8 rounded-2xl bg-[#1E222D]/40 backdrop-blur-xl border border-[#2A2E39] shadow-2xl"
                >
                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {mode === "login" ? "Welcome Back" : "Create Account"}
                        </h1>
                        <p className="text-[#B2B5BE] text-sm">
                            {mode === "login" ? "Enter your credentials to access the terminal." : "Join the algorithmic trading revolution."}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-[#B2B5BE] uppercase tracking-wider">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                className={cn(
                                    "w-full p-3 rounded-lg bg-[#131722]/50 border text-white placeholder:text-[#B2B5BE]/50 focus:outline-none focus:ring-2 focus:ring-[#3978FF]/50 focus:border-transparent transition-all",
                                    mode === "register" && email && !isValidEmail(email) ? "border-red-500/50 focus:ring-red-500/50" : "border-[#2A2E39]"
                                )}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            {mode === "register" && email && !isValidEmail(email) && (
                                <p className="text-[11px] text-red-400 mt-1 font-medium">Invalid email address</p>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-xs font-medium text-[#B2B5BE] uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className={cn(
                                        "w-full p-3 pr-10 rounded-lg bg-[#131722]/50 border text-white placeholder:text-[#B2B5BE]/50 focus:outline-none focus:ring-2 focus:ring-[#3978FF]/50 focus:border-transparent transition-all",
                                        passwordError ? "border-red-500/50 focus:ring-red-500/50" : "border-[#2A2E39]"
                                    )}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B2B5BE] hover:text-white transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {mode === "register" && passwordError && (
                                <p className="text-[11px] text-red-400 mt-1 font-medium">{passwordError}</p>
                            )}
                            {mode === "login" && (
                                <div className="flex justify-end mt-1">
                                    <a href="#" className="text-xs text-[#3978FF] hover:text-[#3978FF]/80 transition-colors">Forgot Password?</a>
                                </div>
                            )}
                        </div>

                        <PasswordStrengthMeter password={password} isRegister={mode === "register"} />

                        {mode === "register" && (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[#B2B5BE] uppercase tracking-wider">Confirm Password</label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    className={cn(
                                        "w-full p-3 pr-10 rounded-lg bg-[#131722]/50 border text-white placeholder:text-[#B2B5BE]/50 focus:outline-none focus:ring-2 focus:ring-[#3978FF]/50 focus:border-transparent transition-all",
                                        confirmPassword && password !== confirmPassword ? "border-red-500/50 focus:ring-red-500/50" : "border-[#2A2E39]"
                                    )}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="text-[11px] text-red-400 mt-1 font-medium">Passwords do not match</p>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || (mode === "register" && !isFormValid())}
                            className="mt-2 w-full p-3 bg-gradient-to-r from-[#3978FF] to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-lg shadow-[#3978FF]/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === "login" ? "Access Terminal" : "Register Account")}
                        </button>
                    </form>
                </motion.div>
            </AnimatePresence>
        </div >
    );
}
