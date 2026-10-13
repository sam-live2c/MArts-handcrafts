import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { Phone, Mail, ShieldCheck, Compass } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#FAF7F2] text-[#2B221B] border-t border-[#EADBCC] mt-auto">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-12 sm:py-14">
        {/* Main 2-Column Balanced Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 pb-10 border-b border-[#EADBCC]">
          {/* Column 1: MArts Atelier Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block hover:opacity-95 transition-opacity">
              <Logo variant="dark" size="md" showStoreTag={false} />
            </Link>
            <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed max-w-md">
              MArts celebrates generational artisan craftsmanship. Wheel-thrown terracotta pottery, vitrified artisan ceramics, and hand-chiseled stone sculptures from master heritage guilds.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8C3F1E] pt-1">
              <ShieldCheck size={16} className="text-[#C85A32] shrink-0" />
              <span>100% Master Artisan Handcrafted Pottery &amp; Statues • Founded by Anant Kumbhakar</span>
            </div>
          </div>

          {/* Column 2: Atelier Showroom & Contact Details */}
          <div className="space-y-4 md:pl-6 lg:pl-12">
            <div>
              <span className="text-[11px] font-bold text-[#C85A32] uppercase tracking-wider">Direct Connect</span>
              <h4 className="font-serif font-bold text-base sm:text-lg text-[#2B221B]">
                Atelier Location &amp; Contact
              </h4>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#5E473A]">
              <div className="flex items-start gap-2.5">
                <Compass size={16} className="text-[#C85A32] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Vill. Asanbani, P.O. Chandra, P.S. Siyaljori, Dist. Bokaro, Jharkhand, India
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-[#C85A32] shrink-0" />
                <a href="tel:+917061671820" className="hover:text-[#C85A32] transition-colors font-medium">
                  +91 70616 71820
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-[#C85A32] shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <a href="mailto:martsindia3@gmail.com" className="hover:text-[#C85A32] transition-colors font-medium">
                    martsindia3@gmail.com
                  </a>
                  <a href="mailto:akmarts1511@gmail.com" className="hover:text-[#C85A32] transition-colors text-xs text-[#735A4C]">
                    akmarts1511@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Dedicated Options Row */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#735A4C]">
          <p>© {new Date().getFullYear()} MArts &amp; Uart Handcrafted (Anant Kumbhakar). All rights reserved.</p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-semibold">
            <Link to="/help" className="hover:text-[#C85A32] transition-colors">
              Support
            </Link>
            <span className="text-[#D4C3B7]">•</span>
            <Link to="/privacy-policy" className="hover:text-[#C85A32] transition-colors">
              Privacy Policy
            </Link>
            <span className="text-[#D4C3B7]">•</span>
            <Link to="/terms-and-conditions" className="hover:text-[#C85A32] transition-colors">
              Terms and Conditions
            </Link>
            <span className="text-[#D4C3B7]">•</span>
            <Link to="/about" className="hover:text-[#C85A32] transition-colors">
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
