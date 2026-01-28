
export type Role = 'admin' | 'seller';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Product {
  id: string;
  name: string;
  priceRetail: number;
  priceWholesale: number;
  cost: number;
  stock: number;
  category: string;
  image?: string; 
}

export interface Client {
  id: string;
  name: string;
  businessName: string;
  debt: number;
  creditLimit: number;
  address: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SuspendedSale {
  id: string;
  customerName: string;
  items: CartItem[];
  date: string;
  total: number;
}

export type SaleType = 'pos' | 'dispatch';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  date: string; // ISO string
  type: SaleType;
  items: SaleItem[];
  totalAmount: number;
  clientId?: string;
  clientName?: string;
  sellerId: string;
}

export interface AppSettings {
  exchangeRate: number; // Bs per USD
}
