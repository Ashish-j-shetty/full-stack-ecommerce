import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Cart } from "./Cart";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateQuantity = vi.fn();
const mockRemoveFromCart = vi.fn();
const mockUseCart = vi.fn();
const mockNotify = vi.fn();

vi.mock("../context/CartContext", () => ({
  useCart: () => mockUseCart(),
}));

vi.mock("../context/NotificationContext", () => ({
  useNotification: () => ({ notify: mockNotify }),
}));

describe("Cart", () => {
  const mockItems = [
    {
      id: 1,
      product_id: 10,
      name: "Widget",
      price: 29.99,
      quantity: 2,
      image_url: "/img.jpg",
      stock: 5,
    },
    {
      id: 2,
      product_id: 20,
      name: "Gadget",
      price: 49.99,
      quantity: 1,
      image_url: "/img2.jpg",
      stock: 3,
    },
  ];

  beforeEach(() => {
    mockUpdateQuantity.mockResolvedValue(undefined);
    mockRemoveFromCart.mockResolvedValue(undefined);
    mockUseCart.mockReturnValue({
      items: mockItems,
      isLoading: false,
      cartTotal: 109.97,
      updateQuantity: mockUpdateQuantity,
      removeFromCart: mockRemoveFromCart,
    });
  });

  it("renders cart items", () => {
    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.getByText("Widget")).toBeInTheDocument();
    expect(screen.getByText("Gadget")).toBeInTheDocument();
  });

  it("shows cart total", () => {
    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.getByText("$109.97")).toBeInTheDocument();
  });

  it("shows empty state when cart is empty", () => {
    mockUseCart.mockReturnValue({
      items: [],
      isLoading: false,
      cartTotal: 0,
      updateQuantity: mockUpdateQuantity,
      removeFromCart: mockRemoveFromCart,
    });

    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    mockUseCart.mockReturnValue({
      items: [],
      isLoading: true,
      cartTotal: 0,
      updateQuantity: mockUpdateQuantity,
      removeFromCart: mockRemoveFromCart,
    });

    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Shopping Cart")).not.toBeInTheDocument();
  });

  it("has link to checkout", () => {
    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.getByText("Proceed to Checkout")).toBeInTheDocument();
  });

  it("has remove buttons for each item", () => {
    render(
      <MemoryRouter>
        <Cart />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Remove Widget")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Gadget")).toBeInTheDocument();
  });
});
