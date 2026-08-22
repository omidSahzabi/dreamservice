// hooks/useAutosave.ts

import { useEffect, useRef } from 'react';
import { useUpdateDraft } from '../queries/useUpdateDraft';
import type { OrderFormData } from '../types/order.types';

const AUTOSAVE_DELAY_MS = 1500;

export function useAutosave(
  orderId: number | undefined,
  currentStep: number,
  formValues: Partial<OrderFormData>
) {
  const { mutate: updateDraft } = useUpdateDraft();
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!orderId) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateDraft({ orderId, currentStep, formData: formValues });
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timerRef.current);
  }, [orderId, currentStep, formValues, updateDraft]);
}