import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orderKeys } from './keys';

async function createDraft() {
  const res = await fetch('/api/orders', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create draft');
  return res.json();
}

export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDraft,
    onSuccess: (data) => {
      queryClient.setQueryData(orderKeys.draft(data.order_id), data);
    },
  });
}