// types/order.types.ts

export type OrderType =
  | 'WEBSITE'
  | 'LANDING_PAGE'
  | 'ECOMMERCE'
  | 'WEBAPP'
  | 'MOBILE_APP'
  | 'SAAS'
  | 'DASHBOARD'
  | 'REDESIGN';

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED';

export type DesignStyle =
  | 'minimal'
  | 'bold'
  | 'playful'
  | 'luxury'
  | 'corporate'
  | 'creative';

export type TimelinePreference =
  | 'asap'
  | '1_month'
  | '2_3_months'
  | '3_6_months'
  | 'flexible';

export type BudgetBand =
  | 'under_2k'
  | '2k_5k'
  | '5k_10k'
  | '10k_20k'
  | '20k_50k'
  | '50k_plus';

// ─── Meta JSON Structure ─────────────────────────────────────────────────────

export interface OrderProjectMeta {
  goals: string[];
  page_count?: number;
  has_existing_site: boolean;
  existing_site_url?: string;
  design_style?: DesignStyle;
  color_preferences?: string[];
  inspiration_urls?: string[];
  cms_required?: boolean;
  ecommerce_required?: boolean;
  features?: string[];
  integrations?: string[];
}

export interface OrderTimelineMeta {
  preference: TimelinePreference;
  hard_deadline?: string; // ISO date
  flexibility: 'none' | 'some' | 'a_lot';
}

export interface OrderContactMeta {
  company_name?: string;
  phone?: string;
  preferred_contact: 'email' | 'phone' | 'whatsapp';
  timezone?: string;
}

export interface OrderReferralMeta {
  source?: string;
  referral_code?: string;
}

export interface OrderMeta {
  project?: OrderProjectMeta;
  timeline?: OrderTimelineMeta;
  contact?: OrderContactMeta;
  referral?: OrderReferralMeta;
}

// ─── Form Data (what RHF manages) ────────────────────────────────────────────

export interface OrderFormData {
  // Step 0
  type: OrderType;

  // Step 1
  goals: string[];

  // Step 2
  has_existing_site: boolean;
  existing_site_url?: string;

  // Step 3
  page_count?: number;
  features: string[];

  // Step 4
  design_style: DesignStyle;
  inspiration_urls?: string[];

  // Step 5
  timeline_preference: TimelinePreference;
  hard_deadline?: string;

  // Step 6
  budget_band: BudgetBand;

  // Step 7
  contact_name: string;
  contact_email: string;
  company_name?: string;
  contact_phone?: string;

  // Step 8
  description?: string;
}

// ─── Draft (persisted to server) ─────────────────────────────────────────────

export interface OrderDraft {
  order_id: number;
  status: OrderStatus;
  type?: OrderType;
  budget_min?: number;
  budget_max?: number;
  description?: string;
  meta?: OrderMeta;
  current_step: number;
  created_at: string;
  updated_at: string;
}