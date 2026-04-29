import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { apiClient, ApiError } from "../api/client";
import "../styles/forms.css";
import "../styles/cart.css";

interface OrderResponse {
  order: { id: number };
}

export function Checkout() {
  const { items, cartTotal, clearCart } = useCart();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    zip: "",
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.address.trim()) newErrors.address = "Address is required";
    if (!form.city.trim()) newErrors.city = "City is required";
    if (!form.zip.trim()) newErrors.zip = "ZIP code is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const data = await apiClient.post<OrderResponse>("/api/orders", {
        shippingAddress: form,
      });
      clearCart();
      notify("Order placed successfully!", "success");
      navigate(`/orders/${data.order.id}`);
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Failed to place order",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    navigate("/cart");
    return null;
  }

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <h2>Shipping Address</h2>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={errors.name ? "input-error" : ""}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className={errors.address ? "input-error" : ""}
            />
            {errors.address && (
              <span className="field-error">{errors.address}</span>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className={errors.city ? "input-error" : ""}
              />
              {errors.city && (
                <span className="field-error">{errors.city}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="zip">ZIP Code</label>
              <input
                id="zip"
                type="text"
                value={form.zip}
                onChange={(e) => handleChange("zip", e.target.value)}
                className={errors.zip ? "input-error" : ""}
              />
              {errors.zip && <span className="field-error">{errors.zip}</span>}
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary btn-lg"
          >
            {isSubmitting ? "Placing Order..." : "Place Order"}
          </button>
        </form>

        <div className="checkout-summary">
          <h2>Order Summary</h2>
          {items.map((item) => (
            <div key={item.product_id} className="checkout-item">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>${(Number(item.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="checkout-total">
            <strong>Total:</strong>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
