import React, { useState, useEffect } from "react";
import { useFetch } from "../../hooks/useFetch";
import { apiClient, ApiError } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import "../../styles/admin.css";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category: "",
  image_url: "",
};

export function AdminProducts() {
  const { data, isLoading, refetch } = useFetch<ProductsResponse>(
    "/api/products?limit=50",
  );
  const { notify } = useNotification();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    if (editingId && data) {
      const product = data.data.find((p) => p.id === editingId);
      if (product) {
        setForm({
          name: product.name,
          description: product.description || "",
          price: String(product.price),
          stock: String(product.stock),
          category: product.category || "",
          image_url: product.image_url || "",
        });
        setShowForm(true);
      }
    }
  }, [editingId, data]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.stock) {
      notify("Name, price, and stock are required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        stock: parseInt(form.stock),
        category: form.category,
        image_url: form.image_url || "/placeholder.png",
      };

      if (editingId) {
        await apiClient.put(`/api/admin/products/${editingId}`, body);
        notify("Product updated", "success");
      } else {
        await apiClient.post("/api/admin/products", body);
        notify("Product created", "success");
      }

      resetForm();
      refetch();
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Operation failed",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/api/admin/products/${id}`);
      notify("Product deleted", "success");
      setDeleteConfirm(null);
      refetch();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Delete failed", "error");
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Manage Products</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add Product
          </button>
        )}
      </div>

      {showForm && (
        <form className="admin-form" onSubmit={handleSubmit}>
          <h2>{editingId ? "Edit Product" : "New Product"}</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                <option value="">Select category</option>
                <option value="Electronics">Electronics</option>
                <option value="Clothing">Clothing</option>
                <option value="Books">Books</option>
                <option value="Home">Home</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">Price *</label>
              <input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="stock">Stock *</label>
              <input
                id="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stock: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="image_url">Image URL</label>
            <input
              id="image_url"
              type="text"
              value={form.image_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, image_url: e.target.value }))
              }
              placeholder="/placeholder.png"
            />
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting
                ? "Saving..."
                : editingId
                  ? "Update Product"
                  : "Create Product"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.category}</td>
              <td>${Number(product.price).toFixed(2)}</td>
              <td>{product.stock}</td>
              <td className="admin-actions">
                <button
                  onClick={() => setEditingId(product.id)}
                  className="btn btn-outline btn-sm"
                >
                  Edit
                </button>
                {deleteConfirm === product.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="btn btn-outline btn-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(product.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
