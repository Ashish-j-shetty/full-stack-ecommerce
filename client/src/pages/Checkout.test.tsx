import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Checkout } from "./Checkout";
import { describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockClearCart = vi.fn();
const mockNotify = vi.fn();

vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({
    items: [
      {
        id: 1,
        product_id: 10,
        name: "Widget",
        price: 29.99,
        quantity: 2,
        image_url: "/img.jpg",
        stock: 5,
      },
    ],
    cartTotal: 59.98,
    clearCart: mockClearCart,
  }),
}));

vi.mock("../context/NotificationContext", () => ({
  useNotification: () => ({ notify: mockNotify }),
}));

vi.mock("../api/client", () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

describe("Checkout", () => {
  it("renders the checkout form fields", () => {
    render(
      <MemoryRouter>
        <Checkout />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("ZIP Code")).toBeInTheDocument();
  });

  it("shows validation errors for empty fields", () => {
    render(
      <MemoryRouter>
        <Checkout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Place Order"));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("ZIP code is required")).toBeInTheDocument();
  });

  it("allows typing in form fields", () => {
    render(
      <MemoryRouter>
        <Checkout />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "John Doe" },
    });
    expect(screen.getByLabelText("Full Name")).toHaveValue("John Doe");
  });

  it("shows order summary total", () => {
    render(
      <MemoryRouter>
        <Checkout />
      </MemoryRouter>,
    );

    const totals = screen.getAllByText("$59.98");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });
});
