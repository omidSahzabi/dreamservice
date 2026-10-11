"use client";

import Link from "next/link";
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
  const { user, isAuthenticated, isLoading, logout, activeRole, setActiveRole } =
    useAuth();
  const { openAuthModal } = useAuthModalStore();

  if (isLoading) {
    return (
      <Button
        variant="ghost"
        disabled
        className="text-slate-400 border border-slate-700/50 rounded-xl px-4 py-2 text-sm"
      >
        <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin me-2" />
        ...
      </Button>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        onClick={() => openAuthModal("sendOtp")}
        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-medium rounded-xl px-4 py-2 transition-all duration-200 shadow-md shadow-cyan-500/20"
      >
        <User className="w-4 h-4 me-2" />
        {t("login")}
      </Button>
    );
  }

  const displayName =
    user.name || user.phone || user.email || t("dashboard");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 p-1.5 rounded-xl border border-cyan-400/30 hover:bg-cyan-400/10 transition-colors"
        >
          <Avatar className="w-7 h-7 bg-cyan-500/20 border border-cyan-400/50">
            <AvatarFallback className="text-xs text-cyan-400 font-semibold bg-transparent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-slate-200 max-w-[100px] truncate">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={locale === "fa" ? "end" : "start"}
        dir={locale === "fa" ? "rtl" : "ltr"}
        className="w-56 bg-slate-900 border-cyan-400/30 text-slate-200 shadow-xl rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="font-normal text-xs text-slate-400 px-2 py-1.5">
          {user.phone || user.email || displayName}
        </DropdownMenuLabel>

        {user.roles && user.roles.length > 1 && (
          <>
            <DropdownMenuSeparator className="bg-slate-800" />
            <div className="px-2 py-1 text-xs text-slate-400">
              {locale === "fa" ? "نقش فعال:" : "Active Role:"}
            </div>
            {user.roles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => setActiveRole(role)}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:bg-cyan-400/10 hover:text-cyan-400"
              >
                <span>{role}</span>
                {activeRole === role && (
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator className="bg-slate-800" />

        <DropdownMenuItem asChild className="rounded-lg cursor-pointer hover:bg-cyan-400/10 hover:text-cyan-400">
          <Link href="/order/review-orders" className="flex items-center gap-2 px-2 py-1.5 text-xs">
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
            <span>{locale === "fa" ? "مشاهده سفارشات" : "View Orders"}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-800" />

        <DropdownMenuItem
          onClick={() => logout()}
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
