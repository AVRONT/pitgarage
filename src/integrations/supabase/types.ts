export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          auth_user_id: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string
          email_normalized: string | null
          id: string
          name: string
          phone: string
          since: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          email_normalized?: string | null
          id?: string
          name: string
          phone: string
          since?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          email_normalized?: string | null
          id?: string
          name?: string
          phone?: string
          since?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          activities: Json
          budget: Json
          complaint: string
          completed_at: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          diagnosis: string
          entry_mileage: number
          evidence: Json
          findings: string
          id: string
          notes: string
          opened_at: string
          order_number: number
          payment: Json | null
          status: string
          status_history: Json
          team: Json
          updated_at: string
          vehicle_id: string
          workshop_snapshot: Json | null
        }
        Insert: {
          activities?: Json
          budget?: Json
          complaint: string
          completed_at?: string | null
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          diagnosis?: string
          entry_mileage: number
          evidence?: Json
          findings?: string
          id?: string
          notes?: string
          opened_at?: string
          order_number?: number
          payment?: Json | null
          status: string
          status_history?: Json
          team?: Json
          updated_at?: string
          vehicle_id: string
          workshop_snapshot?: Json | null
        }
        Update: {
          activities?: Json
          budget?: Json
          complaint?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          diagnosis?: string
          entry_mileage?: number
          evidence?: Json
          findings?: string
          id?: string
          notes?: string
          opened_at?: string
          order_number?: number
          payment?: Json | null
          status?: string
          status_history?: Json
          team?: Json
          updated_at?: string
          vehicle_id?: string
          workshop_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_customer_match"
            columns: ["vehicle_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          full_name: string | null
          is_active: boolean
          operational_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          operational_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          full_name?: string | null
          is_active?: boolean
          operational_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          color: string
          created_at: string
          customer_id: string
          deleted_at: string | null
          id: string
          kind: string
          mileage: number
          model: string
          plate: string
          updated_at: string
          year: number
        }
        Insert: {
          brand: string
          color: string
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          id?: string
          kind: string
          mileage?: number
          model: string
          plate: string
          updated_at?: string
          year: number
        }
        Update: {
          brand?: string
          color?: string
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          mileage?: number
          model?: string
          plate?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      administer_user_profile: {
        Args: {
          new_access_level: Database["public"]["Enums"]["access_level"]
          new_full_name: string
          new_is_active: boolean
          new_operational_role: string
          target_user_id: string
        }
        Returns: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          full_name: string | null
          is_active: boolean
          operational_role: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_order_atomic: {
        Args: {
          existing_customer_id: string
          existing_vehicle_id: string
          new_customer: Json
          new_vehicle: Json
          order_data: Json
        }
        Returns: {
          activities: Json
          budget: Json
          complaint: string
          completed_at: string | null
          created_at: string
          customer_id: string
          deleted_at: string | null
          diagnosis: string
          entry_mileage: number
          evidence: Json
          findings: string
          id: string
          notes: string
          opened_at: string
          order_number: number
          payment: Json | null
          status: string
          status_history: Json
          team: Json
          updated_at: string
          vehicle_id: string
          workshop_snapshot: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_customer: {
        Args: never
        Returns: {
          cpf: string
          email: string
          id: string
          name: string
          phone: string
          since: string
        }[]
      }
      get_my_service_orders: {
        Args: never
        Returns: {
          completed_at: string
          id: string
          opened_at: string
          order_number: number
          status: string
          vehicle_id: string
        }[]
      }
      get_my_vehicles: {
        Args: never
        Returns: {
          brand: string
          color: string
          customer_id: string
          id: string
          kind: string
          mileage: number
          model: string
          plate: string
          year: number
        }[]
      }
      list_team_users: {
        Args: never
        Returns: {
          access_level: Database["public"]["Enums"]["access_level"]
          customer_id: string
          email: string
          full_name: string
          is_active: boolean
          operational_role: string
          user_id: string
        }[]
      }
      try_link_my_customer: { Args: never; Returns: string }
    }
    Enums: {
      access_level: "customer" | "staff" | "admin" | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: ["customer", "staff", "admin", "owner"],
    },
  },
} as const
