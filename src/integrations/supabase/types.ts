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
      extra_revenues: {
        Row: {
          category_id: string
          cost: number
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          revenue: number
          subcategory_id: string | null
        }
        Insert: {
          category_id: string
          cost?: number
          created_at?: string
          created_by: string
          date: string
          description: string
          id: string
          revenue: number
          subcategory_id?: string | null
        }
        Update: {
          category_id?: string
          cost?: number
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          revenue?: number
          subcategory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extra_revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_revenues_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_correction_audit: {
        Row: {
          actor_name: string
          created_at: string
          id: string
          new_value: Json
          order_id: string
          previous_value: Json
          reason: string
          recorded_by: string
          request_id: string
          request_payload: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          actor_name: string
          created_at?: string
          id?: string
          new_value: Json
          order_id: string
          previous_value: Json
          reason: string
          recorded_by: string
          request_id: string
          request_payload: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          actor_name?: string
          created_at?: string
          id?: string
          new_value?: Json
          order_id?: string
          previous_value?: Json
          reason?: string
          recorded_by?: string
          request_id?: string
          request_payload?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_correction_audit_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
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
      quote_item_financials: {
        Row: {
          item_id: string
          markup: number | null
          quote_id: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          item_id: string
          markup?: number | null
          quote_id: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          item_id?: string
          markup?: number | null
          quote_id?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_financials_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          id: string
          items: Json
          notes: string
          quote_number: number
          service_order_id: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
          vehicle_model_text: string | null
          vehicle_plate_text: string | null
          warranty_days: number
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          id?: string
          items?: Json
          notes?: string
          quote_number?: number
          service_order_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_model_text?: string | null
          vehicle_plate_text?: string | null
          warranty_days?: number
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string
          id?: string
          items?: Json
          notes?: string
          quote_number?: number
          service_order_id?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_model_text?: string | null
          vehicle_plate_text?: string | null
          warranty_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      revenue_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "revenue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          activities: Json
          budget: Json
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          complaint: string
          completed_at: string | null
          created_at: string
          creation_request_id: string | null
          customer_id: string
          deleted_at: string | null
          diagnosis: string
          discount_amount: number
          discount_reason: string
          entry_mileage: number
          evidence: Json
          findings: string
          flow_type: string
          id: string
          notes: string
          opened_at: string
          order_number: number
          payment: Json | null
          quick_vehicle_brand: string | null
          quick_vehicle_model: string | null
          quick_vehicle_year: number | null
          status: string
          status_history: Json
          team: Json
          updated_at: string
          vehicle_id: string | null
          warranty_days: number | null
          workshop_snapshot: Json | null
        }
        Insert: {
          activities?: Json
          budget?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          complaint: string
          completed_at?: string | null
          created_at?: string
          creation_request_id?: string | null
          customer_id: string
          deleted_at?: string | null
          diagnosis?: string
          discount_amount?: number
          discount_reason?: string
          entry_mileage: number
          evidence?: Json
          findings?: string
          flow_type?: string
          id?: string
          notes?: string
          opened_at?: string
          order_number?: number
          payment?: Json | null
          quick_vehicle_brand?: string | null
          quick_vehicle_model?: string | null
          quick_vehicle_year?: number | null
          status: string
          status_history?: Json
          team?: Json
          updated_at?: string
          vehicle_id?: string | null
          warranty_days?: number | null
          workshop_snapshot?: Json | null
        }
        Update: {
          activities?: Json
          budget?: Json
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          complaint?: string
          completed_at?: string | null
          created_at?: string
          creation_request_id?: string | null
          customer_id?: string
          deleted_at?: string | null
          diagnosis?: string
          discount_amount?: number
          discount_reason?: string
          entry_mileage?: number
          evidence?: Json
          findings?: string
          flow_type?: string
          id?: string
          notes?: string
          opened_at?: string
          order_number?: number
          payment?: Json | null
          quick_vehicle_brand?: string | null
          quick_vehicle_model?: string | null
          quick_vehicle_year?: number | null
          status?: string
          status_history?: Json
          team?: Json
          updated_at?: string
          vehicle_id?: string | null
          warranty_days?: number | null
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
      workshop_settings: {
        Row: {
          address: string
          cnpj: string
          hours: string
          id: boolean
          legal_name: string
          name: string
          phone: string
          postal_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string
          cnpj?: string
          hours?: string
          id?: boolean
          legal_name?: string
          name?: string
          phone?: string
          postal_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          cnpj?: string
          hours?: string
          id?: boolean
          legal_name?: string
          name?: string
          phone?: string
          postal_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_budget_item: {
        Args: {
          expected_version: string
          item_id: string
          item_name: string
          item_type: string
          markup: number
          order_id: string
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Returns: Json
      }
      add_extra_revenue: { Args: { entry: Json }; Returns: Json }
      add_quote_item: {
        Args: {
          expected_version: string
          item_id: string
          item_name: string
          item_type: string
          markup: number
          quantity: number
          quote_id: string
          unit_cost: number
          unit_price: number
        }
        Returns: Json
      }
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
      cancel_service_order: {
        Args: { expected_version: string; order_id: string; reason: string }
        Returns: Json
      }
      convert_quote_to_order: {
        Args: {
          entry_mileage: number
          expected_version: string
          quote_id: string
          vehicle: string
        }
        Returns: Json
      }
      convert_quote_with_vehicle: {
        Args: {
          entry_mileage: number
          expected_version: string
          new_vehicle: Json
          quote_id: string
          vehicle: string
        }
        Returns: Json
      }
      correct_order_financial: {
        Args: {
          correction_type: string
          expected_version: string
          order_id: string
          payload: Json
          reason: string
          request_id: string
        }
        Returns: Json
      }
      create_customer: {
        Args: { customer_data: Json }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_quick_service_order:
        | {
            Args: {
              card_fee?: number
              discount_amount: number
              discount_reason: string
              existing_customer_id: string
              existing_vehicle_id: string
              internal_cost?: number
              new_customer: Json
              payment_method: string
              received_amount: number
              request_id: string
              service_amount: number
              service_name: string
              vehicle_brand: string
              vehicle_model: string
              vehicle_year: number
              workshop_snapshot: Json
            }
            Returns: Json
          }
        | {
            Args: {
              additional_items: Json
              card_fee: number
              discount_amount: number
              discount_reason: string
              existing_customer_id: string
              existing_vehicle_id: string
              internal_cost: number
              new_customer: Json
              payment_method: string
              received_amount: number
              request_id: string
              service_amount: number
              service_name: string
              vehicle_brand: string
              vehicle_model: string
              vehicle_year: number
              workshop_snapshot: Json
            }
            Returns: Json
          }
      create_quick_service_order_before_financial_result: {
        Args: {
          discount_amount?: number
          discount_reason?: string
          existing_customer_id: string
          existing_vehicle_id: string
          new_customer: Json
          payment_method?: string
          received_amount?: number
          request_id: string
          service_amount: number
          service_name: string
          vehicle_brand: string
          vehicle_model: string
          vehicle_year: number
          workshop_snapshot?: Json
        }
        Returns: Json
      }
      create_quote: {
        Args: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          customer: string
          quote_description: string
          quote_notes: string
          vehicle: string
        }
        Returns: Json
      }
      create_quote_snapshot: {
        Args: {
          contact_email: string
          contact_name: string
          contact_phone: string
          customer: string
          quote_description: string
          quote_notes: string
          vehicle: string
          vehicle_model_text: string
          vehicle_plate_text: string
        }
        Returns: Json
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
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          complaint: string
          completed_at: string | null
          created_at: string
          creation_request_id: string | null
          customer_id: string
          deleted_at: string | null
          diagnosis: string
          discount_amount: number
          discount_reason: string
          entry_mileage: number
          evidence: Json
          findings: string
          flow_type: string
          id: string
          notes: string
          opened_at: string
          order_number: number
          payment: Json | null
          quick_vehicle_brand: string | null
          quick_vehicle_model: string | null
          quick_vehicle_year: number | null
          status: string
          status_history: Json
          team: Json
          updated_at: string
          vehicle_id: string | null
          warranty_days: number | null
          workshop_snapshot: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_service_order_atomic_before_financial_result: {
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
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          complaint: string
          completed_at: string | null
          created_at: string
          creation_request_id: string | null
          customer_id: string
          deleted_at: string | null
          diagnosis: string
          discount_amount: number
          discount_reason: string
          entry_mileage: number
          evidence: Json
          findings: string
          flow_type: string
          id: string
          notes: string
          opened_at: string
          order_number: number
          payment: Json | null
          quick_vehicle_brand: string | null
          quick_vehicle_model: string | null
          quick_vehicle_year: number | null
          status: string
          status_history: Json
          team: Json
          updated_at: string
          vehicle_id: string | null
          warranty_days: number | null
          workshop_snapshot: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vehicle: {
        Args: { vehicle_data: Json }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_service_order: {
        Args: { expected_version: string; order_id: string }
        Returns: undefined
      }
      ensure_my_chat: { Args: never; Returns: string }
      financial_order_report: { Args: never; Returns: Json }
      financial_report: { Args: never; Returns: Json }
      get_developer_dashboard: { Args: never; Returns: Json }
      get_financial_corrections: { Args: { order_id: string }; Returns: Json }
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
      get_quote_part_financial: {
        Args: { item_id: string; quote_id: string }
        Returns: Json
      }
      has_developer_access: { Args: never; Returns: boolean }
      link_quote_customer: {
        Args: {
          existing_customer: string
          expected_version: string
          quote_id: string
        }
        Returns: Json
      }
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
      list_extra_revenues: { Args: never; Returns: Json }
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
      list_quotes: {
        Args: never
        Returns: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string
          id: string
          items: Json
          notes: string
          quote_number: number
          service_order_id: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
          vehicle_model_text: string | null
          vehicle_plate_text: string | null
          warranty_days: number
        }[]
        SetofOptions: {
          from: "*"
          to: "quotes"
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
      match_quote_contact: {
        Args: { quote_id: string }
        Returns: {
          email: string
          id: string
          name: string
          phone: string
        }[]
      }
      match_quote_vehicle: { Args: { quote_id: string }; Returns: Json }
      order_receivables: { Args: never; Returns: Json }
      record_order_payment: {
        Args: { expected_version: string; order_id: string; receipt: Json }
        Returns: Json
      }
      remove_budget_item: {
        Args: { expected_version: string; item_id: string; order_id: string }
        Returns: Json
      }
      remove_quote_item: {
        Args: { expected_version: string; item_id: string; quote_id: string }
        Returns: Json
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
      save_revenue_category: {
        Args: {
          category_id: string
          category_name: string
          enabled: boolean
          parent: string
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
      set_order_discount: {
        Args: {
          amount: number
          expected_version: string
          order_id: string
          reason?: string
          request_id: string
        }
        Returns: Json
      }
      set_quote_status: {
        Args: { expected_version: string; new_status: string; quote_id: string }
        Returns: Json
      }
      start_direct_conversation: {
        Args: { target_user: string }
        Returns: string
      }
      try_link_my_customer: { Args: never; Returns: string }
      update_order_complaint: {
        Args: {
          expected_version: string
          new_complaint: string
          order_id: string
        }
        Returns: Json
      }
      update_quote: {
        Args: {
          expected_version: string
          quote_description: string
          quote_id: string
          quote_notes: string
          vehicle: string
        }
        Returns: Json
      }
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
