"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, logoutUser, UserResponse } from "@/lib/auth/authClient";
import { useUserStore } from "@/store/userStore";
import { useEffect } from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { localizeApiError } from "@/lib/api/errors";

export function useAuth() {
  const t = useTranslations("Errors");
  const queryClient = useQueryClient();
  const { activeRole, setActiveRole } = useUserStore();

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
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
    onError: error => toast.error(localizeApiError(error, t)),
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
    error,
    refetch,
    activeRole,
    setActiveRole,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
