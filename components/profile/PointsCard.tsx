"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signOut, useSession } from "@/lib/auth-client";
import { ArrowRight, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PointsCardProps {
  className?: string;
}

export function PointsCard({ className }: PointsCardProps) {
  const { data: session } = useSession();
  const router = useRouter();

  if (!session) {
    return (
      <Card className={className}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-bold">Sign in</h2>
              <p className="text-sm text-muted-foreground">
                Track your FPL team
              </p>
            </div>
          </div>
          <Link href="/auth/login">
            <Button className="w-full">Sign in</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const { user } = session;

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold">{user.name}</h2>
            {user.fplEntryId && (
              <p className="text-xs text-muted-foreground">
                FPL Entry #{user.fplEntryId}
              </p>
            )}
          </div>
          <Avatar>
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => router.push("/profile")}
          >
            <span>View Profile</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="destructive"
            className="w-full"
            onClick={async () => {
              await signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </Card>
  );
}
