import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { HydrationErrorSuppressor } from "@/components/HydrationErrorSuppressor";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-[#131722] text-white antialiased selection:bg-blue-500/30 select-none`} suppressHydrationWarning>
        <HydrationErrorSuppressor />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
