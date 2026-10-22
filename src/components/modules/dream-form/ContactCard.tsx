'use client';

import React from 'react';
import {useTranslations} from 'next-intl';
import { Phone, MessageCircle, LucideIcon } from 'lucide-react';

interface ButtonConfig {
  text: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'outline' | 'filled';
}

interface ContactCardProps {
  // اطلاعات تماس
  phoneNumber: string;
  phoneLabel?: string;
  
  // آیکون‌ها
  mainIcon?: LucideIcon;
  badgeIcon?: LucideIcon;
  
  // دکمه‌ها
  buttons?: ButtonConfig[];
  
  // استایل
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  gradient?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  phoneNumber,
  phoneLabel,
  mainIcon: MainIcon = Phone,
  badgeIcon: BadgeIcon = MessageCircle,
  buttons = [],
  className = '',
  style,
  width,
  gradient,
}) => {
  const t = useTranslations("ContactCard");
  return (
    <div
      className={`
        relative overflow-hidden
        bg-card
        border border-border
        rounded-2xl p-6
        shadow-soft
        ${className}
      `}
      style={{ 
        background: gradient,
        width: width,
        maxWidth: "100%",
        ...style,
      }}
    >

      <div className="relative flex items-center justify-between flex-wrap gap-4">
        {/* سمت چپ - اطلاعات تماس */}
        <div className="flex items-center gap-4">
          {/* آیکون اصلی */}
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MainIcon className="w-6 h-6" />
            </div>
            {/* آیکون badge */}
            {BadgeIcon && (
              <div className="absolute -bottom-1 -end-1 w-5 h-5 bg-primary text-primary-foreground rounded-full border-2 border-card flex items-center justify-center">
                <BadgeIcon className="w-3 h-3" />
              </div>
            )}
          </div>

          {/* متن */}
          <div className="flex flex-col">
            <span className="text-text-secondary text-sm font-medium">
              {phoneLabel ?? t("contact")}
            </span>
            <a
              href={`tel:${phoneNumber}`}
              dir="ltr"
              className="text-foreground text-xl font-bold hover:text-primary transition-colors"
            >
              {phoneNumber}
            </a>
          </div>
        </div>

        {/* سمت راست - دکمه‌های داینامیک */}
        <div className="flex gap-3 flex-wrap">
          {buttons.map((button, index) => {
            const Icon = button.icon;
            
            const baseClasses = `
              px-5 py-2.5
              rounded-lg
              font-semibold text-sm
              transition-colors duration-200
              flex items-center gap-2
            `;

            const variantClasses = button.variant === 'filled'
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
              : 'bg-card text-foreground hover:bg-accent border border-input';

            return (
              <button
                key={index}
                onClick={button.onClick}
                className={`${baseClasses} ${variantClasses}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {button.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ContactCard;
