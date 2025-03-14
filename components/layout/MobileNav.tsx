"use client";

import { Button } from "@/components/ui/button";
import { Menu, Globe, ChevronDown } from "lucide-react";
import { PointsCard } from "@/components/profile/PointsCard";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { menuItems } from "./config";

interface MobileNavProps {
  openCollapsible: string | null;
  setOpenCollapsible: (value: string | null) => void;
  currentLang: string;
  setCurrentLang: (lang: string) => void;
  languages: { code: string; label: string; }[];
}

export function MobileNav({ 
  openCollapsible, 
  setOpenCollapsible, 
  currentLang, 
  setCurrentLang, 
  languages 
}: MobileNavProps) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 mt-6">
            <div className="space-y-2 mb-4">
              {menuItems.map((item) => (
                <Collapsible
                  key={item.id}
                  open={openCollapsible === item.id}
                  onOpenChange={() => setOpenCollapsible(openCollapsible === item.id ? null : item.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between" size="lg">
                      <div className="flex items-center">
                        <item.icon className="h-5 w-5 mr-2" />
                        {item.label}
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openCollapsible === item.id ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 py-2 space-y-2">
                    {item.items.map((subItem) => (
                      <Button
                        key={subItem.label}
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        asChild={!!subItem.href}
                      >
                        {subItem.href ? (
                          <Link href={subItem.href}>{subItem.label}</Link>
                        ) : (
                          subItem.label
                        )}
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              <Collapsible
                open={openCollapsible === 'language'}
                onOpenChange={() => setOpenCollapsible(openCollapsible === 'language' ? null : 'language')}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" size="lg">
                    <div className="flex items-center">
                      <Globe className="h-5 w-5 mr-2" />
                      Language
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openCollapsible === 'language' ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 py-2 space-y-2">
                  {languages.map((lang) => (
                    <Button
                      key={lang.code}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-sm",
                        currentLang === lang.code && "bg-accent"
                      )}
                      onClick={() => setCurrentLang(lang.code)}
                    >
                      {lang.label}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
            <div className="border-t pt-4 px-0">
              <PointsCard />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}