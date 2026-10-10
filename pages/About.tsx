import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import NonToxicFoodSafeIcon from '../components/NonToxicFoodSafeIcon';
import FairWageGuildIcon from '../components/FairWageGuildIcon';
import TimberCratePackagingIcon from '../components/TimberCratePackagingIcon';
import AuthenticityGuaranteeIcon from '../components/AuthenticityGuaranteeIcon';

const About: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="w-full bg-white min-h-screen text-gray-800 font-sans selection:bg-[#F2E4D8] selection:text-[#2B221B] flex flex-col">
      {/* Top Header Bar with separation line and page headline beside back button - matching Privacy Policy */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-3 sm:py-3.5 flex items-center">
          <button
            type="button"
            onClick={() => handleGoBack(navigate, '/')}
            className="inline-flex items-center gap-2.5 text-gray-800 hover:text-gray-900 rounded-lg transition-colors cursor-pointer group"
            aria-label="Go back to Store"
          >
            <ArrowLeft size={20} className="text-gray-700 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              About Us
            </span>
          </button>
        </div>
      </header>

      {/* Main Document Body - Simple, readable layout matching Privacy Policy */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 pt-4 pb-12 sm:pt-6 sm:pb-16">
        <article className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              About MArts Handcrafted
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-2 leading-relaxed">
              Preserving generational master craftsmanship: wheel-thrown terracotta pottery, vitrified ceramics, and hand-chiseled stone sculptures.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Operated under the MArts Guild Ecosystem • Master Artisans Guild &amp; Heritage Craft Preservation
            </p>
          </div>

          {/* Section 1: Our Origin & Philosophy */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              1. Our Philosophy &amp; Artisan Roots
            </h2>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              MArts was founded with a singular conviction: genuine art belongs in everyday living, shaped honestly by human hands rather than synthetic mass production. In an era of plastic uniformity and automated factory stamping, our master craftsmen practice the slow, revered arts of the wheel and chisel.
            </p>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              Every urn, sculptural planter, hand-turned vessel, and chiseled deity in our atelier carries the distinct fingerprint of its maker and the organic mark of wood-fired kilns.
            </p>
          </section>

          {/* Section 2: Guild Clusters & Heritage Guilds */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              2. Generational Craftsmanship &amp; Guild Clusters
            </h2>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              We partner directly with over 200 hereditary artisan families across recognized heritage craft belts in Bengal, Khurja, and Rajasthan. Raw alluvial riverbed clay is filtered, wedged, and thrown on slow-spinning wooden wheels. Our stone sculptors chisel solid monolithic sandstone and natural marble using hand mallets and hardened steel tips.
            </p>
          </section>

          {/* Section 3: Core Craft Standards (Boxed highlights matching Privacy Policy) */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              3. Our Standards of Integrity
            </h2>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <NonToxicFoodSafeIcon size={18} className="shrink-0" />
                  <span>100% Non-Toxic &amp; Food-Safe</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  We use only lead-free, cadmium-free feldspar and mineral glazes, fully safe for culinary use, drinking water, and everyday home living.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FairWageGuildIcon size={18} className="shrink-0" />
                  <span>Fair-Wage Guild Support</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  Every artisan is directly compensated with fair living wages, enabling generational families to sustain ancient traditions with dignity.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <TimberCratePackagingIcon size={18} className="shrink-0" />
                  <span>Timber-Crate Packaging</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  All fragile terracotta, stoneware, and heavy monolithic statues are shipped in custom multi-layer foam and timber wooden crating for zero-breakage transit.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <AuthenticityGuaranteeIcon size={18} className="shrink-0" />
                  <span>Authenticity Guarantee</span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  Each piece comes with an artisan guild authenticity assurance, guaranteeing master wheel-thrown or hand-chiseled craftsmanship.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Contact & Inquiries */}
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-3">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">
              Artisan Guild Inquiries &amp; Customer Support
            </h2>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              For questions regarding custom pottery orders, architectural sculpture commissions, or shipping inquiries, our artisan support team is available daily.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-1 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[#C85A32]" />
                <a href="tel:+919876543210" className="hover:text-[#C85A32] font-semibold transition-colors">
                  +91 98765 43210
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#C85A32]" />
                <a href="mailto:atelier@marts.com" className="hover:text-[#C85A32] font-semibold transition-colors">
                  atelier@marts.com
                </a>
              </div>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
};

export default About;
