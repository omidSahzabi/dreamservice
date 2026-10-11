"use client";

import {useTranslations} from "next-intl";
import {useRouter} from "@/lib/i18n/navigation";
import { motion } from "framer-motion";
import ContactCard from "@/components/modules/dream-form/ContactCard";
import { Phone, MessageCircle , Users, FileText } from "lucide-react"; 

export default function Hero() {
  const t = useTranslations("Hero");
  const router = useRouter();
  return (
    <div className="flex w-full flex-col items-center justify-center px-4 pt-7 gap-6">
      <div className="flex w-full max-w-6xl min-w-0 items-center justify-center gap-4 md:gap-8">
        <motion.svg
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden shrink-0 sm:block sm:w-16 sm:h-16 md:w-32 md:h-32 text-cyan-400 me-4 md:me-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </motion.svg>

        <h1 className="min-w-0 break-words text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-bold text-center leading-tight">
          {t.rich("headline", {highlight: chunks => <span className="text-cyan-400">{chunks}</span>})}
        </h1>

        <motion.svg
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1 , ease: "easeOut", delay: 0.1 }}
          className="hidden shrink-0 sm:block sm:w-16 sm:h-16 md:w-32 md:h-32 text-cyan-400 ms-4 md:ms-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </motion.svg>
      </div>

      <p className="text-slate-400 text-center max-w-2xl">
        {t("subtitle")}
      </p>

      <ContactCard
        phoneNumber="021-12345678"
        phoneLabel={t("support")}
        mainIcon={Phone}
        badgeIcon={MessageCircle}
        buttons={[
          { 
            text: t('about'),
            icon: Users, 
            onClick: () => router.push('/about'),
            variant: 'outline' 
          },
          { 
            text: t('order'),
            icon: FileText, 
            onClick: () => router.push('/order/order-form'),
            variant: 'filled' 
          }
        ]}
        width={800}
      />
    </div>
  );
}