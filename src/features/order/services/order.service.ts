// services/order.service.ts

import type { OrderFormData } from '../types/order.types';

const BUDGET_MAP: Record<string, [number, number]> = {
  under_2k:  [0,     2000],
  '2k_5k':   [2000,  5000],
  '5k_10k':  [5000,  10000],
  '10k_20k': [10000, 20000],
  '20k_50k': [20000, 50000],
  '50k_plus':[50000, 999999],
};

export function mapFormDataToOrder(data: Partial<OrderFormData>) {
  const [budget_min, budget_max] = data.budget_band
    ? BUDGET_MAP[data.budget_band]
    : [undefined, undefined];

  return {
    type: data.type,
    budget_min,
    budget_max,
    description: data.description,
    meta: {
      project: {
        goals: data.goals,
        page_count: data.page_count,
        has_existing_site: data.has_existing_site,
        existing_site_url: data.existing_site_url,
        design_style: data.design_style,
        features: data.features,
      },
      timeline: {
        preference: data.timeline_preference,
      },
      contact: {
        company_name: data.company_name,
        phone: data.contact_phone,
      },
    },
  };
}