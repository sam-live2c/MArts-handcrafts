import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Award, ShieldCheck, Heart, MapPin, Phone, Mail, ArrowRight } from 'lucide-react';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';

const About: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="w-full bg-[#FAF8F5] min-h-screen text-[#2B221B] font-sans flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#EADBCC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleGoBack(navigate, '/')}
            className="inline-flex items-center gap-2 text-[#4E392D] hover:text-[#C85A32] rounded-lg transition-colors cursor-pointer"
            aria-label="Go back to Home"
          >
            <ArrowLeft size={20} />
            <span className="text-sm sm:text-base font-bold">Back to Store</span>
          </button>
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <Logo variant="dark" size="sm" showStoreTag={false} />
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="w-full bg-[#2B221B] text-[#FAF6F0] py-14 sm:py-20 px-4 sm:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-semibold uppercase tracking-wider text-amber-200 border border-white/20">
            About MArts
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-black tracking-tight leading-tight">
            Earth, Chisel, Water &amp; Fire.
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-amber-100/80 max-w-2xl mx-auto leading-relaxed">
            MArts was founded on a simple conviction: the world needs more honest, slow-made art shaped by human hands rather than mass industrial factories.
          </p>
        </div>
      </section>

      {/* Main Narrative */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-12 space-y-12">
        {/* Story Section */}
        <section className="space-y-5">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#2B221B]">
            Our Heritage &amp; Artisans Guild
          </h2>
          <p className="text-sm sm:text-base text-[#5E473A] leading-relaxed">
            Across generational pottery clusters in Bengal, Khurja, and Rajasthan, our master potters shape raw alluvial riverbed clay on slow-spinning wooden wheels. There are no automated stamping machines or synthetic slip-casts here. Every urn, vase, and sculptural vessel carries the unique fingerprint of its maker and the subtle flame kiss of wood-fire kilns vitrified at up to 1,250°C.
          </p>
          <p className="text-sm sm:text-base text-[#5E473A] leading-relaxed">
            Our stone sculptors continue a sacred thousand-year tradition of monolithic chiseling. Blocks of solid natural sandstone and white marble are shaped with hand mallets and hardened steel chisels to create serene Buddhas, deities, and architectural silhouettes that endure for centuries.
          </p>
        </section>

        {/* Core Pillars */}
        <section className="grid sm:grid-cols-3 gap-6 pt-4">
          <div className="bg-white p-6 rounded-2xl border border-[#EADBCC] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2B221B]">100% Organic &amp; Non-Toxic</h3>
            <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
              We exclusively use lead-free, chemical-free natural feldspar and wood-ash mineral glazes safe for dining, drinking, and daily living.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#EADBCC] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center">
              <Award size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2B221B]">Fair-Wage Guild Support</h3>
            <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
              We work directly with over 200+ hereditary artisan families, guaranteeing fair living compensation and preserving ancient craft techniques.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#EADBCC] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#2B221B]">Wooden Crate Packaging</h3>
            <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
              Every delicate ceramic vase and heavy monolithic statue is packed with custom molded foam and hardboard timber crating for zero-breakage delivery.
            </p>
          </div>
        </section>

        {/* Quick Links Card */}
        <section className="bg-[#FAF3EA] border border-[#EADBCC] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-serif font-bold text-xl text-[#2B221B]">Visit Our Atelier Showroom</h3>
            <p className="text-xs sm:text-sm text-[#735A4C]">
              Experience our tactile pottery and stone sculptures in person at our atelier.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/location"
              className="px-5 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>View Location</span>
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/contact"
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#F2EAE2] text-[#4E392D] border border-[#E5D7CA] text-xs sm:text-sm font-bold shadow-xs transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;
