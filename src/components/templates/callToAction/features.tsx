import {Rocket, Shield, Zap, Users, Award, Heart} from 'lucide-react';
export const features = [
  {key: 'speed', Icon: Rocket}, {key: 'security', Icon: Shield},
  {key: 'support', Icon: Zap}, {key: 'team', Icon: Users},
  {key: 'quality', Icon: Award}, {key: 'care', Icon: Heart}
] as const;
export const buttons = [
  {key: 'collaborate', variant: 'primary', href: '/order/order-form'},
  {key: 'consultation', variant: 'secondary', href: '/order/order-form'},
  {key: 'projects', variant: 'outline', href: '/#projects'},
  {key: 'contact', variant: 'outline', href: '/#contact'}
] as const;
