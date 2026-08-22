// hooks/useOrderForm.ts

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderFormSchema } from '../schemas/order.schema';
import type { OrderFormData } from '../types/order.types';

const STORAGE_KEY = 'order_draft_form';

function loadPersistedValues(): Partial<OrderFormData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useOrderForm() {
  const persisted = loadPersistedValues();

  const methods = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      type: undefined,
      goals: [],
      has_existing_site: false,
      page_count: undefined,
      features: [],
      design_style: undefined,
      timeline_preference: undefined,
      budget_band: undefined,
      contact_name: '',
      contact_email: '',
      company_name: '',
      contact_phone: '',
      description: '',
      ...persisted,
    },
    mode: 'onTouched', // validate on blur, not on every keystroke
  });

  // Persist to sessionStorage on every change
  const values = methods.watch();
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, [values]);

  return methods;
}