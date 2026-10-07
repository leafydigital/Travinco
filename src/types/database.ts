// Hand-authored to match supabase/migrations/*.sql exactly.
// Once you have a live Supabase project, prefer regenerating this with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// and re-apply any manual additions below the generated block if needed.

export type UserRole = 'super_admin' | 'admin' | 'sales_staff' | 'accounts_staff';
export type CustomerSource =
  | 'website' | 'whatsapp' | 'phone' | 'walk_in' | 'referral' | 'social_media' | 'other';
export type PackageStatus = 'draft' | 'published' | 'archived';
export type PackageCategory =
  | 'honeymoon' | 'family' | 'adventure' | 'group' | 'luxury' | 'budget' | 'pilgrimage' | 'other';
export type EnquiryStatus =
  | 'new' | 'contacted' | 'follow_up' | 'quotation_sent' | 'negotiation'
  | 'confirmed' | 'lost' | 'closed';
export type EnquiryPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EnquirySource =
  | 'website' | 'whatsapp' | 'phone' | 'walk_in' | 'referral' | 'social_media' | 'other';
export type FollowupType = 'call' | 'whatsapp' | 'email' | 'meeting' | 'other';
export type BookingStatus =
  | 'inquiry' | 'pending' | 'confirmed' | 'partially_paid' | 'fully_paid'
  | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded';
export type PaymentMethod =
  | 'cash' | 'bank_transfer' | 'upi' | 'credit_card' | 'debit_card' | 'cheque' | 'other';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type WhatsappCampaignStatus =
  | 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
export type WhatsappRecipientStatus =
  | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'opted_out';
export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'closed';
export type IncomeCategory =
  | 'package_booking' | 'flight' | 'hotel' | 'transport' | 'visa' | 'service_charge' | 'other';
export type NotificationType =
  | 'new_enquiry' | 'new_booking' | 'payment_received' | 'followup_due'
  | 'followup_overdue' | 'contact_message' | 'low_availability';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          avatar_url: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & {
          id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          whatsapp_number: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          source: CustomerSource;
          tags: string[];
          notes: string | null;
          whatsapp_opt_in: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customers']['Row']> & {
          full_name: string;
          phone: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Row']>;
      };
      destinations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          country: string | null;
          description: string | null;
          cover_image_url: string | null;
          status: ContentStatus;
          is_featured: boolean;
          sort_order: number;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['destinations']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['destinations']['Row']>;
      };
      travel_packages: {
        Row: {
          id: string;
          destination_id: string | null;
          title: string;
          slug: string;
          category: PackageCategory;
          status: PackageStatus;
          is_featured: boolean;
          duration_days: number;
          duration_nights: number;
          base_price: number;
          discount_price: number | null;
          child_price: number | null;
          currency: string;
          short_description: string | null;
          full_description: string | null;
          highlights: string[];
          terms_and_conditions: string | null;
          available_from: string | null;
          available_to: string | null;
          total_seats: number | null;
          seats_booked: number;
          pickup_info: string | null;
          cover_image_url: string | null;
          video_url: string | null;
          meta_title: string | null;
          meta_description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['travel_packages']['Row']> & {
          title: string;
          slug: string;
          duration_days: number;
          duration_nights: number;
          base_price: number;
        };
        Update: Partial<Database['public']['Tables']['travel_packages']['Row']>;
      };
      package_images: {
        Row: {
          id: string;
          package_id: string;
          image_url: string;
          alt_text: string | null;
          is_cover: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['package_images']['Row']> & {
          package_id: string;
          image_url: string;
        };
        Update: Partial<Database['public']['Tables']['package_images']['Row']>;
      };
      package_faqs: {
        Row: {
          id: string;
          package_id: string;
          question: string;
          answer: string;
          sort_order: number;
        };
        Insert: Partial<Database['public']['Tables']['package_faqs']['Row']> & {
          package_id: string;
          question: string;
          answer: string;
        };
        Update: Partial<Database['public']['Tables']['package_faqs']['Row']>;
      };
      package_videos: {
        Row: {
          id: string;
          package_id: string;
          video_url: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['package_videos']['Row']> & {
          package_id: string;
          video_url: string;
        };
        Update: Partial<Database['public']['Tables']['package_videos']['Row']>;
      };
      package_itineraries: {
        Row: {
          id: string;
          package_id: string;
          day_number: number;
          title: string;
          description: string | null;
          hotel: string | null;
          meals: string | null;
          transport: string | null;
          activities: string[];
          image_url: string | null;
        };
        Insert: Partial<Database['public']['Tables']['package_itineraries']['Row']> & {
          package_id: string;
          day_number: number;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['package_itineraries']['Row']>;
      };
      package_inclusions: {
        Row: { id: string; package_id: string; item: string; sort_order: number };
        Insert: Partial<Database['public']['Tables']['package_inclusions']['Row']> & {
          package_id: string;
          item: string;
        };
        Update: Partial<Database['public']['Tables']['package_inclusions']['Row']>;
      };
      package_exclusions: {
        Row: { id: string; package_id: string; item: string; sort_order: number };
        Insert: Partial<Database['public']['Tables']['package_exclusions']['Row']> & {
          package_id: string;
          item: string;
        };
        Update: Partial<Database['public']['Tables']['package_exclusions']['Row']>;
      };
      enquiry_email_otps: {
        Row: {
          id: string;
          email: string;
          code_hash: string;
          expires_at: string;
          attempts: number;
          verified_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['enquiry_email_otps']['Row']> & {
          email: string;
          code_hash: string;
          expires_at: string;
        };
        Update: Partial<Database['public']['Tables']['enquiry_email_otps']['Row']>;
      };
      staff_permissions: {
        Row: {
          id: string;
          profile_id: string;
          module: string;
          can_view: boolean;
          can_edit: boolean;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['staff_permissions']['Row']> & {
          profile_id: string;
          module: string;
        };
        Update: Partial<Database['public']['Tables']['staff_permissions']['Row']>;
      };
      customer_accounts: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customer_accounts']['Row']> & {
          id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['customer_accounts']['Row']>;
      };
      gallery: {
        Row: {
          id: string;
          title: string | null;
          image_url: string;
          category: string | null;
          country: string | null;
          status: ContentStatus;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['gallery']['Row']> & { image_url: string };
        Update: Partial<Database['public']['Tables']['gallery']['Row']>;
      };
      blog_posts: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          content: string | null;
          cover_image_url: string | null;
          status: ContentStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['blog_posts']['Row']> & {
          title: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['blog_posts']['Row']>;
      };
      enquiries: {
        Row: {
          id: string;
          enquiry_number: string;
          customer_id: string | null;
          customer_name: string;
          phone: string;
          whatsapp_number: string | null;
          email: string | null;
          package_id: string | null;
          destination: string | null;
          travel_date: string | null;
          return_date: string | null;
          number_of_adults: number;
          number_of_children: number;
          number_of_infants: number;
          budget: number | null;
          message: string | null;
          source: EnquirySource;
          assigned_staff: string | null;
          status: EnquiryStatus;
          priority: EnquiryPriority;
          last_contacted_at: string | null;
          next_followup_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['enquiries']['Row']> & {
          customer_name: string;
          phone: string;
        };
        Update: Partial<Database['public']['Tables']['enquiries']['Row']>;
      };
      enquiry_followups: {
        Row: {
          id: string;
          enquiry_id: string;
          followup_date: string;
          followup_time: string | null;
          followup_type: FollowupType;
          note: string | null;
          is_completed: boolean;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['enquiry_followups']['Row']> & {
          enquiry_id: string;
          followup_date: string;
        };
        Update: Partial<Database['public']['Tables']['enquiry_followups']['Row']>;
      };
      enquiry_activities: {
        Row: {
          id: string;
          enquiry_id: string;
          activity_type: string;
          description: string;
          metadata: Record<string, unknown>;
          performed_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['enquiry_activities']['Row']> & {
          enquiry_id: string;
          activity_type: string;
          description: string;
        };
        Update: Partial<Database['public']['Tables']['enquiry_activities']['Row']>;
      };
      bookings: {
        Row: {
          id: string;
          booking_number: string;
          enquiry_id: string | null;
          customer_id: string;
          package_id: string;
          travel_start_date: string;
          travel_end_date: string;
          number_of_adults: number;
          number_of_children: number;
          number_of_infants: number;
          base_amount: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          amount_received: number;
          balance_amount: number;
          payment_status: PaymentStatus;
          booking_status: BookingStatus;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['bookings']['Row']> & {
          customer_id: string;
          package_id: string;
          travel_start_date: string;
          travel_end_date: string;
          base_amount: number;
        };
        Update: Partial<Database['public']['Tables']['bookings']['Row']>;
      };
      booking_passengers: {
        Row: {
          id: string;
          booking_id: string;
          full_name: string;
          age: number | null;
          gender: string | null;
          passenger_type: 'adult' | 'child' | 'infant';
          id_proof_type: string | null;
          id_proof_number: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['booking_passengers']['Row']> & {
          booking_id: string;
          full_name: string;
        };
        Update: Partial<Database['public']['Tables']['booking_passengers']['Row']>;
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_number: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & {
          booking_id: string;
          amount: number;
        };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };
      events: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          location: string | null;
          event_date: string | null;
          image_url: string | null;
          status: ContentStatus;
          cta_label: string | null;
          cta_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['events']['Row']> & {
          title: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Row']>;
      };
      offers: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          package_id: string | null;
          event_id: string | null;
          discount_percent: number | null;
          discount_flat: number | null;
          valid_from: string;
          valid_to: string;
          image_url: string | null;
          terms: string | null;
          status: ContentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['offers']['Row']> & {
          title: string;
          slug: string;
          valid_from: string;
          valid_to: string;
        };
        Update: Partial<Database['public']['Tables']['offers']['Row']>;
      };
      whatsapp_contacts: {
        Row: {
          id: string;
          customer_id: string | null;
          phone: string;
          display_name: string | null;
          tags: string[];
          opt_in: boolean;
          opted_in_at: string | null;
          opted_out_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['whatsapp_contacts']['Row']> & {
          phone: string;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_contacts']['Row']>;
      };
      whatsapp_templates: {
        Row: {
          id: string;
          name: string;
          category: string;
          body: string;
          provider_template_id: string | null;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['whatsapp_templates']['Row']> & {
          name: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_templates']['Row']>;
      };
      whatsapp_campaigns: {
        Row: {
          id: string;
          name: string;
          template_id: string | null;
          message_override: string | null;
          media_url: string | null;
          audience_filter: Record<string, unknown>;
          scheduled_at: string | null;
          status: WhatsappCampaignStatus;
          sent_count: number;
          failed_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['whatsapp_campaigns']['Row']> & {
          name: string;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_campaigns']['Row']>;
      };
      whatsapp_campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          delivery_status: WhatsappRecipientStatus;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          failure_reason: string | null;
          provider_message_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['whatsapp_campaign_recipients']['Row']> & {
          campaign_id: string;
          contact_id: string;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_campaign_recipients']['Row']>;
      };
      income: {
        Row: {
          id: string;
          income_number: string;
          income_date: string;
          category: IncomeCategory;
          description: string | null;
          customer_id: string | null;
          booking_id: string | null;
          amount: number;
          currency: string;
          payment_method: PaymentMethod;
          reference_number: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['income']['Row']> & { amount: number };
        Update: Partial<Database['public']['Tables']['income']['Row']>;
      };
      expense_categories: {
        Row: { id: string; name: string; is_active: boolean; sort_order: number };
        Insert: Partial<Database['public']['Tables']['expense_categories']['Row']> & {
          name: string;
        };
        Update: Partial<Database['public']['Tables']['expense_categories']['Row']>;
      };
      expenses: {
        Row: {
          id: string;
          expense_number: string;
          expense_date: string;
          category_id: string;
          supplier: string | null;
          description: string | null;
          booking_id: string | null;
          package_id: string | null;
          amount: number;
          currency: string;
          payment_method: PaymentMethod;
          reference_number: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['expenses']['Row']> & {
          category_id: string;
          amount: number;
        };
        Update: Partial<Database['public']['Tables']['expenses']['Row']>;
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          whatsapp_number: string | null;
          email: string | null;
          subject: string | null;
          message: string;
          status: ContactMessageStatus;
          ip_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['contact_messages']['Row']> & {
          name: string;
          message: string;
        };
        Update: Partial<Database['public']['Tables']['contact_messages']['Row']>;
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string | null;
          type: NotificationType;
          title: string;
          body: string | null;
          link_url: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          type: NotificationType;
          title: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
      };
      website_settings: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['website_settings']['Row']> & {
          key: string;
        };
        Update: Partial<Database['public']['Tables']['website_settings']['Row']>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Record<string, unknown> | null;
          after_data: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['audit_logs']['Row']> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
      };
      locations: {
        Row: {
          id: number;
          name: string;
        };
        Insert: { id?: number; name: string };
        Update: { id?: number; name?: string };
      };
      hotel_categories: {
        Row: {
          id: number;
          name: string;
          sort_order: number;
        };
        Insert: { id?: number; name: string; sort_order?: number };
        Update: { id?: number; name?: string; sort_order?: number };
      };
      seasons: {
        Row: {
          id: number;
          code: string;
          name: string;
          priority: number;
        };
        Insert: { id?: number; code: string; name: string; priority: number };
        Update: { id?: number; code?: string; name?: string; priority?: number };
      };
      import_batches: {
        Row: {
          id: number;
          file_name: string;
          file_hash: string | null;
          tariff_year: string;
          uploaded_by: string | null;
          uploaded_at: string;
          status: 'STAGED' | 'VALIDATED' | 'PUBLISHED' | 'FAILED' | 'ROLLED_BACK';
          rows_total: number | null;
          rows_ok: number | null;
          rows_failed: number | null;
        };
        Insert: {
          id?: number;
          file_name: string;
          file_hash?: string | null;
          tariff_year: string;
          uploaded_by?: string | null;
          uploaded_at?: string;
          status?: 'STAGED' | 'VALIDATED' | 'PUBLISHED' | 'FAILED' | 'ROLLED_BACK';
          rows_total?: number | null;
          rows_ok?: number | null;
          rows_failed?: number | null;
        };
        Update: Partial<Database['public']['Tables']['import_batches']['Row']>;
      };
      rate_master_staging: {
        Row: {
          id: number;
          batch_id: number;
          excel_row_no: number;
          location: string | null;
          hotel_name: string | null;
          hotel_category: string | null;
          season: string | null;
          date_range: string | null;
          room_category: string | null;
          cp_cost: number | null;
          map_cost: number | null;
          extra_adult_cp: number | null;
          extra_adult_map: number | null;
          child_bed_cost: number | null;
          child_no_bed_cost: number | null;
          infant_policy: string | null;
          mandatory_surcharges: string | null;
          notes: string | null;
          row_status: 'PENDING' | 'OK' | 'WARNING' | 'ERROR';
          row_message: string | null;
        };
        Insert: {
          id?: number;
          batch_id: number;
          excel_row_no: number;
          location?: string | null;
          hotel_name?: string | null;
          hotel_category?: string | null;
          season?: string | null;
          date_range?: string | null;
          room_category?: string | null;
          cp_cost?: number | null;
          map_cost?: number | null;
          extra_adult_cp?: number | null;
          extra_adult_map?: number | null;
          child_bed_cost?: number | null;
          child_no_bed_cost?: number | null;
          infant_policy?: string | null;
          mandatory_surcharges?: string | null;
          notes?: string | null;
          row_status?: 'PENDING' | 'OK' | 'WARNING' | 'ERROR';
          row_message?: string | null;
        };
        Update: Partial<Database['public']['Tables']['rate_master_staging']['Row']>;
      };
      hotels: {
        Row: {
          id: number;
          name: string;
          location_id: number;
          default_category_id: number | null;
          area: string | null;
          gst_basis: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          location_id: number;
          default_category_id?: number | null;
          area?: string | null;
          gst_basis?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['hotels']['Row']>;
      };
      room_types: {
        Row: {
          id: number;
          hotel_id: number;
          name: string;
          category_id: number | null;
        };
        Insert: {
          id?: number;
          hotel_id: number;
          name: string;
          category_id?: number | null;
        };
        Update: Partial<Database['public']['Tables']['room_types']['Row']>;
      };
      rate_periods: {
        Row: {
          id: number;
          hotel_id: number;
          season_id: number;
          date_range_label: string;
          infant_policy: string | null;
          infant_free_below_age: number | null;
          mandatory_surcharges: string | null;
          import_batch_id: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          hotel_id: number;
          season_id: number;
          date_range_label: string;
          infant_policy?: string | null;
          infant_free_below_age?: number | null;
          mandatory_surcharges?: string | null;
          import_batch_id: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rate_periods']['Row']>;
      };
      rate_period_dates: {
        Row: {
          id: number;
          rate_period_id: number;
          valid_from: string;
          valid_to: string;
          is_exclusion: boolean;
        };
        Insert: {
          id?: number;
          rate_period_id: number;
          valid_from: string;
          valid_to: string;
          is_exclusion?: boolean;
        };
        Update: Partial<Database['public']['Tables']['rate_period_dates']['Row']>;
      };
      room_rates: {
        Row: {
          id: number;
          rate_period_id: number;
          room_type_id: number;
          cp_cost: number | null;
          map_cost: number | null;
          extra_adult_cp: number | null;
          extra_adult_map: number | null;
          child_bed_cost: number | null;
          child_no_bed_cost: number | null;
          notes: string | null;
        };
        Insert: {
          id?: number;
          rate_period_id: number;
          room_type_id: number;
          cp_cost?: number | null;
          map_cost?: number | null;
          extra_adult_cp?: number | null;
          extra_adult_map?: number | null;
          child_bed_cost?: number | null;
          child_no_bed_cost?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['room_rates']['Row']>;
      };
      period_surcharges: {
        Row: {
          id: number;
          rate_period_id: number;
          surcharge_type: string;
          applies_on: string | null;
          amount_adult: number | null;
          amount_child: number | null;
          per_unit: string | null;
          is_mandatory: boolean;
          is_included: boolean;
          raw_text: string | null;
        };
        Insert: {
          id?: number;
          rate_period_id: number;
          surcharge_type: string;
          applies_on?: string | null;
          amount_adult?: number | null;
          amount_child?: number | null;
          per_unit?: string | null;
          is_mandatory?: boolean;
          is_included?: boolean;
          raw_text?: string | null;
        };
        Update: Partial<Database['public']['Tables']['period_surcharges']['Row']>;
      };
      hotel_followups: {
        Row: {
          id: number;
          hotel_id: number;
          issue: string;
          action: string | null;
          status: 'OPEN' | 'DONE';
          created_at: string;
        };
        Insert: {
          id?: number;
          hotel_id: number;
          issue: string;
          action?: string | null;
          status?: 'OPEN' | 'DONE';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['hotel_followups']['Row']>;
      };
      vehicle_tariffs: {
        Row: {
          id: number;
          category: string;
          display_name: string | null;
          ac_type: string | null;
          max_pax: number | null;
          rate_per_km: number | null;
          min_km_per_day: number | null;
          driver_bata_day: number | null;
          other_per_day: number | null;
          notes: string | null;
        };
        Insert: {
          id?: number;
          category: string;
          display_name?: string | null;
          ac_type?: string | null;
          max_pax?: number | null;
          rate_per_km?: number | null;
          min_km_per_day?: number | null;
          driver_bata_day?: number | null;
          other_per_day?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['vehicle_tariffs']['Row']>;
      };
    };
    Views: {
      v_rate_master: {
        Row: {
          rate_id: number;
          location: string;
          hotel_name: string;
          hotel_category: string;
          season: string;
          date_range: string;
          room_category: string;
          cp_cost: number | null;
          map_cost: number | null;
          extra_adult_cp: number | null;
          extra_adult_map: number | null;
          child_bed_cost: number | null;
          child_no_bed_cost: number | null;
          infant_policy: string | null;
          mandatory_surcharges: string | null;
          notes: string | null;
          hotel_id: number;
          rate_period_id: number;
          room_type_id: number;
          import_batch_id: number;
          is_active: boolean;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      customer_source: CustomerSource;
      package_status: PackageStatus;
      package_category: PackageCategory;
      enquiry_status: EnquiryStatus;
      enquiry_priority: EnquiryPriority;
      enquiry_source: EnquirySource;
      followup_type: FollowupType;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      content_status: ContentStatus;
      whatsapp_campaign_status: WhatsappCampaignStatus;
      whatsapp_recipient_status: WhatsappRecipientStatus;
      contact_message_status: ContactMessageStatus;
      income_category: IncomeCategory;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
