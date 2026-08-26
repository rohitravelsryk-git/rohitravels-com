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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_credentials: {
        Row: {
          id: boolean
          password_hash: string
          recovery_email: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          password_hash: string
          recovery_email: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          password_hash?: string
          recovery_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_password_resets: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      agent_bookings: {
        Row: {
          agent_user_id: string
          attachments: Json
          booking_ref: string | null
          contact_phone: string
          created_at: string
          fare_id: string | null
          fare_on_demand: string
          fare_snapshot: Json
          id: string
          notes: string | null
          passenger_names: string
          payment_slips: Json
          payment_status: string
          seats: number
          status: string
          ticket_status: string
          tickets: Json
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          attachments?: Json
          booking_ref?: string | null
          contact_phone: string
          created_at?: string
          fare_id?: string | null
          fare_on_demand?: string
          fare_snapshot: Json
          id?: string
          notes?: string | null
          passenger_names: string
          payment_slips?: Json
          payment_status?: string
          seats?: number
          status?: string
          ticket_status?: string
          tickets?: Json
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          attachments?: Json
          booking_ref?: string | null
          contact_phone?: string
          created_at?: string
          fare_id?: string | null
          fare_on_demand?: string
          fare_snapshot?: Json
          id?: string
          notes?: string | null
          passenger_names?: string
          payment_slips?: Json
          payment_status?: string
          seats?: number
          status?: string
          ticket_status?: string
          tickets?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_bookings_fare_id_fkey"
            columns: ["fare_id"]
            isOneToOne: false
            referencedRelation: "fares"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agency_name: string
          approved_at: string | null
          cell_number: string
          city: string
          contact_person: string
          country: string
          country_code: string
          created_at: string
          email: string
          mfa_enabled: boolean | null
          office_address: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          user_code: string | null
          user_id: string
        }
        Insert: {
          agency_name: string
          approved_at?: string | null
          cell_number: string
          city: string
          contact_person: string
          country?: string
          country_code?: string
          created_at?: string
          email: string
          mfa_enabled?: boolean | null
          office_address: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_code?: string | null
          user_id: string
        }
        Update: {
          agency_name?: string
          approved_at?: string | null
          cell_number?: string
          city?: string
          contact_person?: string
          country?: string
          country_code?: string
          created_at?: string
          email?: string
          mfa_enabled?: boolean | null
          office_address?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      airline_balance_accounts: {
        Row: {
          account_label: string
          airline_id: string
          created_at: string
          id: string
          opening_balance: number
          sheet_url: string | null
        }
        Insert: {
          account_label?: string
          airline_id: string
          created_at?: string
          id?: string
          opening_balance?: number
          sheet_url?: string | null
        }
        Update: {
          account_label?: string
          airline_id?: string
          created_at?: string
          id?: string
          opening_balance?: number
          sheet_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "airline_balance_accounts_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
        ]
      }
      airline_balance_entries: {
        Row: {
          agent_name: string
          airline_id: string
          created_at: string
          credit_from_id: number
          debit_in_id: number
          entry_date: string
          id: string
          ledger_entry: string
          pax_contact: string
          pax_name: string
          pnr: string
          sector: string
          ticket_sales: number
          updated_at: string
          void_charges: number
        }
        Insert: {
          agent_name?: string
          airline_id: string
          created_at?: string
          credit_from_id?: number
          debit_in_id?: number
          entry_date?: string
          id?: string
          ledger_entry?: string
          pax_contact?: string
          pax_name?: string
          pnr?: string
          sector?: string
          ticket_sales?: number
          updated_at?: string
          void_charges?: number
        }
        Update: {
          agent_name?: string
          airline_id?: string
          created_at?: string
          credit_from_id?: number
          debit_in_id?: number
          entry_date?: string
          id?: string
          ledger_entry?: string
          pax_contact?: string
          pax_name?: string
          pnr?: string
          sector?: string
          ticket_sales?: number
          updated_at?: string
          void_charges?: number
        }
        Relationships: [
          {
            foreignKeyName: "airline_balance_entries_airline_id_fkey"
            columns: ["airline_id"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["id"]
          },
        ]
      }
      airlines: {
        Row: {
          created_at: string
          iata_code: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          iata_code: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          iata_code?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2b_sticky_notes: {
        Row: {
          content: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          content: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      backup_errors: {
        Row: {
          created_at: string
          id: string
          message: string
          payload: Json
          row_id: string
          run_id: string | null
          severity: string
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          payload?: Json
          row_id?: string
          run_id?: string | null
          severity?: string
          table_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          payload?: Json
          row_id?: string
          run_id?: string | null
          severity?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "backup_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_runs: {
        Row: {
          details: Json
          error_count: number
          finished_at: string | null
          id: string
          kind: string
          message: string
          rows_synced: number
          started_at: string
          status: string
          tables_synced: number
        }
        Insert: {
          details?: Json
          error_count?: number
          finished_at?: string | null
          id?: string
          kind?: string
          message?: string
          rows_synced?: number
          started_at?: string
          status?: string
          tables_synced?: number
        }
        Update: {
          details?: Json
          error_count?: number
          finished_at?: string | null
          id?: string
          kind?: string
          message?: string
          rows_synced?: number
          started_at?: string
          status?: string
          tables_synced?: number
        }
        Relationships: []
      }
      backup_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      backup_snapshots: {
        Row: {
          finished_at: string | null
          id: string
          kind: string
          label: string
          message: string
          row_counts: Json
          spreadsheet_id: string
          status: string
          taken_at: string
          total_rows: number
        }
        Insert: {
          finished_at?: string | null
          id?: string
          kind?: string
          label?: string
          message?: string
          row_counts?: Json
          spreadsheet_id?: string
          status?: string
          taken_at?: string
          total_rows?: number
        }
        Update: {
          finished_at?: string | null
          id?: string
          kind?: string
          label?: string
          message?: string
          row_counts?: Json
          spreadsheet_id?: string
          status?: string
          taken_at?: string
          total_rows?: number
        }
        Relationships: []
      }
      backup_tables: {
        Row: {
          created_at: string
          cursor_column: string | null
          direction: string
          enabled: boolean
          last_cursor: string | null
          last_row_count: number
          last_synced_at: string | null
          sheet_name: string
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cursor_column?: string | null
          direction?: string
          enabled?: boolean
          last_cursor?: string | null
          last_row_count?: number
          last_synced_at?: string | null
          sheet_name: string
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cursor_column?: string | null
          direction?: string
          enabled?: boolean
          last_cursor?: string | null
          last_row_count?: number
          last_synced_at?: string | null
          sheet_name?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_details: {
        Row: {
          account_name: string
          account_no: string
          bank_logo_url: string | null
          bank_name: string
          created_at: string
          iban: string
          id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_no: string
          bank_logo_url?: string | null
          bank_name: string
          created_at?: string
          iban: string
          id?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_no?: string
          bank_logo_url?: string | null
          bank_name?: string
          created_at?: string
          iban?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fares: {
        Row: {
          airline: string
          arrive_time: string | null
          auto_hide_hours: number | null
          baggage: string | null
          category: string
          created_at: string
          deleted_at: string | null
          depart_time: string | null
          destination: string
          destination_code: string
          flight_date: string
          flight_details: string | null
          flight_number: string | null
          group_type: string
          hide_fare_after_2h: boolean | null
          id: string
          is_deleted: boolean | null
          is_featured: boolean
          meal: string | null
          origin: string
          origin_code: string
          pnr: string
          price_text: string
          seats: string | null
          sort_order: number
          updated_at: string
          vendor_fare: string | null
          vendor_name: string | null
        }
        Insert: {
          airline: string
          arrive_time?: string | null
          auto_hide_hours?: number | null
          baggage?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          depart_time?: string | null
          destination: string
          destination_code: string
          flight_date: string
          flight_details?: string | null
          flight_number?: string | null
          group_type?: string
          hide_fare_after_2h?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_featured?: boolean
          meal?: string | null
          origin: string
          origin_code: string
          pnr?: string
          price_text?: string
          seats?: string | null
          sort_order?: number
          updated_at?: string
          vendor_fare?: string | null
          vendor_name?: string | null
        }
        Update: {
          airline?: string
          arrive_time?: string | null
          auto_hide_hours?: number | null
          baggage?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          depart_time?: string | null
          destination?: string
          destination_code?: string
          flight_date?: string
          flight_details?: string | null
          flight_number?: string | null
          group_type?: string
          hide_fare_after_2h?: boolean | null
          id?: string
          is_deleted?: boolean | null
          is_featured?: boolean
          meal?: string | null
          origin?: string
          origin_code?: string
          pnr?: string
          price_text?: string
          seats?: string | null
          sort_order?: number
          updated_at?: string
          vendor_fare?: string | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      group_tickets: {
        Row: {
          agent_contact: string
          agent_name: string
          airline: string
          attachments: Json
          booking_date: string | null
          booking_id: string | null
          contact: string
          created_at: string
          fare_id: string | null
          flight_status: string
          group_type: string
          id: string
          ledger_entry: string
          otb: string
          pax_name: string
          pnr: string
          profit: number | null
          purchase: number
          remarks: string
          reminder_24h_sent_at: string | null
          reminder_72h_sent_at: string | null
          sale: number
          seats: number
          sector: string
          seq: number
          travel_at: string | null
          updated_at: string
          vendor: string
        }
        Insert: {
          agent_contact?: string
          agent_name?: string
          airline?: string
          attachments?: Json
          booking_date?: string | null
          booking_id?: string | null
          contact?: string
          created_at?: string
          fare_id?: string | null
          flight_status?: string
          group_type?: string
          id?: string
          ledger_entry?: string
          otb?: string
          pax_name?: string
          pnr?: string
          profit?: number | null
          purchase?: number
          remarks?: string
          reminder_24h_sent_at?: string | null
          reminder_72h_sent_at?: string | null
          sale?: number
          seats?: number
          sector?: string
          seq?: number
          travel_at?: string | null
          updated_at?: string
          vendor?: string
        }
        Update: {
          agent_contact?: string
          agent_name?: string
          airline?: string
          attachments?: Json
          booking_date?: string | null
          booking_id?: string | null
          contact?: string
          created_at?: string
          fare_id?: string | null
          flight_status?: string
          group_type?: string
          id?: string
          ledger_entry?: string
          otb?: string
          pax_name?: string
          pnr?: string
          profit?: number | null
          purchase?: number
          remarks?: string
          reminder_24h_sent_at?: string | null
          reminder_72h_sent_at?: string | null
          sale?: number
          seats?: number
          sector?: string
          seq?: number
          travel_at?: string | null
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_tickets_fare_id_fkey"
            columns: ["fare_id"]
            isOneToOne: false
            referencedRelation: "fares"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_services: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      ledger_manual_entries: {
        Row: {
          agent_user_id: string
          created_at: string
          created_by: string | null
          credit: number
          date: string
          debit: number
          details: string
          id: string
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          date?: string
          debit?: number
          details: string
          id?: string
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          date?: string
          debit?: number
          details?: string
          id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string
          code: string
          created_at: string
          id: string
          updated_at: string
          urdu_name: string | null
        }
        Insert: {
          city: string
          code: string
          created_at?: string
          id?: string
          updated_at?: string
          urdu_name?: string | null
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          id?: string
          updated_at?: string
          urdu_name?: string | null
        }
        Relationships: []
      }
      login_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          subject: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose: string
          subject?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          subject?: string
          used_at?: string | null
        }
        Relationships: []
      }
      luggage_options: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      queries: {
        Row: {
          attachments: Json
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string
          seq: number
          service: string
          status: string
          updated_at: string
          user_type: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          email?: string
          id?: string
          message: string
          name: string
          phone: string
          seq?: number
          service?: string
          status?: string
          updated_at?: string
          user_type: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string
          seq?: number
          service?: string
          status?: string
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      self_group_applications: {
        Row: {
          additional_25_paid: number
          additional_25_paid_date: string | null
          airline: string
          applied_date: string | null
          balance_50_paid: number
          balance_50_paid_date: string | null
          created_at: string
          deposit_alert_sent_at: string | null
          destination: string
          fare_id: string | null
          fare_per_pax: number
          final_deposit_paid: number
          final_deposit_paid_date: string | null
          flight_date: string | null
          flight_details: string
          group_label: string
          id: string
          initial_deposit_paid_date: string | null
          luggage: string
          meal: string
          notes: string
          origin: string
          pnr: string
          seats: number
          sector: string
          sort_order: number
          tr: string
          updated_at: string
        }
        Insert: {
          additional_25_paid?: number
          additional_25_paid_date?: string | null
          airline?: string
          applied_date?: string | null
          balance_50_paid?: number
          balance_50_paid_date?: string | null
          created_at?: string
          deposit_alert_sent_at?: string | null
          destination?: string
          fare_id?: string | null
          fare_per_pax?: number
          final_deposit_paid?: number
          final_deposit_paid_date?: string | null
          flight_date?: string | null
          flight_details?: string
          group_label?: string
          id?: string
          initial_deposit_paid_date?: string | null
          luggage?: string
          meal?: string
          notes?: string
          origin?: string
          pnr?: string
          seats?: number
          sector?: string
          sort_order?: number
          tr?: string
          updated_at?: string
        }
        Update: {
          additional_25_paid?: number
          additional_25_paid_date?: string | null
          airline?: string
          applied_date?: string | null
          balance_50_paid?: number
          balance_50_paid_date?: string | null
          created_at?: string
          deposit_alert_sent_at?: string | null
          destination?: string
          fare_id?: string | null
          fare_per_pax?: number
          final_deposit_paid?: number
          final_deposit_paid_date?: string | null
          flight_date?: string | null
          flight_details?: string
          group_label?: string
          id?: string
          initial_deposit_paid_date?: string | null
          luggage?: string
          meal?: string
          notes?: string
          origin?: string
          pnr?: string
          seats?: number
          sector?: string
          sort_order?: number
          tr?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_group_applications_fare_id_fkey"
            columns: ["fare_id"]
            isOneToOne: false
            referencedRelation: "fares"
            referencedColumns: ["id"]
          },
        ]
      }
      self_group_passengers: {
        Row: {
          created_at: string
          dob: string | null
          doc_number: string
          doc_type: string
          expire_date: string | null
          fare_id: string | null
          first_name: string
          id: string
          issued_by_country: string
          last_name: string
          nationality: string
          passport_issue_date: string | null
          pnr: string
          sector: string
          sort_order: number
          status: string | null
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          doc_number?: string
          doc_type?: string
          expire_date?: string | null
          fare_id?: string | null
          first_name?: string
          id?: string
          issued_by_country?: string
          last_name?: string
          nationality?: string
          passport_issue_date?: string | null
          pnr?: string
          sector?: string
          sort_order?: number
          status?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          doc_number?: string
          doc_type?: string
          expire_date?: string | null
          fare_id?: string | null
          first_name?: string
          id?: string
          issued_by_country?: string
          last_name?: string
          nationality?: string
          passport_issue_date?: string | null
          pnr?: string
          sector?: string
          sort_order?: number
          status?: string | null
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_group_passengers_fare_id_fkey"
            columns: ["fare_id"]
            isOneToOne: false
            referencedRelation: "fares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "self_group_passengers_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "group_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      staff_users: {
        Row: {
          active: boolean
          allowed_tabs: Json
          created_at: string
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          active?: boolean
          allowed_tabs?: Json
          created_at?: string
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          active?: boolean
          allowed_tabs?: Json
          created_at?: string
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      ticket_notifications: {
        Row: {
          body: string
          channels_sent: Json
          created_at: string
          id: string
          kind: string
          seen_at: string | null
          ticket_id: string
          title: string
        }
        Insert: {
          body?: string
          channels_sent?: Json
          created_at?: string
          id?: string
          kind: string
          seen_at?: string | null
          ticket_id: string
          title: string
        }
        Update: {
          body?: string
          channels_sent?: Json
          created_at?: string
          id?: string
          kind?: string
          seen_at?: string | null
          ticket_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "group_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      visa_verification_links: {
        Row: {
          country: string
          created_at: string
          id: string
          purpose: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          purpose: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          purpose?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          agent_name: string
          airline: string
          alert_date: string
          created_at: string
          days_left: string
          expiry_date: string
          id: string
          name: string
          notes: string
          passenger_name: string
          pnr: string
          sr: number
          status: string
          updated_at: string
          voucher_amount: string
        }
        Insert: {
          agent_name?: string
          airline?: string
          alert_date?: string
          created_at?: string
          days_left?: string
          expiry_date?: string
          id?: string
          name: string
          notes?: string
          passenger_name?: string
          pnr?: string
          sr?: number
          status?: string
          updated_at?: string
          voucher_amount?: string
        }
        Update: {
          agent_name?: string
          airline?: string
          alert_date?: string
          created_at?: string
          days_left?: string
          expiry_date?: string
          id?: string
          name?: string
          notes?: string
          passenger_name?: string
          pnr?: string
          sr?: number
          status?: string
          updated_at?: string
          voucher_amount?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reset_dataset: { Args: { _target: string }; Returns: Json }
      backup_count_rows: { Args: { _table: string }; Returns: number }
      backup_fetch_rows: {
        Args: {
          _limit?: number
          _offset?: number
          _since?: string
          _table: string
        }
        Returns: Json
      }
      backup_list_tables: {
        Args: never
        Returns: {
          columns: string[]
          cursor_column: string
          est_rows: number
          table_name: string
        }[]
      }
      booking_state_unchanged: {
        Args: {
          _id: string
          _payment_status: string
          _status: string
          _ticket_status: string
          _tickets: Json
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
    }
    Enums: {
      agent_status: "pending" | "approved" | "rejected"
      app_role: "admin"
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
      agent_status: ["pending", "approved", "rejected"],
      app_role: ["admin"],
    },
  },
} as const
