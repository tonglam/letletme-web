"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ChevronDown, Globe, LogOut, Menu, Settings, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { menuItems } from "./config";

interface MobileNavProps {
  openCollapsible: string | null;
  setOpenCollapsible: (value: string | null) => void;
  currentLang: string;
  setCurrentLang: (lang: string) => void;
  languages: { code: string; label: string }[];
}

export function MobileNav({
  openCollapsible,
  setOpenCollapsible,
  currentLang,
  setCurrentLang,
  languages,
}: MobileNavProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const user = session?.user;
  const initials = user ? (user.name ?? user.email).charAt(0).toUpperCase() : "";

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] flex flex-col">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2 mt-6 mb-4">
              {menuItems.map((item) => (
                <Collapsible
                  key={item.id}
                  open={openCollapsible === item.id}
                  onOpenChange={() =>
                    setOpenCollapsible(openCollapsible === item.id ? null : item.id)
                  }
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between" size="lg">
                      <div className="flex items-center">
                        <item.icon className="h-5 w-5 mr-2" />
                        {item.label}
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          openCollapsible === item.id ? "rotate-180" : ""
                        }`}
                      />
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
                open={openCollapsible === "language"}
                onOpenChange={() =>
                  setOpenCollapsible(openCollapsible === "language" ? null : "language")
                }
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" size="lg">
                    <div className="flex items-center">
                      <Globe className="h-5 w-5 mr-2" />
                      Language
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        openCollapsible === "language" ? "rotate-180" : ""
                      }`}
                    />
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
          </div>

          {/* Profile section pinned at bottom */}
          <div className="border-t pt-4">
            {user ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.name ?? user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/profile">
                    <Settings className="h-4 w-4 mr-2" />
                    Profile settings
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link href="/auth/login">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Login
                </Link>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
