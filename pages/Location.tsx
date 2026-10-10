import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, Mail, Clock, Compass, Navigation, Calendar } from 'lucide-react';
import { handleGoBack } from '../utils/navigation';
import Logo from '../components/Logo';

const Location: React.FC = () => {
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
            Studio &amp; Showroom Location
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-black tracking-tight leading-tight">
            Visit MArts Atelier &amp; Sculpture Garden
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-amber-100/80 max-w-2xl mx-auto leading-relaxed">
            Touch our unglazed pottery textures, explore carved monolithic statues, and meet our master potters at work.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-12 space-y-10">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Atelier Location 1 */}
          <div className="bg-white rounded-3xl border border-[#EADBCC] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center shrink-0">
                <MapPin size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#C85A32] uppercase tracking-wider">Flagship Atelier &amp; Kiln</span>
                <h2 className="text-xl font-serif font-bold text-[#2B221B]">MArts Heritage Pottery Studio</h2>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#5E473A] border-t border-[#F2EAE2] pt-4">
              <div className="flex items-start gap-3">
                <Compass size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Address</p>
                  <p className="leading-relaxed">
                    Plot 14, Heritage Artisan Guild Enclave, Pottery &amp; Sculpture Crafts Zone, Sector 4, Khurja / Bengal Craft Belt, PIN 203131, India
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Visiting &amp; Kiln Hours</p>
                  <p>Monday – Saturday: 10:00 AM – 7:00 PM</p>
                  <p className="text-xs text-[#8C6D58]">Sunday: 11:00 AM – 5:00 PM (By Prior Appointment)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Phone &amp; WhatsApp</p>
                  <p className="font-medium text-[#2B221B]">+91 98765 43210</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Direct Email</p>
                  <p className="text-[#C85A32] font-medium">atelier@marts.com</p>
                </div>
              </div>
            </div>

            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Navigation size={16} />
              <span>Get Driving Directions</span>
            </a>
          </div>

          {/* Gallery Showroom 2 */}
          <div className="bg-white rounded-3xl border border-[#EADBCC] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center shrink-0">
                <MapPin size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-[#C85A32] uppercase tracking-wider">City Gallery Showroom</span>
                <h2 className="text-xl font-serif font-bold text-[#2B221B]">MArts Contemporary Living Gallery</h2>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#5E473A] border-t border-[#F2EAE2] pt-4">
              <div className="flex items-start gap-3">
                <Compass size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Address</p>
                  <p className="leading-relaxed">
                    Gallery 82, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bangalore, Karnataka 560038, India
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Gallery Hours</p>
                  <p>Tuesday – Sunday: 11:00 AM – 8:00 PM</p>
                  <p className="text-xs text-[#8C6D58]">Closed on Mondays for Studio Inventory</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Curator Phone</p>
                  <p className="font-medium text-[#2B221B]">+91 98765 43211</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail size={18} className="text-[#8C6D58] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#2B221B]">Curator Email</p>
                  <p className="text-[#C85A32] font-medium">gallery@marts.com</p>
                </div>
              </div>
            </div>

            <a
              href="https://maps.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-[#FAF6F0] text-[#4E392D] border border-[#E5D7CA] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Navigation size={16} />
              <span>Get Driving Directions</span>
            </a>
          </div>
        </div>

        {/* Private Sculpture Commission Consultation */}
        <div className="bg-[#FAF3EA] border border-[#EADBCC] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-left">
            <h3 className="font-serif font-bold text-xl text-[#2B221B]">
              Custom Monumental Statues &amp; Architectural Pottery
            </h3>
            <p className="text-xs sm:text-sm text-[#735A4C] max-w-xl">
              Planning custom stone sculptures, altar deities, or large outdoor terracotta urns? Schedule a 1-on-1 consultation with our master sculptors.
            </p>
          </div>
          <Link
            to="/contact"
            className="px-6 py-3 rounded-xl bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0 flex items-center gap-2"
          >
            <Calendar size={16} />
            <span>Schedule Consultation</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Location;
