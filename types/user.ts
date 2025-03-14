export interface User {
  id: string;
  name: string;
  email: string;
  teamId: string;
  teamName: string;
  provider: "github" | "twitter";
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (provider: "github" | "twitter") => Promise<void>;
  logout: () => void;
  switchAccount: (user: User) => void;
}