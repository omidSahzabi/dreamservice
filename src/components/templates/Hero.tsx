"use client";

import {useTranslations} from "next-intl";
import {useRouter} from "@/lib/i18n/navigation";
import {useRef} from "react";
import {useScroll, useSpring} from "framer-motion";
import ContactCard from "@/components/modules/dream-form/ContactCard";
import {IsometricDigitalStructure} from "@/components/modules/hero/IsometricDigitalStructure";
import { Phone, MessageCircle , Users, FileText } from "lucide-react"; 

export default function Hero() {
  const t = useTranslations("Hero");
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const {scrollYProgress} = useScroll({target: heroRef, offset: ["start start", "center start"]});
  const progress = useSpring(scrollYProgress, {stiffness: 130, damping: 30, mass: .35});
  return (
    <div ref={heroRef} className="flex w-full flex-col items-center justify-center px-4 pt-6 sm:pt-8 gap-6">
      <div className="grid w-full max-w-6xl min-w-0 items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,3.2fr)_minmax(0,1fr)] lg:gap-x-6">
        <IsometricDigitalStructure progress={progress} variation="spire" className="col-start-1 row-start-1 h-28 w-24 justify-self-start sm:h-36 sm:w-32 lg:h-[19rem] lg:w-full" />

        <h1 className="col-start-1 row-start-2 min-w-0 break-words text-4xl sm:text-5xl md:text-6xl lg:col-start-2 lg:row-start-1 lg:text-7xl font-bold text-center leading-tight">
          {t.rich("headline", {highlight: chunks => <span className="text-primary">{chunks}</span>})}
        </h1>

        <IsometricDigitalStructure progress={progress} variation="terrace" className="col-start-1 row-start-1 h-28 w-24 justify-self-end sm:h-36 sm:w-32 lg:col-start-3 lg:h-[19rem] lg:w-full" />
      </div>

      <p className="text-muted-foreground text-center max-w-2xl">
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
