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
      car_models: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          id: string
          name: string
          size: string
          sort_order: number | null
          status: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand: string
          created_at?: string
          id?: string
          name: string
          size: string
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          id?: string
          name?: string
          size?: string
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      customer_reminders: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string
          id: string
          instance_id: string
          months_after: number
          reminder_template_id: string
          reservation_id: string | null
          scheduled_date: string
          sent_at: string | null
          service_type: string
          status: string
          updated_at: string | null
          vehicle_plate: string
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          instance_id: string
          months_after: number
          reminder_template_id: string
          reservation_id?: string | null
          scheduled_date: string
          sent_at?: string | null
          service_type: string
          status?: string
          updated_at?: string | null
          vehicle_plate?: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          instance_id?: string
          months_after?: number
          reminder_template_id?: string
          reservation_id?: string | null
          scheduled_date?: string
          sent_at?: string | null
          service_type?: string
          status?: string
          updated_at?: string | null
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_reminders_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reminders_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_reminders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_vehicles: {
        Row: {
          car_size: string | null
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
          car_size?: string | null
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
          car_size?: string | null
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
          discount_percent: number | null
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
          discount_percent?: number | null
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
          discount_percent?: number | null
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
      employee_breaks: {
        Row: {
          break_date: string
          created_at: string | null
          duration_minutes: number | null
          employee_id: string
          end_time: string
          id: string
          instance_id: string
          start_time: string
        }
        Insert: {
          break_date: string
          created_at?: string | null
          duration_minutes?: number | null
          employee_id: string
          end_time: string
          id?: string
          instance_id: string
          start_time: string
        }
        Update: {
          break_date?: string
          created_at?: string | null
          duration_minutes?: number | null
          employee_id?: string
          end_time?: string
          id?: string
          instance_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_breaks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_breaks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_days_off: {
        Row: {
          created_at: string | null
          date_from: string
          date_to: string
          day_off_type: string
          employee_id: string
          id: string
          instance_id: string
        }
        Insert: {
          created_at?: string | null
          date_from: string
          date_to: string
          day_off_type?: string
          employee_id: string
          id?: string
          instance_id: string
        }
        Update: {
          created_at?: string | null
          date_from?: string
          date_to?: string
          day_off_type?: string
          employee_id?: string
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_days_off_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_days_off_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_edit_logs: {
        Row: {
          edited_at: string | null
          edited_by: string | null
          entity_id: string
          entity_type: string
          id: string
          instance_id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          edited_at?: string | null
          edited_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          instance_id: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          edited_at?: string | null
          edited_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          instance_id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_edit_logs_instance_id_fkey"
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
      employees: {
        Row: {
          active: boolean
          created_at: string | null
          deleted_at: string | null
          hourly_rate: number | null
          id: string
          instance_id: string
          name: string
          photo_url: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          deleted_at?: string | null
          hourly_rate?: number | null
          id?: string
          instance_id: string
          name: string
          photo_url?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          deleted_at?: string | null
          hourly_rate?: number | null
          id?: string
          instance_id?: string
          name?: string
          photo_url?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_instance_id_fkey"
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
      halls: {
        Row: {
          active: boolean | null
          allowed_actions: Json | null
          created_at: string | null
          id: string
          instance_id: string
          name: string
          slug: string
          sort_order: number | null
          station_ids: string[] | null
          updated_at: string | null
          visible_fields: Json | null
        }
        Insert: {
          active?: boolean | null
          allowed_actions?: Json | null
          created_at?: string | null
          id?: string
          instance_id: string
          name: string
          slug: string
          sort_order?: number | null
          station_ids?: string[] | null
          updated_at?: string | null
          visible_fields?: Json | null
        }
        Update: {
          active?: boolean | null
          allowed_actions?: Json | null
          created_at?: string | null
          id?: string
          instance_id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          station_ids?: string[] | null
          updated_at?: string | null
          visible_fields?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "halls_instance_id_fkey"
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
          parameters: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          instance_id: string
          parameters?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          instance_id?: string
          parameters?: Json | null
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
      instance_subscriptions: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string
          instance_id: string
          is_trial: boolean | null
          monthly_price: number | null
          plan_id: string
          starts_at: string
          station_limit: number
          status: string | null
          trial_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          instance_id: string
          is_trial?: boolean | null
          monthly_price?: number | null
          plan_id: string
          starts_at?: string
          station_limit?: number
          status?: string | null
          trial_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          instance_id?: string
          is_trial?: boolean | null
          monthly_price?: number | null
          plan_id?: string
          starts_at?: string
          station_limit?: number
          status?: string | null
          trial_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_subscriptions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          active: boolean | null
          address: string | null
          assign_employees_to_reservations: boolean | null
          assign_employees_to_stations: boolean | null
          auto_confirm_reservations: boolean | null
          background_color: string | null
          booking_days_ahead: number
          contact_person: string | null
          created_at: string | null
          customer_edit_cutoff_hours: number | null
          deleted_at: string | null
          email: string | null
          google_maps_url: string | null
          id: string
          invoice_company_name: string | null
          logo_url: string | null
          name: string
          nip: string | null
          offer_bank_account_number: string | null
          offer_bank_company_name: string | null
          offer_bank_name: string | null
          offer_bg_color: string | null
          offer_branding_enabled: boolean
          offer_default_notes: string | null
          offer_default_payment_terms: string | null
          offer_default_service_info: string | null
          offer_default_warranty: string | null
          offer_email_template: string | null
          offer_google_reviews_url: string | null
          offer_header_bg_color: string | null
          offer_header_text_color: string | null
          offer_portfolio_url: string | null
          offer_primary_color: string | null
          offer_scope_header_text_color: string | null
          offer_section_bg_color: string | null
          offer_section_text_color: string | null
          offer_trust_description: string | null
          offer_trust_header_title: string | null
          offer_trust_tiles: Json | null
          phone: string | null
          primary_color: string | null
          protocol_email_template: string | null
          public_api_key: string | null
          reservation_phone: string | null
          secondary_color: string | null
          short_name: string | null
          show_unit_prices_in_offer: boolean
          slug: string
          sms_limit: number
          sms_used: number
          social_facebook: string | null
          social_instagram: string | null
          subdomain: string | null
          timezone: string | null
          updated_at: string | null
          use_global_products: boolean
          website: string | null
          widget_config: Json | null
          working_hours: Json | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          assign_employees_to_reservations?: boolean | null
          assign_employees_to_stations?: boolean | null
          auto_confirm_reservations?: boolean | null
          background_color?: string | null
          booking_days_ahead?: number
          contact_person?: string | null
          created_at?: string | null
          customer_edit_cutoff_hours?: number | null
          deleted_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          invoice_company_name?: string | null
          logo_url?: string | null
          name: string
          nip?: string | null
          offer_bank_account_number?: string | null
          offer_bank_company_name?: string | null
          offer_bank_name?: string | null
          offer_bg_color?: string | null
          offer_branding_enabled?: boolean
          offer_default_notes?: string | null
          offer_default_payment_terms?: string | null
          offer_default_service_info?: string | null
          offer_default_warranty?: string | null
          offer_email_template?: string | null
          offer_google_reviews_url?: string | null
          offer_header_bg_color?: string | null
          offer_header_text_color?: string | null
          offer_portfolio_url?: string | null
          offer_primary_color?: string | null
          offer_scope_header_text_color?: string | null
          offer_section_bg_color?: string | null
          offer_section_text_color?: string | null
          offer_trust_description?: string | null
          offer_trust_header_title?: string | null
          offer_trust_tiles?: Json | null
          phone?: string | null
          primary_color?: string | null
          protocol_email_template?: string | null
          public_api_key?: string | null
          reservation_phone?: string | null
          secondary_color?: string | null
          short_name?: string | null
          show_unit_prices_in_offer?: boolean
          slug: string
          sms_limit?: number
          sms_used?: number
          social_facebook?: string | null
          social_instagram?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
          use_global_products?: boolean
          website?: string | null
          widget_config?: Json | null
          working_hours?: Json | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          assign_employees_to_reservations?: boolean | null
          assign_employees_to_stations?: boolean | null
          auto_confirm_reservations?: boolean | null
          background_color?: string | null
          booking_days_ahead?: number
          contact_person?: string | null
          created_at?: string | null
          customer_edit_cutoff_hours?: number | null
          deleted_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          id?: string
          invoice_company_name?: string | null
          logo_url?: string | null
          name?: string
          nip?: string | null
          offer_bank_account_number?: string | null
          offer_bank_company_name?: string | null
          offer_bank_name?: string | null
          offer_bg_color?: string | null
          offer_branding_enabled?: boolean
          offer_default_notes?: string | null
          offer_default_payment_terms?: string | null
          offer_default_service_info?: string | null
          offer_default_warranty?: string | null
          offer_email_template?: string | null
          offer_google_reviews_url?: string | null
          offer_header_bg_color?: string | null
          offer_header_text_color?: string | null
          offer_portfolio_url?: string | null
          offer_primary_color?: string | null
          offer_scope_header_text_color?: string | null
          offer_section_bg_color?: string | null
          offer_section_text_color?: string | null
          offer_trust_description?: string | null
          offer_trust_header_title?: string | null
          offer_trust_tiles?: Json | null
          phone?: string | null
          primary_color?: string | null
          protocol_email_template?: string | null
          public_api_key?: string | null
          reservation_phone?: string | null
          secondary_color?: string | null
          short_name?: string | null
          show_unit_prices_in_offer?: boolean
          slug?: string
          sms_limit?: number
          sms_used?: number
          social_facebook?: string | null
          social_instagram?: string | null
          subdomain?: string | null
          timezone?: string | null
          updated_at?: string | null
          use_global_products?: boolean
          website?: string | null
          widget_config?: Json | null
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
            foreignKeyName: "offer_option_items_unified_service_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
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
      offer_product_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_product_categories_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_reminders: {
        Row: {
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          instance_id: string
          is_paid: boolean
          months_after: number
          offer_id: string | null
          product_id: string | null
          scheduled_date: string
          sent_at: string | null
          service_name: string
          service_type: string
          sms_template: string
          status: string
          vehicle_info: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          instance_id: string
          is_paid?: boolean
          months_after: number
          offer_id?: string | null
          product_id?: string | null
          scheduled_date: string
          sent_at?: string | null
          service_name: string
          service_type: string
          sms_template: string
          status?: string
          vehicle_info?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          instance_id?: string
          is_paid?: boolean
          months_after?: number
          offer_id?: string | null
          product_id?: string | null
          scheduled_date?: string
          sent_at?: string | null
          service_name?: string
          service_type?: string
          sms_template?: string
          status?: string
          vehicle_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_reminders_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_reminders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_reminders_unified_service_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_scope_extra_products: {
        Row: {
          created_at: string
          custom_description: string | null
          custom_name: string | null
          extra_id: string
          id: string
          instance_id: string
          product_id: string | null
          quantity: number
          sort_order: number | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          extra_id: string
          id?: string
          instance_id: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_description?: string | null
          custom_name?: string | null
          extra_id?: string
          id?: string
          instance_id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scope_extra_products_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "offer_scope_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_extra_products_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_extra_products_unified_service_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
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
      offer_scope_products: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          is_default: boolean
          product_id: string
          scope_id: string
          sort_order: number
          updated_at: string
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          is_default?: boolean
          product_id: string
          scope_id: string
          sort_order?: number
          updated_at?: string
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          is_default?: boolean
          product_id?: string
          scope_id?: string
          sort_order?: number
          updated_at?: string
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_scope_products_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_products_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_products_unified_service_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
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
            foreignKeyName: "offer_scope_variant_products_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "offer_scopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_scope_variant_products_unified_service_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
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
          available_durations: number[] | null
          created_at: string
          default_notes: string | null
          default_payment_terms: string | null
          default_service_info: string | null
          default_warranty: string | null
          description: string | null
          has_coating_upsell: boolean
          has_unified_services: boolean | null
          id: string
          instance_id: string | null
          is_extras_scope: boolean
          name: string
          price_from: number | null
          short_name: string | null
          sort_order: number | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_durations?: number[] | null
          created_at?: string
          default_notes?: string | null
          default_payment_terms?: string | null
          default_service_info?: string | null
          default_warranty?: string | null
          description?: string | null
          has_coating_upsell?: boolean
          has_unified_services?: boolean | null
          id?: string
          instance_id?: string | null
          is_extras_scope?: boolean
          name: string
          price_from?: number | null
          short_name?: string | null
          sort_order?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_durations?: number[] | null
          created_at?: string
          default_notes?: string | null
          default_payment_terms?: string | null
          default_service_info?: string | null
          default_warranty?: string | null
          description?: string | null
          has_coating_upsell?: boolean
          has_unified_services?: boolean | null
          id?: string
          instance_id?: string | null
          is_extras_scope?: boolean
          name?: string
          price_from?: number | null
          short_name?: string | null
          sort_order?: number | null
          source?: string
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
      offer_views: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          instance_id: string
          is_admin_preview: boolean
          offer_id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          instance_id: string
          is_admin_preview?: boolean
          offer_id: string
          started_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          instance_id?: string
          is_admin_preview?: boolean
          offer_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_views_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          admin_approved_gross: number | null
          admin_approved_net: number | null
          approved_at: string | null
          approved_by: string | null
          budget_suggestion: number | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          customer_data: Json
          follow_up_phone_status: string | null
          has_unified_services: boolean | null
          hide_unit_prices: boolean
          id: string
          inquiry_notes: string | null
          instance_id: string
          internal_notes: string | null
          notes: string | null
          offer_number: string
          paint_color: string | null
          paint_finish: string | null
          payment_terms: string | null
          planned_date: string | null
          public_token: string
          rejected_at: string | null
          responded_at: string | null
          selected_state: Json | null
          sent_at: string | null
          service_info: string | null
          source: string | null
          status: string
          total_gross: number
          total_net: number
          updated_at: string
          valid_until: string | null
          vat_rate: number
          vehicle_data: Json | null
          viewed_at: string | null
          warranty: string | null
          widget_duration_selections: Json | null
          widget_selected_extras: string[] | null
        }
        Insert: {
          admin_approved_gross?: number | null
          admin_approved_net?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budget_suggestion?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_data?: Json
          follow_up_phone_status?: string | null
          has_unified_services?: boolean | null
          hide_unit_prices?: boolean
          id?: string
          inquiry_notes?: string | null
          instance_id: string
          internal_notes?: string | null
          notes?: string | null
          offer_number: string
          paint_color?: string | null
          paint_finish?: string | null
          payment_terms?: string | null
          planned_date?: string | null
          public_token?: string
          rejected_at?: string | null
          responded_at?: string | null
          selected_state?: Json | null
          sent_at?: string | null
          service_info?: string | null
          source?: string | null
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vehicle_data?: Json | null
          viewed_at?: string | null
          warranty?: string | null
          widget_duration_selections?: Json | null
          widget_selected_extras?: string[] | null
        }
        Update: {
          admin_approved_gross?: number | null
          admin_approved_net?: number | null
          approved_at?: string | null
          approved_by?: string | null
          budget_suggestion?: number | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_data?: Json
          follow_up_phone_status?: string | null
          has_unified_services?: boolean | null
          hide_unit_prices?: boolean
          id?: string
          inquiry_notes?: string | null
          instance_id?: string
          internal_notes?: string | null
          notes?: string | null
          offer_number?: string
          paint_color?: string | null
          paint_finish?: string | null
          payment_terms?: string | null
          planned_date?: string | null
          public_token?: string
          rejected_at?: string | null
          responded_at?: string | null
          selected_state?: Json | null
          sent_at?: string | null
          service_info?: string | null
          source?: string | null
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vehicle_data?: Json | null
          viewed_at?: string | null
          warranty?: string | null
          widget_duration_selections?: Json | null
          widget_selected_extras?: string[] | null
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
      paint_colors: {
        Row: {
          active: boolean | null
          brand: string | null
          color_code: string | null
          color_family: string | null
          created_at: string | null
          id: string
          name: string
          paint_type: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          brand?: string | null
          color_code?: string | null
          color_family?: string | null
          created_at?: string | null
          id?: string
          name: string
          paint_type?: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          brand?: string | null
          color_code?: string | null
          color_family?: string | null
          created_at?: string | null
          id?: string
          name?: string
          paint_type?: string
          sort_order?: number | null
        }
        Relationships: []
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
          default_payment_terms: string | null
          default_price: number
          default_service_info: string | null
          default_validity_days: number | null
          default_warranty_terms: string | null
          description: string | null
          id: string
          instance_id: string | null
          metadata: Json | null
          name: string
          reminder_template_id: string | null
          short_name: string | null
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
          default_payment_terms?: string | null
          default_price?: number
          default_service_info?: string | null
          default_validity_days?: number | null
          default_warranty_terms?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name: string
          reminder_template_id?: string | null
          short_name?: string | null
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
          default_payment_terms?: string | null
          default_price?: number
          default_service_info?: string | null
          default_validity_days?: number | null
          default_warranty_terms?: string | null
          description?: string | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name?: string
          reminder_template_id?: string | null
          short_name?: string | null
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
          {
            foreignKeyName: "products_library_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
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
      protocol_damage_points: {
        Row: {
          created_at: string
          custom_note: string | null
          damage_type: string | null
          id: string
          photo_url: string | null
          photo_urls: string[] | null
          protocol_id: string
          view: string
          x_percent: number
          y_percent: number
        }
        Insert: {
          created_at?: string
          custom_note?: string | null
          damage_type?: string | null
          id?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          protocol_id: string
          view: string
          x_percent: number
          y_percent: number
        }
        Update: {
          created_at?: string
          custom_note?: string | null
          damage_type?: string | null
          id?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          protocol_id?: string
          view?: string
          x_percent?: number
          y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocol_damage_points_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "vehicle_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          instance_id: string | null
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          instance_id?: string | null
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          instance_id?: string | null
          p256dh?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instance_id: string
          items: Json
          name: string
          sms_template: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id: string
          items?: Json
          name: string
          sms_template?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string
          items?: Json
          name?: string
          sms_template?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_changes: {
        Row: {
          batch_id: string
          change_type: string
          changed_by: string | null
          changed_by_type: string
          changed_by_username: string
          created_at: string | null
          field_name: string | null
          id: string
          instance_id: string
          new_value: Json
          old_value: Json | null
          reservation_id: string | null
        }
        Insert: {
          batch_id: string
          change_type: string
          changed_by?: string | null
          changed_by_type?: string
          changed_by_username: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          instance_id: string
          new_value: Json
          old_value?: Json | null
          reservation_id?: string | null
        }
        Update: {
          batch_id?: string
          change_type?: string
          changed_by?: string | null
          changed_by_type?: string
          changed_by_username?: string
          created_at?: string | null
          field_name?: string | null
          id?: string
          instance_id?: string
          new_value?: Json
          old_value?: Json | null
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_changes_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_changes_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          instance_id: string | null
          reservation_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          instance_id?: string | null
          reservation_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          instance_id?: string | null
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          admin_notes: string | null
          assigned_employee_ids: Json | null
          cancelled_at: string | null
          cancelled_by: string | null
          car_size: Database["public"]["Enums"]["car_size"] | null
          change_request_note: string | null
          checked_service_ids: Json | null
          completed_at: string | null
          confirmation_code: string
          confirmation_sms_sent_at: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by: string | null
          created_by_username: string | null
          customer_email: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          edited_by_customer_at: string | null
          end_date: string | null
          end_time: string
          has_unified_services: boolean | null
          id: string
          instance_id: string
          no_show_at: string | null
          offer_number: string | null
          original_reservation_id: string | null
          photo_urls: string[] | null
          pickup_sms_sent_at: string | null
          price: number | null
          released_at: string | null
          reminder_1day_last_attempt_at: string | null
          reminder_1day_sent: boolean | null
          reminder_1hour_last_attempt_at: string | null
          reminder_1hour_sent: boolean | null
          reminder_failure_count: number | null
          reminder_failure_reason: string | null
          reminder_permanent_failure: boolean | null
          reservation_date: string
          service_id: string | null
          service_ids: Json | null
          service_items: Json | null
          source: string | null
          start_time: string
          started_at: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
          updated_at: string | null
          vehicle_plate: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_employee_ids?: Json | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          car_size?: Database["public"]["Enums"]["car_size"] | null
          change_request_note?: string | null
          checked_service_ids?: Json | null
          completed_at?: string | null
          confirmation_code: string
          confirmation_sms_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_username?: string | null
          customer_email?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          edited_by_customer_at?: string | null
          end_date?: string | null
          end_time: string
          has_unified_services?: boolean | null
          id?: string
          instance_id: string
          no_show_at?: string | null
          offer_number?: string | null
          original_reservation_id?: string | null
          photo_urls?: string[] | null
          pickup_sms_sent_at?: string | null
          price?: number | null
          released_at?: string | null
          reminder_1day_last_attempt_at?: string | null
          reminder_1day_sent?: boolean | null
          reminder_1hour_last_attempt_at?: string | null
          reminder_1hour_sent?: boolean | null
          reminder_failure_count?: number | null
          reminder_failure_reason?: string | null
          reminder_permanent_failure?: boolean | null
          reservation_date: string
          service_id?: string | null
          service_ids?: Json | null
          service_items?: Json | null
          source?: string | null
          start_time: string
          started_at?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
          updated_at?: string | null
          vehicle_plate: string
        }
        Update: {
          admin_notes?: string | null
          assigned_employee_ids?: Json | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          car_size?: Database["public"]["Enums"]["car_size"] | null
          change_request_note?: string | null
          checked_service_ids?: Json | null
          completed_at?: string | null
          confirmation_code?: string
          confirmation_sms_sent_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_username?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          edited_by_customer_at?: string | null
          end_date?: string | null
          end_time?: string
          has_unified_services?: boolean | null
          id?: string
          instance_id?: string
          no_show_at?: string | null
          offer_number?: string | null
          original_reservation_id?: string | null
          photo_urls?: string[] | null
          pickup_sms_sent_at?: string | null
          price?: number | null
          released_at?: string | null
          reminder_1day_last_attempt_at?: string | null
          reminder_1day_sent?: boolean | null
          reminder_1hour_last_attempt_at?: string | null
          reminder_1hour_sent?: boolean | null
          reminder_failure_count?: number | null
          reminder_failure_reason?: string | null
          reminder_permanent_failure?: boolean | null
          reservation_date?: string
          service_id?: string | null
          service_ids?: Json | null
          service_items?: Json | null
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
            foreignKeyName: "reservations_original_reservation_id_fkey"
            columns: ["original_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
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
          prices_are_net: boolean
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
          prices_are_net?: boolean
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
          prices_are_net?: boolean
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
          category_id: string
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
          category_id: string
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
          category_id?: string
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
      sms_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          instance_id: string
          message: string
          message_type: string
          phone: string
          reservation_id: string | null
          sent_by: string | null
          smsapi_response: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          instance_id: string
          message: string
          message_type: string
          phone: string
          reservation_id?: string | null
          sent_by?: string | null
          smsapi_response?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string
          message?: string
          message_type?: string
          phone?: string
          reservation_id?: string | null
          sent_by?: string | null
          smsapi_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_instance_id_fkey"
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
          send_at_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id: string
          message_type: string
          send_at_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id?: string
          message_type?: string
          send_at_time?: string | null
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
      station_employees: {
        Row: {
          created_at: string | null
          employee_id: string
          id: string
          station_id: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          id?: string
          station_id: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "station_employees_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          type: Database["public"]["Enums"]["station_type"]
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["station_type"]
        }
        Update: {
          active?: boolean | null
          color?: string | null
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
      subscription_plans: {
        Row: {
          active: boolean | null
          base_price: number
          created_at: string | null
          description: string | null
          id: string
          included_features: Json
          name: string
          price_per_station: number
          slug: string
          sms_limit: number
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          base_price: number
          created_at?: string | null
          description?: string | null
          id?: string
          included_features?: Json
          name: string
          price_per_station?: number
          slug: string
          sms_limit?: number
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          base_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          included_features?: Json
          name?: string
          price_per_station?: number
          slug?: string
          sms_limit?: number
          sort_order?: number | null
        }
        Relationships: []
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
      time_entries: {
        Row: {
          created_at: string | null
          employee_id: string
          end_time: string | null
          entry_date: string
          entry_number: number
          entry_type: string
          id: string
          instance_id: string
          is_auto_closed: boolean | null
          start_time: string | null
          total_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          end_time?: string | null
          entry_date: string
          entry_number?: number
          entry_type?: string
          id?: string
          instance_id: string
          is_auto_closed?: boolean | null
          start_time?: string | null
          total_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          end_time?: string | null
          entry_date?: string
          entry_number?: number
          entry_type?: string
          id?: string
          instance_id?: string
          is_auto_closed?: boolean | null
          start_time?: string | null
          total_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      training_types: {
        Row: {
          active: boolean
          created_at: string
          duration_days: number
          id: string
          instance_id: string
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          duration_days?: number
          id?: string
          instance_id: string
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          duration_days?: number
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_types_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          assigned_employee_ids: Json | null
          created_at: string | null
          created_by: string | null
          created_by_username: string | null
          description: string | null
          end_date: string | null
          end_time: string
          id: string
          instance_id: string
          photo_urls: string[] | null
          start_date: string
          start_time: string
          station_id: string | null
          status: string
          title: string
          training_type: Database["public"]["Enums"]["training_type"]
          training_type_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_employee_ids?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_by_username?: string | null
          description?: string | null
          end_date?: string | null
          end_time: string
          id?: string
          instance_id: string
          photo_urls?: string[] | null
          start_date: string
          start_time: string
          station_id?: string | null
          status?: string
          title: string
          training_type?: Database["public"]["Enums"]["training_type"]
          training_type_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_employee_ids?: Json | null
          created_at?: string | null
          created_by?: string | null
          created_by_username?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          instance_id?: string
          photo_urls?: string[] | null
          start_date?: string
          start_time?: string
          station_id?: string | null
          status?: string
          title?: string
          training_type?: Database["public"]["Enums"]["training_type"]
          training_type_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainings_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_training_type_id_fkey"
            columns: ["training_type_id"]
            isOneToOne: false
            referencedRelation: "training_types"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_categories: {
        Row: {
          active: boolean | null
          category_type: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          instance_id: string
          name: string
          prices_are_net: boolean | null
          slug: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category_type: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          instance_id: string
          name: string
          prices_are_net?: boolean | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category_type?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          prices_are_net?: boolean | null
          slug?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_categories_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_services: {
        Row: {
          active: boolean | null
          category_id: string | null
          created_at: string
          default_payment_terms: string | null
          default_price: number | null
          default_service_info: string | null
          default_validity_days: number | null
          default_warranty_terms: string | null
          deleted_at: string | null
          description: string | null
          duration_large: number | null
          duration_medium: number | null
          duration_minutes: number | null
          duration_small: number | null
          id: string
          instance_id: string
          is_popular: boolean | null
          metadata: Json | null
          name: string
          price_from: number | null
          price_large: number | null
          price_medium: number | null
          price_small: number | null
          prices_are_net: boolean | null
          reminder_template_id: string | null
          requires_size: boolean | null
          service_type: string | null
          short_name: string | null
          shortcut: string | null
          sort_order: number | null
          station_type: string | null
          unit: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string
          default_payment_terms?: string | null
          default_price?: number | null
          default_service_info?: string | null
          default_validity_days?: number | null
          default_warranty_terms?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_large?: number | null
          duration_medium?: number | null
          duration_minutes?: number | null
          duration_small?: number | null
          id?: string
          instance_id: string
          is_popular?: boolean | null
          metadata?: Json | null
          name: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          prices_are_net?: boolean | null
          reminder_template_id?: string | null
          requires_size?: boolean | null
          service_type?: string | null
          short_name?: string | null
          shortcut?: string | null
          sort_order?: number | null
          station_type?: string | null
          unit?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string
          default_payment_terms?: string | null
          default_price?: number | null
          default_service_info?: string | null
          default_validity_days?: number | null
          default_warranty_terms?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_large?: number | null
          duration_medium?: number | null
          duration_minutes?: number | null
          duration_small?: number | null
          id?: string
          instance_id?: string
          is_popular?: boolean | null
          metadata?: Json | null
          name?: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          prices_are_net?: boolean | null
          reminder_template_id?: string | null
          requires_size?: boolean | null
          service_type?: string | null
          short_name?: string | null
          shortcut?: string | null
          sort_order?: number | null
          station_type?: string | null
          unit?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unified_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "unified_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_services_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_services_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          hall_id: string | null
          id: string
          instance_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          hall_id?: string | null
          id?: string
          instance_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          hall_id?: string | null
          id?: string
          instance_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_hall_id_fkey"
            columns: ["hall_id"]
            isOneToOne: false
            referencedRelation: "halls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_protocols: {
        Row: {
          body_type: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_signature: string | null
          fuel_level: number | null
          id: string
          instance_id: string
          nip: string | null
          notes: string | null
          odometer_reading: number | null
          offer_id: string | null
          offer_number: string | null
          phone: string | null
          photo_urls: string[] | null
          protocol_date: string
          protocol_time: string | null
          protocol_type: string
          public_token: string
          received_by: string | null
          registration_number: string | null
          reservation_id: string | null
          status: string
          updated_at: string
          vehicle_model: string | null
        }
        Insert: {
          body_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_signature?: string | null
          fuel_level?: number | null
          id?: string
          instance_id: string
          nip?: string | null
          notes?: string | null
          odometer_reading?: number | null
          offer_id?: string | null
          offer_number?: string | null
          phone?: string | null
          photo_urls?: string[] | null
          protocol_date?: string
          protocol_time?: string | null
          protocol_type?: string
          public_token: string
          received_by?: string | null
          registration_number?: string | null
          reservation_id?: string | null
          status?: string
          updated_at?: string
          vehicle_model?: string | null
        }
        Update: {
          body_type?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_signature?: string | null
          fuel_level?: number | null
          id?: string
          instance_id?: string
          nip?: string | null
          notes?: string | null
          odometer_reading?: number | null
          offer_id?: string | null
          offer_number?: string | null
          phone?: string | null
          photo_urls?: string[] | null
          protocol_date?: string
          protocol_time?: string | null
          protocol_type?: string
          public_token?: string
          received_by?: string | null
          registration_number?: string | null
          reservation_id?: string | null
          status?: string
          updated_at?: string
          vehicle_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_protocols_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_protocols_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_protocols_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      workers_settings: {
        Row: {
          breaks_enabled: boolean
          created_at: string | null
          instance_id: string
          overtime_enabled: boolean
          report_email: string | null
          report_frequency: string | null
          standard_hours_per_day: number
          start_stop_enabled: boolean
          time_calculation_mode: string
          updated_at: string | null
        }
        Insert: {
          breaks_enabled?: boolean
          created_at?: string | null
          instance_id: string
          overtime_enabled?: boolean
          report_email?: string | null
          report_frequency?: string | null
          standard_hours_per_day?: number
          start_stop_enabled?: boolean
          time_calculation_mode?: string
          updated_at?: string | null
        }
        Update: {
          breaks_enabled?: boolean
          created_at?: string | null
          instance_id?: string
          overtime_enabled?: boolean
          report_email?: string | null
          report_frequency?: string | null
          standard_hours_per_day?: number
          start_stop_enabled?: boolean
          time_calculation_mode?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
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
          pickup_date: string | null
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
          pickup_date?: string | null
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
          pickup_date?: string | null
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
      can_access_instance: { Args: { _instance_id: string }; Returns: boolean }
      cancel_reservation_by_code: {
        Args: { _confirmation_code: string }
        Returns: boolean
      }
      check_sms_available: { Args: { _instance_id: string }; Returns: boolean }
      claim_reminder_1day: {
        Args: {
          p_backoff_threshold: string
          p_now: string
          p_reservation_id: string
        }
        Returns: boolean
      }
      claim_reminder_1hour: {
        Args: {
          p_backoff_threshold: string
          p_now: string
          p_reservation_id: string
        }
        Returns: boolean
      }
      copy_global_scopes_to_instance: {
        Args: { _instance_id: string }
        Returns: number
      }
      create_offer_reminders: {
        Args: { p_completed_at: string; p_offer_id: string }
        Returns: number
      }
      create_reservation_reminders: {
        Args: { p_reservation_id: string }
        Returns: number
      }
      generate_offer_number: { Args: { _instance_id: string }; Returns: string }
      generate_protocol_token: { Args: never; Returns: string }
      generate_short_token: { Args: never; Returns: string }
      get_availability_blocks: {
        Args: { _from: string; _instance_id: string; _to: string }
        Returns: {
          block_date: string
          end_time: string
          start_time: string
          station_id: string
        }[]
      }
      get_offer_instance_id: { Args: { p_offer_id: string }; Returns: string }
      get_option_instance_id: { Args: { p_option_id: string }; Returns: string }
      get_reservation_instance_id: {
        Args: { p_reservation_id: string }
        Returns: string
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
      is_super_admin: { Args: never; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      request_reservation_change_by_code: {
        Args: {
          _new_reservation_date: string
          _new_service_id: string
          _new_start_time: string
          _new_station_id?: string
          _original_confirmation_code: string
        }
        Returns: {
          confirmation_code: string
          id: string
        }[]
      }
      update_instance_working_hours: {
        Args: { _instance_id: string; _working_hours: Json }
        Returns: Json
      }
      upsert_customer_vehicle:
        | {
            Args: {
              _customer_id?: string
              _instance_id: string
              _model: string
              _phone: string
              _plate?: string
            }
            Returns: string
          }
        | {
            Args: {
              _car_size?: string
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
      app_role: "super_admin" | "admin" | "user" | "employee" | "hall"
      car_size: "small" | "medium" | "large"
      reservation_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "released"
        | "no_show"
        | "change_requested"
      service_category:
        | "car_wash"
        | "ppf"
        | "detailing"
        | "upholstery"
        | "other"
      station_type: "washing" | "ppf" | "detailing" | "universal"
      training_type: "group_basic" | "individual" | "master"
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
      app_role: ["super_admin", "admin", "user", "employee", "hall"],
      car_size: ["small", "medium", "large"],
      reservation_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "released",
        "no_show",
        "change_requested",
      ],
      service_category: ["car_wash", "ppf", "detailing", "upholstery", "other"],
      station_type: ["washing", "ppf", "detailing", "universal"],
      training_type: ["group_basic", "individual", "master"],
    },
  },
} as const
