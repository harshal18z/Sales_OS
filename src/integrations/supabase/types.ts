export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_jobs: {
        Row: {
          cache_hit: boolean;
          cache_key: string | null;
          completed_at: string | null;
          cost_usd: number | null;
          created_at: string;
          created_by: string | null;
          entity_id: string | null;
          entity_type: string | null;
          error: string | null;
          id: string;
          input: Json;
          kind: string;
          output: Json;
          progress: number;
          prompt_version: string | null;
          retry_count: number;
          started_at: string | null;
          status: string;
          tokens_input: number | null;
          tokens_output: number | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          cache_hit?: boolean;
          cache_key?: string | null;
          completed_at?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error?: string | null;
          id?: string;
          input?: Json;
          kind: string;
          output?: Json;
          progress?: number;
          prompt_version?: string | null;
          retry_count?: number;
          started_at?: string | null;
          status?: string;
          tokens_input?: number | null;
          tokens_output?: number | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          cache_hit?: boolean;
          cache_key?: string | null;
          completed_at?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error?: string | null;
          id?: string;
          input?: Json;
          kind?: string;
          output?: Json;
          progress?: number;
          prompt_version?: string | null;
          retry_count?: number;
          started_at?: string | null;
          status?: string;
          tokens_input?: number | null;
          tokens_output?: number | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_jobs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connection_key_ciphertext: string;
          connector_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connection_key_ciphertext?: string;
          connector_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          ai_sequence: Json | null;
          ai_sequence_at: string | null;
          channel: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          goal: string | null;
          id: string;
          name: string;
          scheduled_at: string | null;
          settings: Json;
          stats: Json;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          ai_sequence?: Json | null;
          ai_sequence_at?: string | null;
          channel?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          goal?: string | null;
          id?: string;
          name: string;
          scheduled_at?: string | null;
          settings?: Json;
          stats?: Json;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          ai_sequence?: Json | null;
          ai_sequence_at?: string | null;
          channel?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          goal?: string | null;
          id?: string;
          name?: string;
          scheduled_at?: string | null;
          settings?: Json;
          stats?: Json;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          ai_summary: string | null;
          business_model: string | null;
          confidence_score: number | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          domain: string | null;
          executive_summary: string | null;
          headquarters: string | null;
          icp_score: number | null;
          id: string;
          industry: string | null;
          last_research_at: string | null;
          latest_research_report_id: string | null;
          location: string | null;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          products: string[] | null;
          recommended_outreach: string | null;
          revenue: string | null;
          size: string | null;
          social_links: Json;
          sub_industry: string | null;
          tags: string[] | null;
          target_customers: string | null;
          tech_stack: string[] | null;
          updated_at: string;
          website: string | null;
          workspace_id: string;
        };
        Insert: {
          ai_summary?: string | null;
          business_model?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          domain?: string | null;
          executive_summary?: string | null;
          headquarters?: string | null;
          icp_score?: number | null;
          id?: string;
          industry?: string | null;
          last_research_at?: string | null;
          latest_research_report_id?: string | null;
          location?: string | null;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          products?: string[] | null;
          recommended_outreach?: string | null;
          revenue?: string | null;
          size?: string | null;
          social_links?: Json;
          sub_industry?: string | null;
          tags?: string[] | null;
          target_customers?: string | null;
          tech_stack?: string[] | null;
          updated_at?: string;
          website?: string | null;
          workspace_id: string;
        };
        Update: {
          ai_summary?: string | null;
          business_model?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          domain?: string | null;
          executive_summary?: string | null;
          headquarters?: string | null;
          icp_score?: number | null;
          id?: string;
          industry?: string | null;
          last_research_at?: string | null;
          latest_research_report_id?: string | null;
          location?: string | null;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          products?: string[] | null;
          recommended_outreach?: string | null;
          revenue?: string | null;
          size?: string | null;
          social_links?: Json;
          sub_industry?: string | null;
          tags?: string[] | null;
          target_customers?: string | null;
          tech_stack?: string[] | null;
          updated_at?: string;
          website?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_latest_research_report_id_fkey";
            columns: ["latest_research_report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          avatar_url: string | null;
          company_id: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          owner_id: string | null;
          phone: string | null;
          title: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          company_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          linkedin_url?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          avatar_url?: string | null;
          company_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          linkedin_url?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          title?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_deals: {
        Row: {
          company_id: string | null;
          created_at: string;
          currency: string | null;
          deleted_at: string | null;
          expected_close_date: string | null;
          id: string;
          lead_id: string | null;
          name: string;
          notes: string | null;
          owner_id: string | null;
          probability: number | null;
          stage: string;
          updated_at: string;
          value: number | null;
          workspace_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          expected_close_date?: string | null;
          id?: string;
          lead_id?: string | null;
          name: string;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          stage?: string;
          updated_at?: string;
          value?: number | null;
          workspace_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          expected_close_date?: string | null;
          id?: string;
          lead_id?: string | null;
          name?: string;
          notes?: string | null;
          owner_id?: string | null;
          probability?: number | null;
          stage?: string;
          updated_at?: string;
          value?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_deals_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_deals_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_deals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      emails: {
        Row: {
          body: string | null;
          campaign_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          lead_id: string | null;
          personalization_score: number | null;
          scheduled_at: string | null;
          sent_at: string | null;
          spam_risk: number | null;
          status: string;
          subject: string | null;
          tone: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          lead_id?: string | null;
          personalization_score?: number | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          spam_risk?: number | null;
          status?: string;
          subject?: string | null;
          tone?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          lead_id?: string | null;
          personalization_score?: number | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          spam_risk?: number | null;
          status?: string;
          subject?: string | null;
          tone?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emails_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "emails_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "emails_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      integrations: {
        Row: {
          config: Json;
          connected_by: string | null;
          created_at: string;
          id: string;
          provider: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          config?: Json;
          connected_by?: string | null;
          created_at?: string;
          id?: string;
          provider: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          config?: Json;
          connected_by?: string | null;
          created_at?: string;
          id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          ai_insight: Json | null;
          ai_scored_at: string | null;
          buying_intent: number | null;
          campaign_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          intent_score: number | null;
          last_activity_at: string | null;
          next_action: string | null;
          notes: string | null;
          owner_id: string | null;
          priority: string | null;
          score: number | null;
          source: string | null;
          stage: string;
          temperature: string | null;
          updated_at: string;
          win_probability: number | null;
          workspace_id: string;
        };
        Insert: {
          ai_insight?: Json | null;
          ai_scored_at?: string | null;
          buying_intent?: number | null;
          campaign_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          intent_score?: number | null;
          last_activity_at?: string | null;
          next_action?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          priority?: string | null;
          score?: number | null;
          source?: string | null;
          stage?: string;
          temperature?: string | null;
          updated_at?: string;
          win_probability?: number | null;
          workspace_id: string;
        };
        Update: {
          ai_insight?: Json | null;
          ai_scored_at?: string | null;
          buying_intent?: number | null;
          campaign_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          intent_score?: number | null;
          last_activity_at?: string | null;
          next_action?: string | null;
          notes?: string | null;
          owner_id?: string | null;
          priority?: string | null;
          score?: number | null;
          source?: string | null;
          stage?: string;
          temperature?: string | null;
          updated_at?: string;
          win_probability?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          action_items: Json;
          agenda: Json;
          ai_prep: Json | null;
          ai_prep_at: string | null;
          ai_summary: Json | null;
          ai_summary_at: string | null;
          attendees: Json;
          company_id: string | null;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          ends_at: string | null;
          id: string;
          lead_id: string | null;
          location: string | null;
          meeting_url: string | null;
          notes: string | null;
          starts_at: string;
          status: string | null;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          action_items?: Json;
          agenda?: Json;
          ai_prep?: Json | null;
          ai_prep_at?: string | null;
          ai_summary?: Json | null;
          ai_summary_at?: string | null;
          attendees?: Json;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          lead_id?: string | null;
          location?: string | null;
          meeting_url?: string | null;
          notes?: string | null;
          starts_at: string;
          status?: string | null;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          action_items?: Json;
          agenda?: Json;
          ai_prep?: Json | null;
          ai_prep_at?: string | null;
          ai_summary?: Json | null;
          ai_summary_at?: string | null;
          attendees?: Json;
          company_id?: string | null;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          lead_id?: string | null;
          location?: string | null;
          meeting_url?: string | null;
          notes?: string | null;
          starts_at?: string;
          status?: string | null;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          read_at: string | null;
          title: string;
          type: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          read_at?: string | null;
          title: string;
          type?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          read_at?: string | null;
          title?: string;
          type?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_reports: {
        Row: {
          company_id: string | null;
          confidence_score: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          industry: string | null;
          lead_id: string | null;
          opportunities: Json;
          pain_points: Json;
          query: string;
          report: Json;
          sources: Json;
          status: string;
          summary: string | null;
          updated_at: string;
          url: string | null;
          workspace_id: string;
        };
        Insert: {
          company_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          industry?: string | null;
          lead_id?: string | null;
          opportunities?: Json;
          pain_points?: Json;
          query: string;
          report?: Json;
          sources?: Json;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          url?: string | null;
          workspace_id: string;
        };
        Update: {
          company_id?: string | null;
          confidence_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          industry?: string | null;
          lead_id?: string | null;
          opportunities?: Json;
          pain_points?: Json;
          query?: string;
          report?: Json;
          sources?: Json;
          status?: string;
          summary?: string | null;
          updated_at?: string;
          url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_reports_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_reports_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      research_sources: {
        Row: {
          created_at: string;
          id: string;
          provider: string | null;
          published_date: string | null;
          report_id: string;
          snippet: string | null;
          title: string | null;
          url: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          provider?: string | null;
          published_date?: string | null;
          report_id: string;
          snippet?: string | null;
          title?: string | null;
          url: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          provider?: string | null;
          published_date?: string | null;
          report_id?: string;
          snippet?: string | null;
          title?: string | null;
          url?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_sources_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "research_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_sources_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          deal_id: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          lead_id: string | null;
          priority: string | null;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          lead_id?: string | null;
          priority?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          deal_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          lead_id?: string | null;
          priority?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_deal_id_fkey";
            columns: ["deal_id"];
            isOneToOne: false;
            referencedRelation: "crm_deals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          calendar: string | null;
          created_at: string;
          crm: string | null;
          goal: string | null;
          id: string;
          industry: string | null;
          name: string;
          owner_id: string;
          plan: string;
          revenue: string | null;
          slug: string;
          team_size: string | null;
          updated_at: string;
        };
        Insert: {
          calendar?: string | null;
          created_at?: string;
          crm?: string | null;
          goal?: string | null;
          id?: string;
          industry?: string | null;
          name: string;
          owner_id: string;
          plan?: string;
          revenue?: string | null;
          slug: string;
          team_size?: string | null;
          updated_at?: string;
        };
        Update: {
          calendar?: string | null;
          created_at?: string;
          crm?: string | null;
          goal?: string | null;
          id?: string;
          industry?: string | null;
          name?: string;
          owner_id?: string;
          plan?: string;
          revenue?: string | null;
          slug?: string;
          team_size?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_role: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
          _workspace_id: string;
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "owner" | "admin" | "sales_manager" | "sales_rep" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "sales_manager", "sales_rep", "viewer"],
    },
  },
} as const;
