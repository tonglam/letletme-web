"use client";

import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowRight, LogOut, User, Github, Twitter } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface PointsCardProps {
  className?: string;
}

export function PointsCard({ className }: PointsCardProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  if (!isAuthenticated || !user) {
    return (
      <Card className={className}>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-bold">Sign in with</h2>
              <p className="text-sm text-muted-foreground">Choose your preferred login method</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => console.log("GitHub login")}>
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
            
            <Button variant="outline" className="w-full" onClick={() => console.log("Twitter login")}>
              <Twitter className="mr-2 h-4 w-4" />
              Continue with Twitter
            </Button>
          </div>
          
          <div className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold flex items-center gap-1">
              {user.teamName}
              <span className="text-primary text-sm">via {user.provider}</span>
            </h2>
          </div>
          <Avatar>
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Overall points</span>
            <span className="font-semibold">1,213</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Overall rank</span>
            <span className="font-semibold">1,318,804</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Total players</span>
            <span className="font-semibold">11,132,644</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Gameweek points</span>
            <span className="font-semibold">54</span>
          </div>
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
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </Card>
  );
}