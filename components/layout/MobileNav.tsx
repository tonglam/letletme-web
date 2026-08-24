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
import { getVerifiedFplEntryId } from "@/lib/fpl-binding-core";
import { useHydrated } from "@/hooks/use-hydrated";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Menu, Settings, Shirt, UserCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
      const { error } = await signOut();
      if (error) {
        toast.error(t("signOutFailed"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      toast.error(t("signOutFailed"));
    } finally {
      setSigningOut(false);
    }
  };

  const initials = user ? (user.name ?? user.email).charAt(0).toUpperCase() : "";
  const verifiedEntryId = user ? getVerifiedFplEntryId(user) : null;
  const accountName = user?.name?.trim() || "";
  const fplTeamName = user?.fplTeamName?.trim() || "";
  const fplManagerName = user?.fplManagerName?.trim() || "";

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
              {menuItems.map((item) =>
                item.directHref ? (
                  <SheetClose key={item.id} asChild>
                    <Button variant="ghost" className="w-full justify-start" size="lg" asChild>
                      <Link href={item.directHref} prefetch={false}>
                        <item.icon data-icon="inline-start" />
                        {t(item.labelKey)}
                      </Link>
                    </Button>
                  </SheetClose>
                ) : (
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
                          className={cn("transition-transform", openCollapsible === item.id ? "rotate-180" : "")}
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="flex flex-col gap-2 px-4 py-2">
                      {item.items.map((subItem) => (
                        <SheetClose key={subItem.labelKey} asChild>
                          <Button variant="ghost" className="w-full justify-start text-sm" asChild>
                            <Link href={subItem.href} prefetch={false}>{t(subItem.labelKey)}</Link>
                          </Button>
                        </SheetClose>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ),
              )}
            </div>
          </div>

          {/* Profile section pinned at bottom */}
          <div className="border-t pt-4">
            {user ? (
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.image ?? undefined} alt={accountName} />
                      <AvatarFallback className="bg-primary/10 text-primary-ink text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {accountName || user.email}
                      </p>
                      {accountName ? (
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 eyebrow">
                      <Shirt aria-hidden="true" className="size-3" />
                      {t("fplTeamLabel")}
                    </p>
                    <span
                      className={cn(
                        "rounded-sm px-1.5 py-0.5 font-mono text-label font-semibold uppercase tracking-wide",
                        verifiedEntryId !== null
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {verifiedEntryId !== null ? t("fplLinked") : t("fplNotLinked")}
                    </span>
                  </div>
                  {verifiedEntryId !== null ? (
                    <div>
                      <p className="truncate font-display text-sm font-bold uppercase tracking-wide">
                        {fplTeamName || t("fplTeamUntitled")}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {fplManagerName
                          ? `${t("fplManagerLabel")}: ${fplManagerName}`
                          : t("fplManagerLabel")}
                        {" · "}
                        <span className="font-mono">#{verifiedEntryId}</span>
                      </p>
                    </div>
                  ) : (
                    <SheetClose asChild>
                      <Link
                        href="/onboarding/bind-entry"
                        className="text-xs font-semibold text-primary-ink underline-offset-4 hover:underline"
                      >
                        {t("linkFplTeam")}
                      </Link>
                    </SheetClose>
                  )}
                </div>

                <div className="flex flex-col gap-1">
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
              </div>
            ) : (
              <div className="flex flex-col gap-1">
              <SheetClose asChild>
                <Button variant="ghost" className="w-full justify-start" asChild>
                  <Link href="/auth/login" prefetch={false}>
                    <UserCircle data-icon="inline-start" />
                    {t("login")}
                  </Link>
                </Button>
              </SheetClose>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
