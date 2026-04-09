"use client";

import { motion } from "framer-motion";
import ContactCard from "@/components/modules/dream-form/ContactCard";
import { Phone, MessageCircle , Users, FileText } from "lucide-react"; 

export default function Hero(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center pt-7 gap-6">
      <div className="flex items-center gap-4 md:gap-8">
        <motion.svg
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-24 h-24 md:w-32 md:h-32 text-cyan-400 mr-4 md:mr-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
            {/* this is where u should replace  */}
          <path d="M12 19V5M5 12l7-7 7 7" />
        </motion.svg>

        <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold text-center leading-tight">
          ما <span className="text-cyan-400">تجربه کاربر را</span> بهبود میدهیم
        </h1>

        <motion.svg
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1 , ease: "easeOut", delay: 0.1 }}
          className="w-24 h-24 md:w-32 md:h-32 text-cyan-400 ml-4 md:ml-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
        {/* this is where u should replace  */}
          <path d="M12 19V5M5 12l7-7 7 7" />
        </motion.svg>
      </div>

      <p className="text-slate-400 text-center max-w-2xl">
        لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ و با استفاده از طراحان گرافیک است.
        چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است.
      </p>

      <ContactCard
        phoneNumber="021-12345678"
        phoneLabel="پشتیبانی"
        mainIcon={Phone}
        badgeIcon={MessageCircle}
        buttons={[
          { 
            text: 'درباره ما', 
            icon: Users, 
            onClick: () => console.log('همکاری'), 
            variant: 'outline' 
          },
          { 
            text: 'ثبت سفارش', 
            icon: FileText, 
            onClick: () => console.log('درباره ما'), 
            variant: 'filled' 
          }
        ]}
        width={800}
      />
    </div>
  );
}