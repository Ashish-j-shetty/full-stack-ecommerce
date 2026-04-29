import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { apiClient } from "../api/client";
import { useAuth } from "./AuthContext";

interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  itemCount: number;
  cartTotal: number;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient.get<{ items: CartItem[] }>("/api/cart");
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(async (productId: number, quantity = 1) => {
    const data = await apiClient.post<{ items: CartItem[] }>("/api/cart", {
      productId,
      quantity,
    });
    setItems(data.items);
  }, []);

  const updateQuantity = useCallback(
    async (productId: number, quantity: number) => {
      const data = await apiClient.put<{ items: CartItem[] }>(
        `/api/cart/${productId}`,
        { quantity },
      );
      setItems(data.items);
    },
    [],
  );

  const removeFromCart = useCallback(async (productId: number) => {
    await apiClient.delete(`/api/cart/${productId}`);
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        itemCount,
        cartTotal,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
