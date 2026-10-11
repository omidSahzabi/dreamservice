export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export interface OrderMeta {
  full_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  formKey?: string;
  page_count?: number;
  budget_range?: string;
  service_type?: string;
  website_type?: string[];
  deadline_type?: string;
  business_field?: string;
  project_description?: string;
  [key: string]: unknown;
}

export interface OrderItem {
  order_id: number;
  client_id: string;
  type: string | null;
  page_count: number | null;
  budget_range: string | null;
  description: string | null;
  status: string | null;
  cr: string | null;
  meta: OrderMeta | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface OrdersApiResponse {
  success: boolean;
  data: OrderItem[];
  pagination: PaginationMeta;
}

export interface OrdersQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: string
  type?: string
  budget_range?: string
  client_id?: string
}
