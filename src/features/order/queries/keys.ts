export const orderKeys = {
  all: ['orders'] as const,
  draft: (id: number) => ['orders', 'draft', id] as const,
  list: () => ['orders', 'list'] as const,
};