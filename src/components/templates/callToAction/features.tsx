import { Rocket, Shield, Zap, Users, Award, Heart } from "lucide-react";

export const features = [
  { icon: <Rocket className="w-6 h-6" />, title: "سرعت بالا", description: "بهینه‌سازی شده برای بالاترین سرعت" },
  { icon: <Shield className="w-6 h-6" />, title: "امنیت کامل", description: "Protection با استانداردهای روز دنیا" },
  { icon: <Zap className="w-6 h-6" />, title: "پشتیبانی ۲۴/۷", description: "تیم ما همیشه آنلاین و آماده کمک" },
  { icon: <Users className="w-6 h-6" />, title: "تیم متخصص", description: "سال‌ها تجربه در حوزه فناوری" },
  { icon: <Award className="w-6 h-6" />, title: "کیفیت برتر", description: "بهترین خدمات با بهترین قیمت" },
  { icon: <Heart className="w-6 h-6" />, title: "مشتری مداری", description: "رضایت شما اولویت ماست" },
];


export const buttons = [
  { text: "شروع همکاری", variant: "primary", onClick: () => {}, id:'1' },
  { text: "مشاوره رایگان", variant: "secondary", onClick: () => {}, id:'2' },
  { text: "نمونه کارها", variant: "outline", onClick: () => {}, id:'3' },
  { text: "تماس با ما", variant: "outline", onClick: () => {}, id:'4' },
];
