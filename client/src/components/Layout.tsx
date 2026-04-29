import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNotification } from "../context/NotificationContext";
import { ThemeToggle } from "./ThemeToggle";
import "../styles/layout.css";

export function Layout() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { itemCount } = useCart();
  const { notifications, dismiss } = useNotification();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-content container">
          <Link to="/" className="logo">
            E-Shop
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">
              Home
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/cart" className="nav-link cart-link">
                  Cart
                  {itemCount > 0 && (
                    <span className="cart-badge">{itemCount}</span>
                  )}
                </Link>
                <Link to="/orders" className="nav-link">
                  Orders
                </Link>
                {isAdmin && (
                  <Link to="/admin/products" className="nav-link">
                    Admin
                  </Link>
                )}
                <span className="nav-user">Hi, {user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="btn btn-outline btn-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">
                  Login
                </Link>
                <Link to="/register" className="nav-link">
                  Register
                </Link>
              </>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="main container">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} E-Shop. Built for learning.</p>
        </div>
      </footer>

      {/* Toast notifications */}
      <div className="notifications">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`toast toast-${n.type}`}
            onClick={() => dismiss(n.id)}
          >
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
}
