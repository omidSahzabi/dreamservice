// components/fields/CardSelectField.tsx

'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { cn } from '@/lib/utils';
import type { CardSelectField as CardSelectFieldType } from '../../types/step.types';
import type { OrderFormData } from '../../types/order.types';

interface Props {
  field: CardSelectFieldType;
}

export function CardSelectField({ field }: Props) {
  const { control, formState: { errors } } = useFormContext<OrderFormData>();
  const error = errors[field.name];

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[field.columns ?? 3];

  return (
    <Controller
      control={control}
      name={field.name as any}
      render={({ field: { value, onChange } }) => (
        <div className="space-y-3">
          <div className={cn('grid gap-3', gridCols)}>
            {field.options.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={cn(
                    'relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all',
                    'hover:border-primary/50 hover:shadow-sm',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-background'
                  )}
                >
                  {option.icon && <option.icon />}
                  <span className="font-medium text-sm">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                  {option.badge && (
                    <span className="absolute top-3 right-3 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {option.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {error && (
            <p className="text-sm text-destructive">{error.message as string}</p>
          )}
        </div>
      )}
    />
  );
}