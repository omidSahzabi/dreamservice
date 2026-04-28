'use client'; // اضافه کنید

import Hero from '@/components/templates/Hero'
import CallToAction from '@/components/templates/CallToAction';
import Packages from '@/components/templates/Packages';
import SampleProjects from '@/components/templates/SampleProjects';
import LaunchCountdown from '@/components/templates/LaunchCountdown';
import { useTranslations } from 'next-intl';



export default function Home() {
  const t = useTranslations('Navbar');

  return (
    <div>
      <p>{t('home')}</p>
      <Hero />
      <CallToAction />
      <Packages />
      <SampleProjects />
      <LaunchCountdown />
    </div>
  );
}
