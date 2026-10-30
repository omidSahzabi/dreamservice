import { create } from "zustand";
import type { OrderFormData } from "@/types/order";

interface OrderStore {
  currentStep: number;
  formData: OrderFormData;
  submission: { fingerprint: string; key: string } | null;
  setSubmission: (submission: { fingerprint: string; key: string }) => void;

  setStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;

  updateFormData: (data: Partial<OrderFormData>) => void;
  setFormData: (data: OrderFormData) => void;
  resetForm: () => void;
}

export const useOrderStore = create<OrderStore>()(
    (set) => ({
      currentStep: 0,
      formData: {},
      submission: null,
      setSubmission: (submission) => set({ submission }),

      setStep: (step) =>
        set({
          currentStep: Math.max(0, step),
        }),

      nextStep: () =>
        set((state) => ({
          currentStep: state.currentStep + 1,
        })),

      previousStep: () =>
        set((state) => ({
          currentStep: Math.max(0, state.currentStep - 1),
        })),

      updateFormData: (data) =>
        set((state) => ({
          formData: { ...state.formData, ...data },
        })),

      setFormData: (data) =>
        set({
          formData: data,
        }),

      resetForm: () =>
        set({
          currentStep: 0,
          formData: {},
          submission: null,
        }),
    })
);
