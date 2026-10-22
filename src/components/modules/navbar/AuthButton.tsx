"use client";

import {localizeApiError} from "@/lib/api/errors";
import {Link} from "@/lib/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModalStore } from "@/store/authModalStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Check, ShoppingBag } from "lucide-react";

export function AuthButton() {
  const t = useTranslations("Navbar");
  const locale = useLocale();
  const errors = useTranslations("Errors");
  const common = useTranslations("Common");
  const { user, isAuthenticated, isLoading, isError, error, refetch, logout, isLoggingOut, activeRole, setActiveRole } =
    useAuth();
  const { openAuthModal } = useAuthModalStore();

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        disabled
        className="text-muted-foreground border border-border rounded-xl px-4 py-2 text-sm"
      >
        <span className="w-3 h-3 rounded-full border-2 border-text-muted border-t-transparent animate-spin me-2" />
        {t("loading")}
      </Button>
    );
  }

  if (isError) {
    return <Button variant="outline" title={localizeApiError(error, errors)} onClick={() => refetch()}>{common("retry")}</Button>;
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        onClick={() => openAuthModal()}
        className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-xl px-4 py-2 transition-all duration-200 shadow-xs"
      >
        <User className="w-4 h-4 me-2" />
        {t("login")}
      </Button>
    );
  }

  const displayName =
    [user.fname, user.lname].filter(Boolean).join(" ") || user.contact || user.email || t("account");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu dir={locale === "fa" ? "rtl" : "ltr"}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 p-1.5 rounded-xl border border-border hover:bg-primary/10 transition-colors"
        >
          <Avatar className="w-7 h-7 bg-primary/10 border border-primary/40">
            <AvatarFallback className="text-xs text-primary font-semibold bg-transparent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground max-w-[100px] truncate">
            <bdi>{displayName}</bdi>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={locale === "fa" ? "end" : "start"}
        className="w-56 bg-popover border-border text-foreground shadow-xl rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground px-2 py-1.5">
          <bdi>{user.contact || user.email || displayName}</bdi>
        </DropdownMenuLabel>

        {user.roles && user.roles.length > 1 && (
          <>
            <DropdownMenuSeparator className="bg-secondary" />
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {t("activeRole")}
            </div>
            {user.roles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => setActiveRole(role)}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:bg-primary/10 hover:text-primary"
              >
                <span>{t.has(`roles.${role}`) ? t(`roles.${role}`) : t("roles.other")}</span>
                {activeRole === role && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator className="bg-secondary" />

        {user.permission === "ADMIN" && <DropdownMenuItem asChild className="rounded-lg cursor-pointer hover:bg-primary/10 hover:text-primary">
          <Link href="/order/review-orders" className="flex items-center gap-2 px-2 py-1.5 text-xs">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span>{t("viewOrders")}</span>
          </Link>
        </DropdownMenuItem>}

        <DropdownMenuSeparator className="bg-secondary" />

        <DropdownMenuItem
          disabled={isLoggingOut}
          onClick={() => logout()}
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
