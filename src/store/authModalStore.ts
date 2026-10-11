import { create } from "zustand";

export type AuthStep = "PHONE" | "OTP" | "REGISTER";

interface AuthModalState {
  isOpen: boolean;
  step: AuthStep;
  phone: string;
  resendCooldown: number;
  onSuccessCallback?: () => void;
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
  openAuthModal: (initialPhone = "", onSuccess) =>
    set({
      isOpen: true,
      step: "PHONE",
      phone: initialPhone,
      onSuccessCallback: onSuccess,
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
