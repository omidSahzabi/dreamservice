import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "home", "");
}


import Hero from '@/components/templates/Hero'
import CallToAction from '@/components/templates/callToAction/CallToAction';
import Packages from '@/components/templates/Packages';
import SampleProjects from '@/components/templates/sampleProjects/SampleProjects';
import LaunchCountdown from '@/components/templates/LaunchCountdown';

export default function Home() {
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
