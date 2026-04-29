import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { apiClient } from "../api/client";
import "../styles/cart.css";

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
  item_count: number;
}

interface OrderDetail extends Order {
  items: OrderItem[];
}

export function OrderHistory() {
  const { data, isLoading, error } = useFetch<{ orders: Order[] }>(
    "/api/orders",
  );
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<number, OrderDetail>>(
    {},
  );

  const toggleOrder = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }

    setExpandedOrder(orderId);

    if (!orderDetails[orderId]) {
      try {
        const detail = await apiClient.get<{ order: OrderDetail }>(
          `/api/orders/${orderId}`,
        );
        setOrderDetails((prev) => ({ ...prev, [orderId]: detail.order }));
      } catch {
        // fail silently, user can try again
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="error-text">{error}</p>;

  if (!data || data.orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        message="Start shopping to see your order history here."
        actionLabel="Browse Products"
        actionLink="/"
      />
    );
  }

  return (
    <div className="orders-page">
      <h1>Order History</h1>
      <div className="orders-list">
        {data.orders.map((order) => (
          <div key={order.id} className="order-card">
            <div
              className="order-card-header"
              onClick={() => toggleOrder(order.id)}
            >
              <div>
                <strong>Order #{order.id}</strong>
                <span className="order-date">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="order-card-meta">
                <span className={`status-badge status-${order.status}`}>
                  {order.status}
                </span>
                <span>
                  {order.item_count} item{order.item_count !== 1 ? "s" : ""}
                </span>
                <strong>${parseFloat(String(order.total)).toFixed(2)}</strong>
                <span className="expand-icon">
                  {expandedOrder === order.id ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {expandedOrder === order.id && orderDetails[order.id] && (
              <div className="order-card-details">
                <p>
                  <strong>Shipped to:</strong> {order.shipping_address}
                </p>
                <div className="order-items">
                  {orderDetails[order.id].items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="order-item-image"
                      />
                      <span>{item.name}</span>
                      <span>× {item.quantity}</span>
                      <span>
                        $
                        {(
                          parseFloat(String(item.price_at_purchase)) *
                          item.quantity
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
