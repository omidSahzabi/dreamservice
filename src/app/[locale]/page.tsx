'use client'; // اضافه کنید

import Hero from '@/components/templates/Hero'
import CallToAction from '@/components/templates/callToAction/CallToAction';
import Packages from '@/components/templates/Packages';
import SampleProjects from '@/components/templates/sampleProjects/SampleProjects';
import LaunchCountdown from '@/components/templates/LaunchCountdown';

export default function Home() {
  console.log('test111')
  return (
    <div>
      <Hero />
      <CallToAction />
      <Packages />
      <SampleProjects />
      <LaunchCountdown />
    </div>
  );
}
