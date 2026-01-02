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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      breaks: {
        Row: {
          break_date: string
          created_at: string
          end_time: string
          id: string
          instance_id: string
          note: string | null
          start_time: string
          station_id: string | null
          updated_at: string
        }
        Insert: {
          break_date: string
          created_at?: string
          end_time: string
          id?: string
          instance_id: string
          note?: string | null
          start_time: string
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          break_date?: string
          created_at?: string
          end_time?: string
          id?: string
          instance_id?: string
          note?: string | null
          start_time?: string
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      closed_days: {
        Row: {
          closed_date: string
          created_at: string
          created_by: string | null
          id: string
          instance_id: string
          reason: string | null
        }
        Insert: {
          closed_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id: string
          reason?: string | null
        }
        Update: {
          closed_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closed_days_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_vehicles: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          instance_id: string
          last_used_at: string
          model: string
          phone: string
          plate: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          instance_id: string
          last_used_at?: string
          model: string
          phone: string
          plate?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          instance_id?: string
          last_used_at?: string
          model?: string
          phone?: string
          plate?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_vehicles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          instance_id: string
          name: string
          nip: string | null
          notes: string | null
          phone: string
          phone_verified: boolean | null
          source: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instance_id: string
          name: string
          nip?: string | null
          notes?: string | null
          phone: string
          phone_verified?: boolean | null
          source?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          instance_id?: string
          name?: string
          nip?: string | null
          notes?: string | null
          phone?: string
          phone_verified?: boolean | null
          source?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          instance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          instance_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          instance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_permissions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_events: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          followup_service_id: string | null
          id: string
          instance_id: string
          next_reminder_date: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          followup_service_id?: string | null
          id?: string
          instance_id: string
          next_reminder_date?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          followup_service_id?: string | null
          id?: string
          instance_id?: string
          next_reminder_date?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_events_followup_service_id_fkey"
            columns: ["followup_service_id"]
            isOneToOne: false
            referencedRelation: "followup_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_services: {
        Row: {
          active: boolean
          created_at: string
          default_interval_months: number
          description: string | null
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_interval_months?: number
          description?: string | null
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_interval_months?: number
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_services_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          due_date: string
          event_id: string
          id: string
          instance_id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          due_date: string
          event_id: string
          id?: string
          instance_id: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          due_date?: string
          event_id?: string
          id?: string
          instance_id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "followup_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_tasks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          instance_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          instance_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          instance_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_features_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          active: boolean | null
          address: string | null
          auto_confirm_reservations: boolean | null
          background_color: string | null
          booking_days_ahead: number
          created_at: string | null
          email: string | null
          google_maps_url: string | null
          id: string
          invoice_company_name: string | null
          logo_url: string | null
          name: string
          nip: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          sms_limit: number
          sms_used: number
          social_facebook: string | null
          social_instagram: string | null
          subdomain: string | null
          updated_at: string | null
          use_global_products: boolean
          website: string | null
          working_hours: Json | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          auto_confirm_reservations?: boolean | null
          background_color?: string | null
          booking_days_ahead?: number
          created_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          invoice_company_name?: string | null
          logo_url?: string | null
          name: string
          nip?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          sms_limit?: number
          sms_used?: number
          social_facebook?: string | null
          social_instagram?: string | null
          subdomain?: string | null
          updated_at?: string | null
          use_global_products?: boolean
          website?: string | null
          working_hours?: Json | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          auto_confirm_reservations?: boolean | null
          background_color?: string | null
          booking_days_ahead?: number
          created_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          invoice_company_name?: string | null
          logo_url?: string | null
          name?: string
          nip?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          sms_limit?: number
          sms_used?: number
          social_facebook?: string | null
          social_instagram?: string | null
          subdomain?: string | null
          updated_at?: string | null
          use_global_products?: boolean
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          instance_id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          instance_id: string
          read?: boolean
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          instance_id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_history: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          id: string
          new_data: Json | null
          offer_id: string
          old_data: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_data?: Json | null
          offer_id: string
          old_data?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_data?: Json | null
          offer_id?: string
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_history_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_option_items: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_name: string | null
          discount_percent: number
          id: string
          is_custom: boolean
          is_optional: boolean
          option_id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          discount_percent?: number
          id?: string
          is_custom?: boolean
          is_optional?: boolean
          option_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          discount_percent?: number
          id?: string
          is_custom?: boolean
          is_optional?: boolean
          option_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_option_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "offer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_option_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_library"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_selected: boolean
          is_upsell: boolean
          name: string
          offer_id: string
          parent_option_id: string | null
          scope_id: string | null
          sort_order: number
          subtotal_net: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_selected?: boolean
          is_upsell?: boolean
          name: string
          offer_id: string
          parent_option_id?: string | null
          scope_id?: string | null
          sort_order?: number
          subtotal_net?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_selected?: boolean
          is_upsell?: boolean
          name?: string
          offer_id?: string
          parent_option_id?: string | null
          scope_id?: string | null
          sort_order?: number
          subtotal_net?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_options_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_options_parent_option_id_fkey"
            columns: ["parent_option_id"]
            isOneToOne: false
            referencedRelation: "offer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_options_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "offer_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scope_extras: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          instance_id: string
          is_upsell: boolean
          name: string
          scope_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          is_upsell?: boolean
          name: string
          scope_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          is_upsell?: boolean
          name?: string
          scope_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scope_extras_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_extras_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scope_variant_products: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_name: string | null
          id: string
          instance_id: string
          product_id: string | null
          quantity: number
          scope_id: string
          sort_order: number | null
          unit: string
          unit_price: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          id?: string
          instance_id: string
          product_id?: string | null
          quantity?: number
          scope_id: string
          sort_order?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          id?: string
          instance_id?: string
          product_id?: string | null
          quantity?: number
          scope_id?: string
          sort_order?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scope_variant_products_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variant_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variant_products_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variant_products_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "offer_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scope_variants: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          scope_id: string
          sort_order: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          scope_id: string
          sort_order?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          scope_id?: string
          sort_order?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scope_variants_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variants_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variants_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "offer_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scopes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          has_coating_upsell: boolean
          id: string
          instance_id: string
          is_extras_scope: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          has_coating_upsell?: boolean
          id?: string
          instance_id: string
          is_extras_scope?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          has_coating_upsell?: boolean
          id?: string
          instance_id?: string
          is_extras_scope?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scopes_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_text_blocks: {
        Row: {
          block_id: string | null
          block_type: string
          content: string
          created_at: string
          id: string
          offer_id: string
          sort_order: number
        }
        Insert: {
          block_id?: string | null
          block_type?: string
          content: string
          created_at?: string
          id?: string
          offer_id: string
          sort_order?: number
        }
        Update: {
          block_id?: string | null
          block_type?: string
          content?: string
          created_at?: string
          id?: string
          offer_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "offer_text_blocks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "text_blocks_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_text_blocks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_variants: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_variants_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          customer_data: Json
          hide_unit_prices: boolean
          id: string
          instance_id: string
          notes: string | null
          offer_number: string
          payment_terms: string | null
          public_token: string
          responded_at: string | null
          selected_state: Json | null
          sent_at: string | null
          status: string
          total_gross: number
          total_net: number
          updated_at: string
          valid_until: string | null
          vat_rate: number
          vehicle_data: Json | null
          viewed_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_data?: Json
          hide_unit_prices?: boolean
          id?: string
          instance_id: string
          notes?: string | null
          offer_number: string
          payment_terms?: string | null
          public_token?: string
          responded_at?: string | null
          selected_state?: Json | null
          sent_at?: string | null
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vehicle_data?: Json | null
          viewed_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_data?: Json
          hide_unit_prices?: boolean
          id?: string
          instance_id?: string
          notes?: string | null
          offer_number?: string
          payment_terms?: string | null
          public_token?: string
          responded_at?: string | null
          selected_state?: Json | null
          sent_at?: string | null
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vehicle_data?: Json | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          error_message: string | null
          extracted_at: string | null
          file_path: string
          file_type: string
          id: string
          instance_id: string | null
          is_global: boolean | null
          name: string
          products_count: number | null
          salesperson_email: string | null
          salesperson_name: string | null
          salesperson_phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          extracted_at?: string | null
          file_path: string
          file_type: string
          id?: string
          instance_id?: string | null
          is_global?: boolean | null
          name: string
          products_count?: number | null
          salesperson_email?: string | null
          salesperson_name?: string | null
          salesperson_phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          extracted_at?: string | null
          file_path?: string
          file_type?: string
          id?: string
          instance_id?: string | null
          is_global?: boolean | null
          name?: string
          products_count?: number | null
          salesperson_email?: string | null
          salesperson_name?: string | null
          salesperson_phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      products_library: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          created_at: string
          default_price: number
          description: string | null
          id: string
          instance_id: string | null
          metadata: Json | null
          name: string
          sort_order: number | null
          source: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name: string
          sort_order?: number | null
          source?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name?: string
          sort_order?: number | null
          source?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_library_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          instance_id: string | null
          is_blocked: boolean
          phone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          instance_id?: string | null
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          instance_id?: string | null
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          car_size: Database["public"]["Enums"]["car_size"] | null
          confirmation_code: string
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          end_date: string | null
          end_time: string
          id: string
          instance_id: string
          notes: string | null
          price: number | null
          reservation_date: string
          service_id: string
          service_ids: Json | null
          source: string | null
          start_time: string
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          updated_at: string | null
          vehicle_plate: string
        }
        Insert: {
          car_size?: Database["public"]["Enums"]["car_size"] | null
          confirmation_code: string
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          end_date?: string | null
          end_time: string
          id?: string
          instance_id: string
          notes?: string | null
          price?: number | null
          reservation_date: string
          service_id: string
          service_ids?: Json | null
          source?: string | null
          start_time: string
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          updated_at?: string | null
          vehicle_plate: string
        }
        Update: {
          car_size?: Database["public"]["Enums"]["car_size"] | null
          confirmation_code?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          end_date?: string | null
          end_time?: string
          id?: string
          instance_id?: string
          notes?: string | null
          price?: number | null
          reservation_date?: string
          service_id?: string
          service_ids?: Json | null
          source?: string | null
          start_time?: string
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          updated_at?: string | null
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          instance_id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          category_id: string | null
          created_at: string | null
          description: string | null
          duration_large: number | null
          duration_medium: number | null
          duration_minutes: number | null
          duration_small: number | null
          id: string
          instance_id: string
          is_popular: boolean | null
          name: string
          price_from: number | null
          price_large: number | null
          price_medium: number | null
          price_small: number | null
          requires_size: boolean | null
          shortcut: string | null
          sort_order: number | null
          station_type: Database["public"]["Enums"]["station_type"] | null
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_large?: number | null
          duration_medium?: number | null
          duration_minutes?: number | null
          duration_small?: number | null
          id?: string
          instance_id: string
          is_popular?: boolean | null
          name: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          requires_size?: boolean | null
          shortcut?: string | null
          sort_order?: number | null
          station_type?: Database["public"]["Enums"]["station_type"] | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_large?: number | null
          duration_medium?: number | null
          duration_minutes?: number | null
          duration_small?: number | null
          id?: string
          instance_id?: string
          is_popular?: boolean | null
          name?: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          requires_size?: boolean | null
          shortcut?: string | null
          sort_order?: number | null
          station_type?: Database["public"]["Enums"]["station_type"] | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_message_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          instance_id: string
          message_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id: string
          message_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id?: string
          message_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_message_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          instance_id: string
          phone: string
          reservation_data: Json
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          instance_id: string
          phone: string
          reservation_data: Json
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          instance_id?: string
          phone?: string
          reservation_data?: Json
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_verification_codes_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          type: Database["public"]["Enums"]["station_type"]
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["station_type"]
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["station_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      text_blocks_library: {
        Row: {
          active: boolean
          block_type: string
          content: string
          created_at: string
          id: string
          instance_id: string | null
          name: string
          sort_order: number | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          block_type?: string
          content: string
          created_at?: string
          id?: string
          instance_id?: string | null
          name: string
          sort_order?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          block_type?: string
          content?: string
          created_at?: string
          id?: string
          instance_id?: string | null
          name?: string
          sort_order?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_blocks_library_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          instance_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          instance_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          instance_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_vehicles: {
        Row: {
          arrival_date: string
          car_size: Database["public"]["Enums"]["car_size"] | null
          created_at: string
          customer_name: string
          customer_phone: string
          deadline_time: string | null
          id: string
          instance_id: string
          notes: string | null
          service_ids: Json | null
          status: string
          updated_at: string
          vehicle_plate: string
        }
        Insert: {
          arrival_date?: string
          car_size?: Database["public"]["Enums"]["car_size"] | null
          created_at?: string
          customer_name: string
          customer_phone: string
          deadline_time?: string | null
          id?: string
          instance_id: string
          notes?: string | null
          service_ids?: Json | null
          status?: string
          updated_at?: string
          vehicle_plate: string
        }
        Update: {
          arrival_date?: string
          car_size?: Database["public"]["Enums"]["car_size"] | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          deadline_time?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
          service_ids?: Json | null
          status?: string
          updated_at?: string
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "yard_vehicles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_sms_available: { Args: { _instance_id: string }; Returns: boolean }
      generate_offer_number: { Args: { _instance_id: string }; Returns: string }
      get_availability_blocks: {
        Args: { _from: string; _instance_id: string; _to: string }
        Returns: {
          block_date: string
          end_time: string
          start_time: string
          station_id: string
        }[]
      }
      has_employee_permission: {
        Args: { _feature_key: string; _instance_id: string; _user_id: string }
        Returns: boolean
      }
      has_instance_role: {
        Args: {
          _instance_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_sms_usage: { Args: { _instance_id: string }; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      update_instance_working_hours: {
        Args: { _instance_id: string; _working_hours: Json }
        Returns: Json
      }
      upsert_customer_vehicle: {
        Args: {
          _customer_id?: string
          _instance_id: string
          _model: string
          _phone: string
          _plate?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user" | "employee"
      car_size: "small" | "medium" | "large"
      reservation_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "released"
      service_category:
        | "car_wash"
        | "ppf"
        | "detailing"
        | "upholstery"
        | "other"
      station_type: "washing" | "ppf" | "detailing" | "universal"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["super_admin", "admin", "user", "employee"],
      car_size: ["small", "medium", "large"],
      reservation_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "released",
      ],
      service_category: ["car_wash", "ppf", "detailing", "upholstery", "other"],
      station_type: ["washing", "ppf", "detailing", "universal"],
    },
  },
} as const
