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
          created_at: string | null
          email: string | null
          id: string
          instance_id: string
          name: string
          notes: string | null
          phone: string
          phone_verified: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          instance_id: string
          name: string
          notes?: string | null
          phone: string
          phone_verified?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          instance_id?: string
          name?: string
          notes?: string | null
          phone?: string
          phone_verified?: boolean | null
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
      instances: {
        Row: {
          active: boolean | null
          address: string | null
          auto_confirm_reservations: boolean | null
          background_color: string | null
          booking_days_ahead: number
          created_at: string | null
          email: string | null
          id: string
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
          updated_at: string | null
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
          id?: string
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
          updated_at?: string | null
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
          id?: string
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
          updated_at?: string | null
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          instance_id: string | null
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
          source: string | null
          start_time: string
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
          source?: string | null
          start_time: string
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
          source?: string | null
          start_time?: string
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
          duration_minutes: number | null
          id: string
          instance_id: string
          name: string
          price_from: number | null
          price_large: number | null
          price_medium: number | null
          price_small: number | null
          requires_size: boolean | null
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
          duration_minutes?: number | null
          id?: string
          instance_id: string
          name: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          requires_size?: boolean | null
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
          duration_minutes?: number | null
          id?: string
          instance_id?: string
          name?: string
          price_from?: number | null
          price_large?: number | null
          price_medium?: number | null
          price_small?: number | null
          requires_size?: boolean | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_sms_available: { Args: { _instance_id: string }; Returns: boolean }
      get_availability_blocks: {
        Args: { _from: string; _instance_id: string; _to: string }
        Returns: {
          block_date: string
          end_time: string
          start_time: string
          station_id: string
        }[]
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
      app_role: "super_admin" | "admin" | "user"
      car_size: "small" | "medium" | "large"
      reservation_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
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
      app_role: ["super_admin", "admin", "user"],
      car_size: ["small", "medium", "large"],
      reservation_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      service_category: ["car_wash", "ppf", "detailing", "upholstery", "other"],
      station_type: ["washing", "ppf", "detailing", "universal"],
    },
  },
} as const
