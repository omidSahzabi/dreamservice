import type { NavItem } from "@/components/modules/navbar/Navbar" 

export const navItems: NavItem[] = [
  {
    label: "صفحه اصلی",
    href: "/",
  },
  {
    label: "سوالات متداول",
    href: "/faq",
  },
  {
    label: "خدمات",
    children: [
      {
        label: "طراحی سایت",
        href: "/services/web-design",
        description: "طراحی مدرن و سریع با تمرکز روی تجربه کاربری",
      },
      {
        label: "توسعه وب اپلیکیشن",
        href: "/services/web-app",
        description: "ساخت اپلیکیشن‌های مقیاس‌پذیر با Next.js",
      },
      {
        label: "بازی‌سازی",
        href: "/services/game-dev",
        description: "توسعه بازی‌های دوبعدی و سه‌بعدی حرفه‌ای",
      },
      {
        label: "بهینه‌سازی و سئو",
        href: "/services/seo",
        description: "افزایش سرعت، رتبه و عملکرد سایت شما",
      },
    ],
  },
  {
    label: "وبلاگ",
    href: "/blog",
  },
  {
    label: "درباره ما",
    href: "/about",
  },
];


export const packages: Package[] = [
    { id: 1, title: 'پشتیبانی', description: 'کتابخانه UI', bgColor: 'bg-blue-500/20', arrowColor: 'text-blue-400' },
    { id: 2, title: 'منتورشیپ', description: 'فریم‌ورک پیشرو', bgColor: 'bg-green-500/20', arrowColor: 'text-green-400' },
    { id: 3, title: 'فروشگاهی', description: 'فریم‌ورک کامل', bgColor: 'bg-red-500/20', arrowColor: 'text-red-400' },
    { id: 4, title: 'seo', description: 'فریم‌ورک ری‌اکت', bgColor: 'bg-white/10', arrowColor: 'text-white' },
    { id: 5, title: 'وب دیزاین', description: 'سرور نود', bgColor: 'bg-red-600/20', arrowColor: 'text-red-500' },
    { id: 6, title: 'بک اند', description: 'فریم‌ورک وب', bgColor: 'bg-gray-500/20', arrowColor: 'text-gray-400' },
    { id: 7, title: 'فرانت', description: 'جاوااسکریپت تایپ‌دار', bgColor: 'bg-blue-600/20', arrowColor: 'text-blue-500' },
    { id: 8, title: 'بالله', description: 'تست فرانت', bgColor: 'bg-amber-500/20', arrowColor: 'text-amber-400' },
    { id: 9, title: 'اپلیکیشن', description: 'رابط برنامه‌نویسی', bgColor: 'bg-purple-500/20', arrowColor: 'text-purple-400' },
];