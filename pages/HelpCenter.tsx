import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';

// Official WhatsApp Brand Icon
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const rawWhatsAppPhone = "919876543210";
  const whatsappUrl = `https://wa.me/${rawWhatsAppPhone}?text=${encodeURIComponent("Hello MArts, I need support with my pottery and statues order.")}`;

  return (
    <div className="w-full bg-[#f8f9fa] min-h-screen flex flex-col text-gray-900">
      {/* Top Header */}
      <div 
        id="help-center-header"
        className="bg-white border-b border-gray-200/80 shadow-xs px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center gap-4 sticky top-0 z-[100]"
      >
        <button 
          type="button"
          onClick={() => handleGoBack(navigate, '/account')} 
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Help Center</h1>
          <p className="text-[11px] text-gray-500 font-medium">Customer Support & Assistance</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-md mx-auto w-full my-auto">
        <div className="w-full space-y-2.5 max-w-[340px] sm:max-w-[360px]">
          
          {/* Section Header (matching screenshot: 24x7 SUPPORT with WhatsApp icon) */}
          <div className="flex items-center gap-2 px-0.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[#25D366]">
              <WhatsAppIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0f766e]">
                24×7 SUPPORT
              </h2>
              <p className="text-[11px] text-gray-500 font-normal">
                Official WhatsApp Helpdesk
              </p>
            </div>
          </div>

          {/* WhatsApp Card Widget - Square shape, matching screenshot */}
          <a
            id="whatsapp-helpdesk-widget"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp with 24x7 Official Support at +91 8967301777"
            className="group w-full aspect-square rounded-2xl sm:rounded-3xl p-6 flex flex-col items-center justify-center text-center text-white shadow-md shadow-[#25D366]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#25D366]/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer relative overflow-hidden bg-gradient-to-br from-[#25D366] via-[#1EBE5D] to-[#128C7E]"
          >
            {/* Subtle background glow effect */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-black/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center gap-4">
              {/* Large WhatsApp Icon */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 text-white flex items-center justify-center drop-shadow-md group-hover:scale-105 transition-transform duration-300">
                <WhatsAppIcon className="w-24 h-24 sm:w-28 sm:h-28" />
              </div>

              {/* Chat on WhatsApp Button Label */}
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-sm">
                Chat on WhatsApp
              </h3>
            </div>
          </a>

        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
