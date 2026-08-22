// hooks/useOrderStepper.ts

import { useState, useCallback } from 'react';
import { ORDER_STEPS } from '../config/steps.config';
import { useFormContext } from 'react-hook-form';
import type { OrderFormData } from '../types/order.types';

export function useOrderStepper() {
  const [currentStep, setCurrentStep] = useState(0);
  const { getValues } = useFormContext<OrderFormData>();

  // Filter steps based on shouldShow conditions
  const visibleSteps = ORDER_STEPS.filter(
    (step) => !step.shouldShow || step.shouldShow(getValues())
  );

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, visibleSteps.length - 1));
  }, [visibleSteps.length]);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStep(index);
  }, []);

  return {
    currentStep,
    visibleSteps,
    totalSteps: visibleSteps.length,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === visibleSteps.length - 1,
    goNext,
    goBack,
    goToStep,
  };
}