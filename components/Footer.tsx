import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { MapPin, Phone, Mail, ShieldCheck, ArrowRight, FileText, Info, Compass } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#FAF7F2] text-[#2B221B] border-t border-[#EADBCC] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 sm:py-14">
        {/* Main 3-Column Structured Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 pb-10 border-b border-[#EADBCC]">
          {/* Column 1: MArts Atelier Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block hover:opacity-95 transition-opacity">
              <Logo variant="dark" size="md" showStoreTag={false} />
            </Link>
            <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed max-w-sm">
              MArts celebrates generational artisan craftsmanship. Wheel-thrown terracotta pottery, vitrified studio ceramics, and hand-chiseled stone sculptures from master heritage guilds.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8C3F1E] pt-1">
              <ShieldCheck size={16} className="text-[#C85A32] shrink-0" />
              <span>100% Master Artisan Handcrafted Pottery &amp; Statues</span>
            </div>
          </div>

          {/* Column 2: Very Needed Options & Pages */}
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-bold text-[#C85A32] uppercase tracking-wider">Quick Navigation</span>
              <h4 className="font-serif font-bold text-base sm:text-lg text-[#2B221B]">
                Essential Pages &amp; Options
              </h4>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm">
              <li>
                <Link
                  to="/contact"
                  className="flex items-center gap-2.5 text-[#5E473A] hover:text-[#C85A32] transition-colors font-medium group"
                >
                  <Mail size={15} className="text-[#C85A32] shrink-0 transition-transform group-hover:scale-110" />
                  <span>Contact</span>
                  <span className="text-[11px] text-[#A89283] ml-auto group-hover:text-[#C85A32]">Inquiries &amp; Support</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/privacy-policy"
                  className="flex items-center gap-2.5 text-[#5E473A] hover:text-[#C85A32] transition-colors font-medium group"
                >
                  <FileText size={15} className="text-[#C85A32] shrink-0 transition-transform group-hover:scale-110" />
                  <span>Privacy Policy</span>
                  <span className="text-[11px] text-[#A89283] ml-auto group-hover:text-[#C85A32]">Data &amp; Trust</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/terms-and-conditions"
                  className="flex items-center gap-2.5 text-[#5E473A] hover:text-[#C85A32] transition-colors font-medium group"
                >
                  <FileText size={15} className="text-[#C85A32] shrink-0 transition-transform group-hover:scale-110" />
                  <span>Terms and Conditions</span>
                  <span className="text-[11px] text-[#A89283] ml-auto group-hover:text-[#C85A32]">Store Terms</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/about"
                  className="flex items-center gap-2.5 text-[#5E473A] hover:text-[#C85A32] transition-colors font-medium group"
                >
                  <Info size={15} className="text-[#C85A32] shrink-0 transition-transform group-hover:scale-110" />
                  <span>About</span>
                  <span className="text-[11px] text-[#A89283] ml-auto group-hover:text-[#C85A32]">Our Story &amp; Guild</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/location"
                  className="flex items-center gap-2.5 text-[#5E473A] hover:text-[#C85A32] transition-colors font-medium group"
                >
                  <MapPin size={15} className="text-[#C85A32] shrink-0 transition-transform group-hover:scale-110" />
                  <span>Location</span>
                  <span className="text-[11px] text-[#A89283] ml-auto group-hover:text-[#C85A32]">Atelier &amp; Showroom</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Atelier Showroom & Contact Details */}
          <div className="space-y-4">
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
                  Heritage Artisan Guild Enclave, Pottery &amp; Sculpture Crafts Zone, Sector 4, Khurja / Bengal Craft Belt, PIN 203131, India
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-[#C85A32] shrink-0" />
                <a href="tel:+919876543210" className="hover:text-[#C85A32] transition-colors font-medium">
                  +91 98765 43210
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-[#C85A32] shrink-0" />
                <a href="mailto:atelier@marts.com" className="hover:text-[#C85A32] transition-colors font-medium">
                  atelier@marts.com
                </a>
              </div>

              <div className="pt-2 flex items-center gap-4">
                <Link
                  to="/location"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C85A32] hover:text-[#9C4320] transition-colors"
                >
                  <span>Visit Studio</span>
                  <ArrowRight size={13} />
                </Link>
                <span className="text-[#D4C3B7]">•</span>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C85A32] hover:text-[#9C4320] transition-colors"
                >
                  <span>Get in Touch</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Dedicated Options Row */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#735A4C]">
          <p>© {new Date().getFullYear()} MArts Handcrafted Studio. All rights reserved.</p>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-semibold">
            <Link to="/contact" className="hover:text-[#C85A32] transition-colors">
              Contact
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
            <span className="text-[#D4C3B7]">•</span>
            <Link to="/location" className="hover:text-[#C85A32] transition-colors">
              Location
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
