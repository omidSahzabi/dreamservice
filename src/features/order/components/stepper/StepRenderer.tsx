// components/stepper/StepRenderer.tsx

'use client';

import { useFormContext } from 'react-hook-form';
import type { OrderStep, StepField } from '../../types/step.types';
import type { OrderFormData } from '../../types/order.types';
import { CardSelectField } from '../fields/CardSelectField';
import { ChipMultiselectField } from '../fields/ChipMultiselectField';
import { SliderField } from '../fields/SliderField';
import { TextInputField } from '../fields/TextInputField';
import { TextareaField } from '../fields/TextareaField';
import { ConditionalField } from '../fields/ConditionalField';
import { StepHeader } from './StepHeader';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  step: OrderStep;
}

function FieldRenderer({ field }: { field: StepField }) {
  const { watch } = useFormContext<OrderFormData>();
  const values = watch();

  switch (field.type) {
    case 'card-select':
      return <CardSelectField field={field} />;
    case 'chip-multiselect':
      return <ChipMultiselectField field={field} />;
    case 'slider':
      return <SliderField field={field} />;
    case 'text-input':
    case 'email-input':
    case 'url-input':
      return <TextInputField field={field} />;
    case 'textarea':
      return <TextareaField field={field} />;
    case 'conditional-text-input':
      if (!field.condition(values)) return null;
      return <TextInputField field={field.inner} />;
    default:
      return null;
  }
}

export function StepRenderer({ step }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        <StepHeader
          title={step.title}
          description={step.description}
          hint={step.hint}
          optional={step.optional}
        />

        <div className="space-y-6">
          {step.fields.map((field) => (
            <FieldRenderer key={field.name} field={field} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}