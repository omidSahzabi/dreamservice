"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMe, logoutUser, UserResponse } from "@/lib/auth/authClient";
import { useUserStore } from "@/store/userStore";
import { useEffect } from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { localizeApiError } from "@/lib/api/errors";
import { clearSensitiveState } from "@/lib/auth/client-state";
import { useRouter } from "@/lib/i18n/navigation";

export function useAuth() {
  const t = useTranslations("Errors");
  const queryClient = useQueryClient();
  const router = useRouter();
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
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (isLoading) return;
    const identity = isError || !user ? "anonymous" : JSON.stringify([user.id, user.permission, [...user.roles].sort()]);
    if (queryClient.getQueryData(["security-identity"]) !== identity) {
      queryClient.setQueryData(["security-identity"], identity);
      void clearSensitiveState(queryClient);
      router.refresh();
    }
  }, [user, isLoading, isError, queryClient, router]);

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
    onSettled: async () => {
      await clearSensitiveState(queryClient);
      setActiveRole(null);
      queryClient.setQueryData(["authUser"], null);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      router.refresh();
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
