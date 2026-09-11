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
      access_events: {
        Row: {
          created_at: string
          device_id_hash: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id_hash?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id_hash?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          ends_at: string | null
          id: string
          notes: string | null
          service_order_id: string | null
          starts_at: string
          title: string
          updated_at: string
          vehicle_id: string | null
          visible_to_customer: boolean
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          service_order_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
          vehicle_id?: string | null
          visible_to_customer?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          service_order_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          vehicle_id?: string | null
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calendar_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_user_id: string | null
          id: string
          kind: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_user_id?: string | null
          id?: string
          kind: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string | null
          id?: string
          kind?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      developer_access: {
        Row: {
          created_at: string
          is_active: boolean
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_permissions: {
        Row: {
          granted_at: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_user_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          read_at: string | null
          target: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          read_at?: string | null
          target?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          read_at?: string | null
          target?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_part_financials: {
        Row: {
          item_id: string
          markup: number | null
          order_id: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          item_id: string
          markup?: number | null
          order_id: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          item_id?: string
          markup?: number | null
          order_id?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_part_financials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_attempts: {
        Row: {
          blocked: boolean
          created_at: string
          device_id_hash: string | null
          email_hash: string | null
          id: string
          ip_address: unknown
          reason: string | null
          succeeded: boolean
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          device_id_hash?: string | null
          email_hash?: string | null
          id?: string
          ip_address?: unknown
          reason?: string | null
          succeeded?: boolean
        }
        Update: {
          blocked?: boolean
          created_at?: string
          device_id_hash?: string | null
          email_hash?: string | null
          id?: string
          ip_address?: unknown
          reason?: string | null
          succeeded?: boolean
        }
        Relationships: []
      }
      registration_invite_exemptions: {
        Row: {
          created_at: string
          created_by: string
          email_hash: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email_hash: string
          expires_at?: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email_hash?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      registration_rate_limits: {
        Row: {
          device_24h: number
          ip_1h: number
          ip_24h: number
          singleton: boolean
        }
        Insert: {
          device_24h: number
          ip_1h: number
          ip_24h: number
          singleton?: boolean
        }
        Update: {
          device_24h?: number
          ip_1h?: number
          ip_24h?: number
          singleton?: boolean
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
      before_user_created: { Args: { event: Json }; Returns: Json }
      can_view_financial: { Args: never; Returns: boolean }
      cancel_calendar_event: { Args: { event_id: string }; Returns: undefined }
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
      ensure_my_chat: { Args: never; Returns: string }
      financial_order_report: { Args: never; Returns: Json }
      financial_report: { Args: never; Returns: Json }
      get_developer_dashboard: { Args: never; Returns: Json }
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
      get_part_financial: {
        Args: { item_id: string; order_id: string }
        Returns: Json
      }
      has_developer_access: { Args: never; Returns: boolean }
      list_assignable_members: {
        Args: never
        Returns: {
          full_name: string
          operational_role: string
          user_id: string
        }[]
      }
      list_calendar_events: {
        Args: { range_end: string; range_start: string }
        Returns: {
          category: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          deleted_at: string | null
          ends_at: string | null
          id: string
          notes: string | null
          service_order_id: string | null
          starts_at: string
          title: string
          updated_at: string
          vehicle_id: string | null
          visible_to_customer: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_chat_contacts: {
        Args: never
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      list_chat_messages: {
        Args: { target_conversation: string }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_name: string
          sender_user_id: string
        }[]
      }
      list_financial_members: { Args: never; Returns: Json }
      list_my_conversations: {
        Args: never
        Returns: {
          display_name: string
          id: string
          kind: string
          last_message: string
          last_message_at: string
          title: string
          unread_count: number
          updated_at: string
        }[]
      }
      list_my_notifications: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message: string
          metadata: Json
          read_at: string | null
          target: string | null
          title: string
          type: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
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
      mark_chat_read: {
        Args: { target_conversation: string }
        Returns: undefined
      }
      mark_my_notifications_read: {
        Args: { notification_id?: string }
        Returns: undefined
      }
      reserve_invite_budget: { Args: { owner_id: string }; Returns: boolean }
      reserve_registration_attempt: {
        Args: {
          client_ip: unknown
          device_hash: string
          email_hash_value: string
        }
        Returns: string
      }
      save_calendar_event: {
        Args: {
          event_category: string
          event_ends_at: string
          event_id: string
          event_notes: string
          event_starts_at: string
          event_title: string
          related_customer: string
          related_service_order: string
          related_vehicle: string
        }
        Returns: string
      }
      save_part_financial: {
        Args: {
          expected_version: string
          item_id: string
          markup: number
          order_id: string
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Returns: Json
      }
      send_chat_message: {
        Args: { message_body: string; target_conversation: string }
        Returns: string
      }
      set_financial_permission: {
        Args: { allowed: boolean; target_user: string }
        Returns: undefined
      }
      start_direct_conversation: {
        Args: { target_user: string }
        Returns: string
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
