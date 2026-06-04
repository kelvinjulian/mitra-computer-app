import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  sellingPrice: number;
  quantity: number;
  stock: number;
  isCustom?: boolean;
  costPrice?: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product) => {
    const items = get().items;
    const existingItem = items.find((item) => item.productId === product.productId);

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      if (product.isCustom || newQuantity <= product.stock) {
        set({
          items: items.map((item) =>
            item.productId === product.productId
              ? { ...item, quantity: newQuantity }
              : item
          ),
        });
      }
    } else {
      if (product.isCustom || product.stock > 0) {
        set({
          items: [...items, { ...product, quantity: 1 }],
        });
      }
    }
  },

  removeItem: (productId) => {
    set({
      items: get().items.filter((item) => item.productId !== productId),
    });
  },

  updateQuantity: (productId, quantity) => {
    const items = get().items;
    const item = items.find((i) => i.productId === productId);
    if (!item) return;

    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    if (item.isCustom || quantity <= item.stock) {
      set({
        items: items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      });
    }
  },

  clearCart: () => set({ items: [] }),

  getTotalAmount: () => {
    return get().items.reduce((total, item) => total + item.sellingPrice * item.quantity, 0);
  },
}));
