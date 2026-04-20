"use client";
import React from 'react';
import { 
  Instagram, 
  Twitter, 
  Linkedin, 
  Github, 
  Mail, 
  MapPin, 
  Phone,
  ArrowUpRight,
  Heart
} from 'lucide-react';

export default function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: 'دسترسی سریع',
      links: [
        { label: 'خانه', href: '#' },
        { label: 'پروژه‌ها', href: '#projects' },
        { label: 'درباره من', href: '#about' },
        { label: 'تماس', href: '#contact' },
      ],
    },
    {
      title: 'پروژه‌ها',
      links: [
        { label: 'وب‌سایت‌ها', href: '#' },
        { label: 'اپلیکیشن‌ها', href: '#' },
        { label: 'UI/UX', href: '#' },
        { label: 'پلاگین‌ها', href: '#' },
      ],
    },
    {
      title: 'ارتباط',
      links: [
        { label: 'ایمیل', href: 'mailto:example@email.com', icon: Mail },
        { label: 'لینکدین', href: '#', icon: Linkedin },
        { label: 'گیتهاب', href: '#', icon: Github },
        { label: 'توییتر', href: '#', icon: Twitter },
      ],
    },
  ];

  const socialLinks = [
    { name: 'اینستاگرام', href: '#', icon: Instagram },
    { name: 'توییتر', href: '#', icon: Twitter },
    { name: 'لینکدین', href: '#', icon: Linkedin },
    { name: 'گیتهاب', href: '#', icon: Github },
  ];

  return (
    <footer className="relative bg-slate-950 border-t border-white/10">
      {/* گرادینت بالای فوتر */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* بخش اول - لوگو و توضیحات */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">ع</span>
              </div>
              <span className="text-white font-bold text-xl">علیرضا</span>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              توسعه‌دهنده وب با تمرکز بر طراحی رابط‌های کاربری زیبا و تجربه کاربری فوق‌العاده
            </p>
            
            {/* اطلاعات تماس */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>example@email.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>تهران، ایران</span>
              </div>
            </div>
          </div>

          {/* لینک‌های فوتر */}
          {footerLinks.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-white font-bold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link, linkIdx) => {
                  const Icon = link.icon;
                  return (
                    <li key={linkIdx}>
                      <a 
                        href={link.href}
                        className="text-gray-400 hover:text-cyan-400 text-sm transition-colors flex items-center gap-2 group"
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        <span className="group-hover:translate-x-1 transition-transform">
                          {link.label}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* بخش پایین فوتر */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* کپی‌رایت */}
            <p className="text-gray-500 text-sm flex items-center gap-1">
              © {currentYear} تمامی حقوق محفوظ است با 
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              ساخته شده
            </p>

            {/* شبکه‌های اجتماعی */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social, idx) => {
                const Icon = social.icon;
                return (
                  <a
                    key={idx}
                    href={social.href}
                    aria-label={social.name}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:border-cyan-400/50 transition-all group"
                  >
                    <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </a>
                );
              })}
            </div>

            {/* دکمه برگشت به بالا */}
            <a
              href="#"
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-cyan-400 hover:border-cyan-400 transition-all group"
            >
              <ArrowUpRight className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}