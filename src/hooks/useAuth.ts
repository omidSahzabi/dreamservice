"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, logoutUser, UserResponse } from "@/lib/auth/authClient";
import { useUserStore } from "@/store/userStore";
import { useEffect } from "react";

export function useAuth() {
  const queryClient = useQueryClient();
  const { activeRole, setActiveRole } = useUserStore();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<UserResponse | null>({
    queryKey: ["authUser"],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (user && user.roles.length > 0) {
      if (!activeRole || !user.roles.includes(activeRole)) {
        setActiveRole(user.roles[0]);
      }
    } else if (!user) {
      setActiveRole(null);
    }
  }, [user, activeRole, setActiveRole]);

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      setActiveRole(null);
      queryClient.setQueryData(["authUser"], null);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
  });

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    isError,
    activeRole,
    setActiveRole,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
