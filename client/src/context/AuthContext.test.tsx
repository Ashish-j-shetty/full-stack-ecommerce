import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { type ReactNode } from "react";
import { vi, describe, expect, it, beforeEach } from "vitest";

// Mock the API client
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("../api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  ApiError: class ApiError extends Error {},
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading state and checks session", async () => {
    mockGet.mockRejectedValue(new Error("not authed"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("sets user on successful session check", async () => {
    const mockUser = {
      id: 1,
      username: "john",
      email: "john@test.com",
      role: "customer" as const,
    };
    mockGet.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("john");
  });

  it("login updates auth state", async () => {
    mockGet.mockRejectedValue(new Error("not authed"));
    const mockUser = {
      id: 1,
      username: "john",
      email: "john@test.com",
      role: "customer" as const,
    };
    mockPost.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login("john", "password123");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("john");
  });

  it("detects admin role", async () => {
    const mockUser = {
      id: 1,
      username: "admin",
      email: "admin@test.com",
      role: "admin" as const,
    };
    mockGet.mockResolvedValue({ user: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
  });

  it("logout clears auth state", async () => {
    const mockUser = {
      id: 1,
      username: "john",
      email: "john@test.com",
      role: "customer" as const,
    };
    mockGet.mockResolvedValue({ user: mockUser });
    mockPost.mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("throws when useAuth used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");

    consoleSpy.mockRestore();
  });
});
