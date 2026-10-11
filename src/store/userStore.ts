import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStoreState {
  activeRole: string | null;
  setActiveRole: (role: string | null) => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      activeRole: null,
      setActiveRole: (activeRole) => set({ activeRole }),
    }),
    {
      name: "dream-user-role",
    }
  )
);
