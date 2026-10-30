import {pageMetadata} from "@/lib/i18n/metadata";
export function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  return pageMetadata(params, "home", "");
}


import Hero from '@/components/templates/Hero'
import CallToAction from '@/components/templates/callToAction/CallToAction';
import Packages from '@/components/templates/Packages';
import SampleProjects from '@/components/templates/sampleProjects/SampleProjects';
import LaunchCountdown from '@/components/templates/LaunchCountdown';
import {publicSite} from '@/lib/site';

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebSite',
        name: 'DreamService', url: publicSite.url, inLanguage: ['en', 'fa']
      }).replace(/</g, '\\u003c')}} />
      <Hero />
      <CallToAction />
      <Packages />
      <div className="[&>section]:pb-0">
        <SampleProjects />
      </div>
      <LaunchCountdown />
    </main>
  );
}
