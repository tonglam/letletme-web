"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { NavigationUser } from "@/components/profile/HeaderProfileCard";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { useHydrated } from "@/hooks/use-hydrated";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Menu, Settings, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { menuItems } from "./config";

export function MobileNav({ user }: { user: NavigationUser | null }) {
  const router = useRouter();
  const t = useTranslations("Navigation");
  const hydrated = useHydrated();
  const [signingOut, setSigningOut] = useState(false);
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);

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

  const initials = user ? (user.name ?? user.email).charAt(0).toUpperCase() : "";

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={!hydrated}
            aria-busy={!hydrated}
          >
            <Menu aria-hidden="true" />
            <span className="sr-only">{t("openMenu")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mt-6 mb-4 flex flex-col gap-2">
              {menuItems.map((item) => (
                <Collapsible
                  key={item.id}
                  open={openCollapsible === item.id}
                  onOpenChange={(open) => setOpenCollapsible(open ? item.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between" size="lg">
						<div className="flex items-center gap-2">
                        <item.icon data-icon="inline-start" />
                        {t(item.labelKey)}
                      </div>
                      <ChevronDown
						className={cn("transition-transform",
                          openCollapsible === item.id ? "rotate-180" : ""
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-2 px-4 py-2">
                    {item.items.map((subItem) => (
                      <SheetClose key={subItem.labelKey} asChild>
                        <Button variant="ghost" className="w-full justify-start text-sm" asChild>
                          <Link href={subItem.href}>{t(subItem.labelKey)}</Link>
                        </Button>
                      </SheetClose>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>

          {/* Profile section pinned at bottom */}
          <div className="border-t pt-4">
            {user ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary-ink text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.name ?? user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button variant="ghost" className="w-full justify-start" asChild>
                    <Link href="/profile">
                      <Settings data-icon="inline-start" />
                      {t("profileSettings")}
                    </Link>
                  </Button>
                </SheetClose>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  <LogOut data-icon="inline-start" />
                  {signingOut ? t("signingOut") : t("signOut")}
                </Button>
              </div>
            ) : (
              <SheetClose asChild>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/auth/login">
                    <UserCircle data-icon="inline-start" />
                    {t("login")}
                  </Link>
                </Button>
              </SheetClose>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
