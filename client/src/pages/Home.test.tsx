import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "./Home";
import { describe, expect, it, vi } from "vitest";

// Mock hooks
vi.mock("../hooks/useFetch", () => ({
  useFetch: (url: string) => {
    if (url.includes("/categories")) {
      return {
        data: { categories: ["Electronics", "Clothing"] },
        isLoading: false,
        error: null,
      };
    }
    return {
      data: {
        data: [
          {
            id: 1,
            name: "Test Product",
            description: "desc",
            price: 19.99,
            image_url: "/img.jpg",
            stock: 5,
            category: "Electronics",
          },
          {
            id: 2,
            name: "Another Product",
            description: "desc",
            price: 39.99,
            image_url: "/img2.jpg",
            stock: 0,
            category: "Clothing",
          },
        ],
        total: 2,
        page: 1,
        totalPages: 1,
      },
      isLoading: false,
      error: null,
    };
  },
}));

vi.mock("../hooks/useDebounce", () => ({
  useDebounce: (value: string) => value,
}));

describe("Home", () => {
  it("renders product list heading", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("Products")).toBeInTheDocument();
  });

  it("renders product names", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("Another Product")).toBeInTheDocument();
  });

  it("renders category filter buttons", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getAllByText("Electronics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clothing").length).toBeGreaterThanOrEqual(1);
  });

  it("renders search input", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(
      screen.getByPlaceholderText("Search products..."),
    ).toBeInTheDocument();
  });
});
