import { create } from "zustand";

export type AuthStep = "PHONE" | "OTP" | "REGISTER";

interface AuthModalState {
  isOpen: boolean;
  step: AuthStep;
  phone: string;
  resendCooldown: number;
  onSuccessCallback?: () => void;
  returnFocusTo: HTMLElement | null;
  openAuthModal: (initialPhone?: string, onSuccess?: () => void) => void;
  closeAuthModal: () => void;
  setStep: (step: AuthStep) => void;
  setPhone: (phone: string) => void;
  setResendCooldown: (seconds: number) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  step: "PHONE",
  phone: "",
  resendCooldown: 0,
  onSuccessCallback: undefined,
  returnFocusTo: null,
  openAuthModal: (initialPhone = "", onSuccess) =>
    set({
      isOpen: true,
      step: "PHONE",
      phone: initialPhone,
      onSuccessCallback: onSuccess,
      returnFocusTo: typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }),
  closeAuthModal: () =>
    set({
      isOpen: false,
      step: "PHONE",
      phone: "",
      resendCooldown: 0,
      onSuccessCallback: undefined,
    }),
  setStep: (step) => set({ step }),
  setPhone: (phone) => set({ phone }),
  setResendCooldown: (resendCooldown) => set({ resendCooldown }),
}));
