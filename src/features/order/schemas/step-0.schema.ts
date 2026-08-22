// schemas/step-0.schema.ts
import { z } from 'zod';

export const step0Schema = z.object({
  type: z.enum([
    'WEBSITE', 'LANDING_PAGE', 'ECOMMERCE',
    'WEBAPP', 'MOBILE_APP', 'SAAS', 'DASHBOARD', 'REDESIGN'
  ], { required_error: 'Please select a project type' }),
});

// schemas/step-1.schema.ts
export const step1Schema = z.object({
  goals: z.array(z.string()).min(1, 'Select at least one goal').max(5),
});

// schemas/step-2.schema.ts
export const step2Schema = z.object({
  has_existing_site: z.boolean(),
  existing_site_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
}).refine(
  (data) => !data.has_existing_site || !!data.existing_site_url,
  { message: 'Please enter your current website URL', path: ['existing_site_url'] }
);

// schemas/step-6.schema.ts
export const step6Schema = z.object({
  budget_band: z.enum(['under_2k', '2k_5k', '5k_10k', '10k_20k', '20k_50k', '50k_plus'], {
    required_error: 'Please select a budget range',
  }),
});

// schemas/step-7.schema.ts
export const step7Schema = z.object({
  contact_name: z.string().min(2, 'Name is required'),
  contact_email: z.string().email('Enter a valid email address'),
  company_name: z.string().optional(),
  contact_phone: z.string().optional(),
});

// schemas/order.schema.ts — composed global schema
import { step0Schema } from './step-0.schema';
import { step1Schema } from './step-1.schema';
// ... etc

export const orderFormSchema = step0Schema
  .merge(step1Schema)
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .merge(step7Schema)
  .merge(step8Schema);

export type OrderFormData = z.infer<typeof orderFormSchema>;