"use client";

import { CosmosBackground } from "@/components/ui/CosmosBackground";
import { AuthTabs } from "@/components/AuthTabs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden px-4">
            <CosmosBackground />

            <div className="z-10 w-full max-w-md mb-6">
                <Link href="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Link>
            </div>

            <div className="z-10 w-full flex justify-center">
                <AuthTabs initialMode="register" />
            </div>
        </div>
    );
}
