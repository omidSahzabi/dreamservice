"use client";

import {useTranslations} from "next-intl";
import {useAuth} from "@/hooks/useAuth";
import {useRouter} from "@/lib/i18n/navigation";
import {useAuthModalStore} from "@/store/authModalStore";
import styles from "./Cinematic.module.css";

export function ProjectCTA() {
  const t = useTranslations("Cinematic");
  const {isAuthenticated, isLoading} = useAuth();
  const router = useRouter();
  const openAuthModal = useAuthModalStore(state => state.openAuthModal);
  const continueToOrder = () => router.push("/order/order-form");

  return (
    <button type="button" className={styles["primary-btn"]} disabled={isLoading} onClick={() => {
      if (isAuthenticated) continueToOrder();
      else openAuthModal("", continueToOrder);
    }}>
      <span>{t("startProject")}</span><span className={styles["btn-arrow"]} aria-hidden="true">↗</span>
    </button>
  );
}
