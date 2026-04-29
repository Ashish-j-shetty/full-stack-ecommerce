import { useState } from "react";
import { useParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { LoadingSpinner } from "../components/LoadingSpinner";
import "../styles/products.css";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useFetch<{ product: Product }>(
    `/api/products/${id}`,
  );
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { notify } = useNotification();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const product = data?.product;

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      notify("Please login to add items to cart", "error");
      return;
    }
    if (!product) return;
    setAdding(true);
    try {
      await addToCart(product.id, quantity);
      notify(`${product.name} added to cart`, "success");
    } catch {
      notify("Failed to add to cart", "error");
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="error-text">{error}</p>;
  if (!product) return <p className="error-text">Product not found</p>;

  return (
    <div className="product-detail">
      <img
        src={product.image_url}
        alt={product.name}
        className="product-detail-image"
      />
      <div className="product-detail-info">
        <span className="product-card-category">{product.category}</span>
        <h1>{product.name}</h1>
        <p className="product-detail-price">
          ${Number(product.price).toFixed(2)}
        </p>
        <p className="product-detail-description">{product.description}</p>

        <div className="product-detail-stock">
          {product.stock > 0 ? (
            <span className="in-stock">
              In Stock ({product.stock} available)
            </span>
          ) : (
            <span className="out-of-stock">Out of Stock</span>
          )}
        </div>

        {product.stock > 0 && (
          <div className="product-detail-actions">
            <div className="quantity-selector">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="btn btn-outline btn-sm"
              >
                -
              </button>
              <span className="quantity-display">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity((q) => Math.min(product.stock, q + 1))
                }
                disabled={quantity >= product.stock}
                className="btn btn-outline btn-sm"
              >
                +
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className="btn btn-primary"
            >
              {adding ? "Adding..." : "Add to Cart"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
