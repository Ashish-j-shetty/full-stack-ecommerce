import { Link, useParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { LoadingSpinner } from "../components/LoadingSpinner";

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  price_at_purchase: number;
  name: string;
  image_url: string;
}

interface Order {
  id: number;
  total: number;
  status: string;
  shipping_address: string;
  created_at: string;
  items: OrderItem[];
}

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useFetch<{ order: Order }>(
    `/api/orders/${id}`,
  );

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="error-text">{error}</p>;
  if (!data) return null;

  const { order } = data;

  return (
    <div className="order-confirmation">
      <div className="confirmation-header">
        <h1>Order Confirmed!</h1>
        <p>Order #{order.id} has been placed successfully.</p>
      </div>

      <div className="order-details-card">
        <div className="order-meta">
          <div>
            <strong>Status:</strong>
            <span className={`status-badge status-${order.status}`}>
              {order.status}
            </span>
          </div>
          <div>
            <strong>Date:</strong>{" "}
            {new Date(order.created_at).toLocaleDateString()}
          </div>
          <div>
            <strong>Shipping to:</strong> {order.shipping_address}
          </div>
        </div>

        <h3>Items</h3>
        <div className="order-items">
          {order.items.map((item) => (
            <div key={item.id} className="order-item-row">
              <img
                src={item.image_url}
                alt={item.name}
                className="order-item-image"
              />
              <span className="order-item-name">{item.name}</span>
              <span>× {item.quantity}</span>
              <span>
                $
                {(
                  parseFloat(String(item.price_at_purchase)) * item.quantity
                ).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="order-total-row">
          <strong>Total: ${parseFloat(String(order.total)).toFixed(2)}</strong>
        </div>
      </div>

      <div className="confirmation-actions">
        <Link to="/" className="btn btn-primary">
          Continue Shopping
        </Link>
        <Link to="/orders" className="btn btn-outline">
          View All Orders
        </Link>
      </div>
    </div>
  );
}
