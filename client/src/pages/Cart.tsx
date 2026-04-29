import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import "../styles/cart.css";

export function Cart() {
  const { items, isLoading, cartTotal, updateQuantity, removeFromCart } =
    useCart();
  const { notify } = useNotification();

  const handleUpdateQuantity = async (productId: number, quantity: number) => {
    try {
      await updateQuantity(productId, quantity);
    } catch {
      notify("Failed to update quantity", "error");
    }
  };

  const handleRemove = async (productId: number, name: string) => {
    try {
      await removeFromCart(productId);
      notify(`${name} removed from cart`, "info");
    } catch {
      notify("Failed to remove item", "error");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        message="Browse our products and add something you like!"
        actionLabel="Browse Products"
        actionLink="/"
      />
    );
  }

  return (
    <div className="cart-page">
      <h1>Shopping Cart</h1>

      <div className="cart-items">
        {items.map((item) => (
          <div key={item.product_id} className="cart-item">
            <img
              src={item.image_url}
              alt={item.name}
              className="cart-item-image"
            />
            <div className="cart-item-info">
              <Link
                to={`/products/${item.product_id}`}
                className="cart-item-name"
              >
                {item.name}
              </Link>
              <p className="cart-item-price">
                ${Number(item.price).toFixed(2)}
              </p>
            </div>
            <div className="cart-item-quantity">
              <button
                onClick={() =>
                  handleUpdateQuantity(item.product_id, item.quantity - 1)
                }
                disabled={item.quantity <= 1}
                className="btn btn-outline btn-sm"
              >
                -
              </button>
              <span>{item.quantity}</span>
              <button
                onClick={() =>
                  handleUpdateQuantity(item.product_id, item.quantity + 1)
                }
                disabled={item.quantity >= item.stock}
                className="btn btn-outline btn-sm"
              >
                +
              </button>
            </div>
            <p className="cart-item-total">
              ${(Number(item.price) * item.quantity).toFixed(2)}
            </p>
            <button
              onClick={() => handleRemove(item.product_id, item.name)}
              className="btn btn-danger btn-sm"
              aria-label={`Remove ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-total">
          <span>Total:</span>
          <strong>${cartTotal.toFixed(2)}</strong>
        </div>
        <Link to="/checkout" className="btn btn-primary btn-lg">
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
