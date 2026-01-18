"use client";

// Patch console methods immediately when module is loaded
if (typeof window !== "undefined") {
    const defaultError = console.error;
    const defaultWarn = console.warn;

    console.error = (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        if (
            msg.includes("bis_skin_checked") ||
            msg.includes("benign-error") ||
            msg.includes("Hydration failed") ||
            msg.includes("hydration") ||
            msg.includes("Minified React error #418") ||
            msg.includes("Minified React error #423") ||
            msg.includes("react-hydration-error")
        ) {
            return;
        }
        defaultError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        const msg = args.map(arg => String(arg)).join(' ');
        if (msg.includes("bis_skin_checked") || msg.includes("hydration")) {
            return;
        }
        defaultWarn.apply(console, args);
    };
}

export function HydrationErrorSuppressor() {
    return null;
}
