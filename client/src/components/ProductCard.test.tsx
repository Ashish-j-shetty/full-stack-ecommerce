import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProductCard } from "./ProductCard";

function renderCard(props = {}) {
  const defaultProps = {
    id: 1,
    name: "Test Product",
    price: 29.99,
    image_url: "/placeholder.png",
    stock: 10,
    category: "Electronics",
  };

  return render(
    <BrowserRouter>
      <ProductCard {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe("ProductCard", () => {
  it("renders product name and price", () => {
    renderCard();

    expect(screen.getByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders category", () => {
    renderCard();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
  });

  it("renders product image", () => {
    renderCard();
    const img = screen.getByAltText("Test Product");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/placeholder.png");
  });

  it("links to product detail page", () => {
    renderCard({ id: 42 });
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products/42");
  });

  it("shows out of stock badge when stock is 0", () => {
    renderCard({ stock: 0 });
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });

  it("does not show out of stock when in stock", () => {
    renderCard({ stock: 5 });
    expect(screen.queryByText("Out of Stock")).not.toBeInTheDocument();
  });
});
