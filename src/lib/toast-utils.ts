import { toast } from "sonner";

export const showToast = {
  error: (message: string) => {
    toast.error(message);
  },
  success: (message: string) => {
    toast.success(message);
  }
};
