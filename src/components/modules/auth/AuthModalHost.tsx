"use client";

import dynamic from "next/dynamic";
import {useTranslations} from "next-intl";
import {useAuthModalStore} from "@/store/authModalStore";

function Loading() {
  const t = useTranslations("Common");
  return <span className="sr-only" role="status">{t("loading")}</span>;
}

const AuthModal = dynamic(() => import("./AuthModal").then(module => module.AuthModal), {
  ssr: false,
  loading: Loading,
});

export function AuthModalHost({previewLoginEnabled = false}: {previewLoginEnabled?: boolean}) {
  const isOpen = useAuthModalStore(state => state.isOpen);
  return isOpen ? <AuthModal previewLoginEnabled={previewLoginEnabled} /> : null;
}
