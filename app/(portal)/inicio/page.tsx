import { HeroSection } from '@/components/portal/HeroSection';
import { NoticesSection } from '@/components/portal/NoticesSection';
import { QuickLinksSection } from '@/components/portal/QuickLinksSection';
import { CommunicationsSection } from '@/components/portal/CommunicationsSection';
import { CampaignsSection } from '@/components/portal/CampaignsSection';
import { MuralSection } from '@/components/portal/MuralSection';

export default function InicioPage() {
  return (
    <>
      <HeroSection />
      <NoticesSection />
      <QuickLinksSection />
      <CommunicationsSection />
      <CampaignsSection />
      <MuralSection />
    </>
  );
}
