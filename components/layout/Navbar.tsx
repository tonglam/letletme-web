"use client";

import { Gamepad } from "lucide-react";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const languages = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" }
];

export function Navbar() {
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState("en");

  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="mx-auto w-full px-4 sm:container sm:px-4 lg:px-8 sm:max-w-4xl py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Gamepad className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">LetLetMe</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <DesktopNav
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
            languages={languages}
          />
          
          <ThemeToggle />
          
          <MobileNav
            openCollapsible={openCollapsible}
            setOpenCollapsible={setOpenCollapsible}
            currentLang={currentLang}
            setCurrentLang={setCurrentLang}
            languages={languages}
          />
        </div>
      </div>
    </nav>
  );
}