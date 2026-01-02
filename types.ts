
export interface Item {
  id: string;
  category: string;
  name: string;
  price: number;
  quantity: number;
  mnemonic: string;
  order: number;
  allowUpsell?: boolean;
}

export interface Order {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  mnemonic: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  address: string;
  timestamp: string;
  status: 'confirmed' | 'waitlisted';
}

export interface WaitlistConfig {
  maxSize: number;
}

export type ViewMode = 'seller' | 'buyer';
