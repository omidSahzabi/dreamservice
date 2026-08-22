// queries/useUpdateDraft.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderKeys } from './keys';
import type { OrderFormData } from '../types/order.types';

interface UpdateDraftPayload {
  orderId: number;
  currentStep: number;
  formData: Partial<OrderFormData>;
}

async function updateDraft({ orderId, currentStep, formData }: UpdateDraftPayload) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_step: currentStep, form_data: formData }),
  });
  if (!res.ok) throw new Error('Autosave failed');
  return res.json();
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateDraft,
    // Optimistic update
    onMutate: async ({ orderId, formData }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.draft(orderId) });
      const previous = queryClient.getQueryData(orderKeys.draft(orderId));
      queryClient.setQueryData(orderKeys.draft(orderId), (old: any) => ({
        ...old,
        ...formData,
      }));
      return { previous };
    },
    onError: (_err, { orderId }, context) => {
      queryClient.setQueryData(orderKeys.draft(orderId), context?.previous);
    },
    onSettled: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.draft(orderId) });
    },
  });
}