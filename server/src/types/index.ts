import { Request } from "express";

export interface User {
  id: number;
  username: string;
  email: string;
  role: "customer" | "admin";
  created_at: Date;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
  created_at: Date;
}

export interface CartItem {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
}

export interface Order {
  id: number;
  user_id: number;
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered";
  shipping_address: string;
  created_at: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price_at_purchase: number;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: "customer" | "admin";
  };
}

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
