import Hero from '@/components/templates/Hero'
import CallToAction from '@/components/templates/CallToAction';
import Packages from '@/components/templates/Packages';
import SampleProjects from '@/components/templates/SampleProjects';
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
