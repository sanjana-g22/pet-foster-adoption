import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pawfect Match | Find Your Best Friend",
    template: "%s | Pawfect Match",
  },
  description:
    "Find a loving companion and help pets find their forever homes with Pawfect Match.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Navbar />

        <div className="flex-1">{children}</div>

        <footer className="mt-16 border-t border-[#e4e4d9] bg-white print:hidden">
          <div className="page-shell flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-[#245c45]">🐾 Pawfect Match</p>
              <p className="mt-1 text-sm text-[#69756c]">
                Every pet deserves a loving home.
              </p>
            </div>

            <p className="text-sm text-[#69756c]">
              Made with care for pets and the people who love them.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}