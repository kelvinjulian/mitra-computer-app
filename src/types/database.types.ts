export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          role: Database['public']['Enums']['user_role']
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          role: Database['public']['Enums']['user_role']
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          category: Database['public']['Enums']['product_category']
          cost_price: number
          selling_price: number
          stock: number
          min_stock_threshold: number
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: Database['public']['Enums']['product_category']
          cost_price: number
          selling_price: number
          stock?: number
          min_stock_threshold?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: Database['public']['Enums']['product_category']
          cost_price?: number
          selling_price?: number
          stock?: number
          min_stock_threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          invoice_number: string
          staff_id: string
          total_amount: number
          payment_method: Database['public']['Enums']['payment_method']
          created_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          staff_id: string
          total_amount: number
          payment_method: Database['public']['Enums']['payment_method']
          created_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          staff_id?: string
          total_amount?: number
          payment_method?: Database['public']['Enums']['payment_method']
          created_at?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_id: string
          quantity: number
          price_at_sale: number
        }
        Insert: {
          id?: string
          transaction_id: string
          product_id: string
          quantity: number
          price_at_sale: number
        }
        Update: {
          id?: string
          transaction_id?: string
          product_id?: string
          quantity?: number
          price_at_sale?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          customer_name: string
          customer_whatsapp: string
          device_name: string
          complaint: string
          status: Database['public']['Enums']['service_status']
          service_cost: number | null
          part_cost: number
          technician_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_name: string
          customer_whatsapp: string
          device_name: string
          complaint: string
          status?: Database['public']['Enums']['service_status']
          service_cost?: number | null
          part_cost?: number
          technician_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_name?: string
          customer_whatsapp?: string
          device_name?: string
          complaint?: string
          status?: Database['public']['Enums']['service_status']
          service_cost?: number | null
          part_cost?: number
          technician_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          description: string
          amount: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          description: string
          amount: number
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          description?: string
          amount?: number
          date?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Enums: {
      user_role: 'owner' | 'staff'
      product_category: 'komputer' | 'laptop' | 'printer' | 'aksesoris' | 'part'
      payment_method: 'cash' | 'transfer'
      service_status: 'antrean' | 'dicek' | 'menunggu_part' | 'selesai' | 'batal'
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
