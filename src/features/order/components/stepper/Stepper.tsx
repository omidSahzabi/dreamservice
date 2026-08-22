// components/stepper/Stepper.tsx

'use client';

import { FormProvider } from 'react-hook-form';
import { useOrderForm } from '../../hooks/useOrderForm';
import { useOrderStepper } from '../../hooks/useOrderStepper';
import { ORDER_STEPS } from '../../config/steps.config';
import { StepRenderer } from './StepRenderer';
import { StepProgress } from './StepProgress';
import { StepNavigation } from './StepNavigation';

export function Stepper() {
  const methods = useOrderForm();
  const { currentStep, goNext, goBack, isFirstStep, isLastStep } = useOrderStepper();

  const step = ORDER_STEPS[currentStep];

  const handleNext = methods.handleSubmit(async (data) => {
    // Validate only the current step's fields
    const stepFieldNames = step.fields.map((f) => f.name);
    const isValid = await methods.trigger(stepFieldNames as any);
    if (isValid) goNext();
  });

  return (
    <FormProvider {...methods}>
      <div className="min-h-screen flex flex-col">
        <StepProgress current={currentStep} total={ORDER_STEPS.length} />

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            <StepRenderer step={step} />
          </div>
        </main>

        <StepNavigation
          onBack={goBack}
          onNext={handleNext}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          isSubmitting={methods.formState.isSubmitting}
        />
      </div>
    </FormProvider>
  );
}