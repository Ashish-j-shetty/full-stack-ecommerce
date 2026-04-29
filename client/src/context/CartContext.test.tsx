import { renderHook, act, waitFor } from "@testing-library/react";
import { CartProvider, useCart } from "./CartContext";
import type { ReactNode } from "react";
import { describe, expect, beforeEach, it, vi } from "vitest";

// Mock auth context — cart depends on it
const mockIsAuthenticated = { value: true };
vi.mock("./AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated.value }),
}));

// Mock API client
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock("../api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("CartContext", () => {
  const mockItems = [
    {
      id: 1,
      product_id: 10,
      name: "Widget",
      price: 10,
      quantity: 2,
      image_url: "/img.jpg",
      stock: 5,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated.value = true;
    mockGet.mockResolvedValue({ items: mockItems });
  });

  it("fetches cart on mount when authenticated", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(mockGet).toHaveBeenCalledWith("/api/cart");
  });

  it("calculates item count and total", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(result.current.itemCount).toBe(2);
    expect(result.current.cartTotal).toBe(20);
  });

  it("does not fetch cart when not authenticated", async () => {
    mockIsAuthenticated.value = false;
    mockGet.mockClear();

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it("clears cart", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("throws when useCart used outside provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useCart());
    }).toThrow("useCart must be used within a CartProvider");

    consoleSpy.mockRestore();
  });
});
