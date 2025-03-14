"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { User, Calendar, Hash, Mail, Trophy, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <p className="text-lg text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </RootLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null; // Will redirect in the useEffect
  }

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="md:col-span-1 p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : (
                  <AvatarFallback className="text-2xl">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>
              
              <h2 className="text-xl font-bold mb-1">{user.name}</h2>
              <p className="text-muted-foreground mb-4">{user.email}</p>
              
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span>Member since 2023</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span>Active in 3 tournaments</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Last login: Today</span>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <Button 
                variant="outline" 
                className="w-full mb-2"
                onClick={() => router.push("/profile/edit")}
              >
                Edit Profile
              </Button>
              
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                Log Out
              </Button>
            </div>
          </Card>
          
          {/* Team Info */}
          <Card className="md:col-span-2 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Team Information
            </h2>
            
            <div className="space-y-4">
              <div className="bg-accent/30 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Current Team</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold">{user.teamName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Hash className="h-4 w-4" />
                      <span>Team ID: {user.teamId}</span>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Active
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <h3 className="font-medium mb-2">Overall Rank</h3>
                  <p className="text-2xl font-bold">135,782</p>
                </div>
                
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <h3 className="font-medium mb-2">Total Points</h3>
                  <p className="text-2xl font-bold">1,788</p>
                </div>
              </div>
              
              <h3 className="font-medium mt-4 mb-2">Recent Activity</h3>
              <div className="space-y-2">
                <div className="bg-accent/20 p-3 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Joined "Premier League Fan Cup"</span>
                  </div>
                  <span className="text-sm text-muted-foreground">2 days ago</span>
                </div>
                
                <div className="bg-accent/20 p-3 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span>Ranked 3rd in "Mini-League Challenge"</span>
                  </div>
                  <span className="text-sm text-muted-foreground">1 week ago</span>
                </div>
                
                <div className="bg-accent/20 p-3 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Created "Work Colleagues Cup"</span>
                  </div>
                  <span className="text-sm text-muted-foreground">2 weeks ago</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </RootLayout>
  );
}