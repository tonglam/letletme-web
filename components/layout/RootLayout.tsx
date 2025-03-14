"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BackToTop } from "@/components/layout/BackToTop";

interface RootLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function RootLayout({ children, className = "" }: RootLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className={`flex-grow w-full ${className}`}>
        {children}
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}