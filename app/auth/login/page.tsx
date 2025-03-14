"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Gamepad, User, KeyRound, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function LoginPage() {
  const { login, isLoading, error } = useAuth();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    
    try {
      await login(email, password, teamId);
      router.push("/live/points");
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-6 flex items-center gap-2">
        <Gamepad className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">LetLetMe</h1>
      </div>
      
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Log in to your account to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {(loginError || error) && (
            <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
              <AlertDescription>
                {loginError || error}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/reset-password"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="teamId">FPL Team ID</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="teamId"
                type="text"
                placeholder="Your Fantasy Premier League team ID"
                className="pl-10"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your FPL Team ID can be found in your team URL: https://fantasy.premierleague.com/entry/<strong>TEAM_ID</strong>/
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Log in"}
          </Button>
        </form>
        
        <div className="mt-6">
          <Separator className="my-4" />
          <div className="text-center text-sm">
            <p>Don't have an account?{" "}
              <Link href="/auth/register" className="text-primary hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}