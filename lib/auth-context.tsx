"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, AuthState } from "@/types/user";

interface AuthContextType extends AuthState {
  login: (email: string, password: string, teamId: string) => Promise<void>;
  logout: () => void;
  switchAccount: (user: User) => void;
}

// Mock users for demo
const mockUsers: User[] = [
  {
    id: "1",
    name: "Gunners Fan",
    email: "gunners@example.com",
    teamId: "12345",
    teamName: "Arsenal Guangzhou FC",
    provider: "github",
    avatar: "/avatars/gunners.jpg"
  },
  {
    id: "2",
    name: "Tong",
    email: "tong@example.com",
    teamId: "67890",
    teamName: "杀猪会 tong牛合屋之人",
    provider: "twitter",
    avatar: "/avatars/tong.jpg"
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  const login = async (provider: "github" | "twitter") => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would handle OAuth flow
      const user = mockUsers.find(u => u.provider === provider);
      
      if (!user) {
        throw new Error("Authentication failed");
      }
      
      // Save to localStorage
      localStorage.setItem("user", JSON.stringify(user));
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      }));
      throw error;
    }
  };

  // Check for saved auth on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error("Failed to parse saved user", error);
        localStorage.removeItem("user");
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    } else {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("user");
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    });
  };

  const switchAccount = (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}