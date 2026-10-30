"use client";
import React from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/lib/i18n/navigation';
import Logo from '@/components/modules/navbar/Logo';
import {publicSite} from '@/lib/site';
import type {LucideIcon} from 'lucide-react';
import { 
  Send,
  Linkedin, 
  Github, 
  Mail, 
  MapPin, 
  ArrowUpRight,
  Heart
} from 'lucide-react';

export default function Footer({year}: {year: number}) {
  const t = useTranslations("Footer");

  const socialLinks = [
    { name: t('telegramSupport'), href: publicSite.social.telegram, icon: Send },
    { name: t('linkedin'), href: publicSite.social.linkedin, icon: Linkedin },
    { name: t('github'), href: publicSite.social.github, icon: Github },
  ];

  const footerLinks: {title: string; links: {label: string; href: string; icon?: LucideIcon; external?: boolean}[]}[] = [
    {
      title: t('quickLinks'),
      links: [
        { label: t('home'), href: '/' },
        { label: t('projects'), href: '/#projects' },
        { label: t('about'), href: '/about' },
        { label: t('contact'), href: '/#contact' },
      ],
    },
    {
      title: t('projects'),
      links: [
        { label: t('websites'), href: '/#projects' },
        { label: t('applications'), href: '/#projects' },
        { label: 'UI/UX', href: '/#projects' },
        { label: t('plugins'), href: '/#projects' },
      ],
    },
    {
      title: t('connect'),
      links: [
        { label: t('email'), href: `mailto:${publicSite.email}`, icon: Mail },
        ...socialLinks.map(social => ({label: social.name, href: social.href, icon: social.icon, external: true})),
      ],
    },
  ];

  return (
    <footer id="contact" className="relative bg-background border-t border-border">

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* بخش اول - لوگو و توضیحات */}
          <div className="lg:col-span-1">
            <div className="mb-4"><Logo /></div>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              {t("description")}
            </p>
            
            {/* اطلاعات تماس */}
            <div className="space-y-3">
              <a href={`mailto:${publicSite.email}`} className="flex items-center gap-3 text-muted-foreground text-sm hover:text-primary transition-colors">
                <Mail aria-hidden="true" className="w-4 h-4 shrink-0 text-primary" />
                <bdi className="min-w-0 break-all">{publicSite.email}</bdi>
              </a>
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{t("location")}</span>
              </div>
            </div>
          </div>

          {/* لینک‌های فوتر */}
          {footerLinks.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-foreground font-bold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link, linkIdx) => {
                  const Icon = link.icon;
                  const content = <>
                    {Icon && <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />}
                    <span className="group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                      {link.label}
                    </span>
                  </>;
                  const linkClass = "text-muted-foreground hover:text-primary text-sm transition-colors flex items-center gap-2 group";
                  return (
                    <li key={linkIdx}>
                      {link.href.startsWith('/') ? (
                        <Link href={link.href} className={linkClass}>{content}</Link>
                      ) : (
                        <a href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined} className={linkClass}>
                          {content}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* بخش پایین فوتر */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* کپی‌رایت */}
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              {t.rich("copyright", {year, heart: () => <Heart aria-label={t("love")} className="w-4 h-4 text-destructive fill-red-500" />})}
            </p>

            {/* شبکه‌های اجتماعی */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social, idx) => {
                const Icon = social.icon;
                return (
                  <a
                    key={idx}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-primary/40 transition-all group"
                  >
                    <Icon aria-hidden="true" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </a>
                );
              })}
            </div>

            {/* دکمه برگشت به بالا */}
            <a
              href="#top"
              aria-label={t("backToTop")}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all group"
            >
              <ArrowUpRight className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
