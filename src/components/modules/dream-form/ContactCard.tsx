'use client';

import React from 'react';
import { Phone, MessageCircle, Info, LucideIcon } from 'lucide-react';

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
  phoneLabel = 'تماس با ما',
  mainIcon: MainIcon = Phone,
  badgeIcon: BadgeIcon = MessageCircle,
  buttons = [
    { text: 'درخواست همکاری', icon: MessageCircle, onClick: () => {}, variant: 'outline' },
    { text: 'درباره ما', icon: Info, onClick: () => {}, variant: 'filled' },
  ],
  className = '',
  style,
  width,
  gradient = 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
}) => {
  return (
    <div
      className={`
        relative overflow-hidden
        bg-white/10 backdrop-blur-lg
        border border-white/20
        rounded-2xl p-6
        shadow-xl
        ${className}
      `}
      style={{ 
        background: gradient,
        width: width,
        ...style,
      }}
    >
      {/* گرادینت decorative */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="relative flex items-center justify-between flex-wrap gap-4">
        {/* سمت چپ - اطلاعات تماس */}
        <div className="flex items-center gap-4">
          {/* آیکون اصلی */}
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MainIcon className="w-6 h-6 text-white" />
            </div>
            {/* آیکون badge */}
            {BadgeIcon && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <BadgeIcon className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* متن */}
          <div className="flex flex-col">
            <span className="text-white/70 text-sm font-medium">
              {phoneLabel}
            </span>
            <a
              href={`tel:${phoneNumber}`}
              className="text-white text-xl font-bold hover:text-blue-300 transition-colors"
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
              rounded-[20px_4px_20px_4px]
              text-white font-medium text-sm
              transition-all duration-300
              hover:scale-105 hover:shadow-lg
              flex items-center gap-2
            `;

            const variantClasses = button.variant === 'filled'
              ? 'bg-cyan-400 hover:bg-blue-700'
              : 'bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm ';

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