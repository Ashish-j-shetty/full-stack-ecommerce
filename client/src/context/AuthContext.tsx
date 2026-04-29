import {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
  useContext,
} from "react";
import { apiClient } from "../api/client";

interface User {
  id: number;
  username: string;
  email: string;
  role: "customer" | "admin";
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; user: User }
  | { type: "AUTH_FAILURE" }
  | { type: "LOGOUT" };

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_START":
      return { ...state, isLoading: true };
    case "AUTH_SUCCESS":
      return {
        user: action.user,
        isLoading: false,
        isAuthenticated: true,
        isAdmin: action.user.role === "admin",
      };
    case "AUTH_FAILURE":
      return {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
      };
    case "LOGOUT":
      return {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isAdmin: false,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
  });

  // Check session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await apiClient.get<{ user: User }>("/api/auth/me");
        dispatch({ type: "AUTH_SUCCESS", user: data.user });
      } catch {
        dispatch({ type: "AUTH_FAILURE" });
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    dispatch({ type: "AUTH_START" });
    try {
      const data = await apiClient.post<{ user: User }>("/api/auth/login", {
        username,
        password,
      });
      dispatch({ type: "AUTH_SUCCESS", user: data.user });
    } catch (err) {
      dispatch({ type: "AUTH_FAILURE" });
      throw err;
    }
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      dispatch({ type: "AUTH_START" });
      try {
        const data = await apiClient.post<{ user: User }>(
          "/api/auth/register",
          { username, email, password },
        );
        dispatch({ type: "AUTH_SUCCESS", user: data.user });
      } catch (err) {
        dispatch({ type: "AUTH_FAILURE" });
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiClient.post("/api/auth/logout");
    dispatch({ type: "LOGOUT" });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
