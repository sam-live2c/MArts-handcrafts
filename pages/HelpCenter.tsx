import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { 
  ArrowLeft, Search, Mail, ChevronDown, 
  HelpCircle, Utensils, Truck, RotateCcw, Palette, X
} from 'lucide-react';

interface FAQItem {
  id: string;
  category: 'orders' | 'care' | 'returns' | 'custom';
  question: string;
  answer: string;
  points?: string[];
}

const FAQ_DATA: FAQItem[] = [
  // Orders & Shipping
  {
    id: 'track-order',
    category: 'orders',
    question: 'How do I place an order and track my shipment?',
    answer: 'Browse our curated collection of wheel-thrown pottery, terracotta cookware, and hand-carved stone statues. Add your selected items to your cart, proceed to checkout, and enter your delivery address. Upon dispatch, you will receive real-time email notifications with courier tracking links. You can also view live delivery progress inside your Account dashboard under "My Orders".',
    points: [
      'Orders are typically inspected and dispatched within 24 to 48 hours.',
      'Tracking details update within 4 to 6 hours after courier pickup.'
    ]
  },
  {
    id: 'shipping-timelines',
    category: 'orders',
    question: 'What are the delivery timelines and coverage across India?',
    answer: 'We deliver to over 19,000+ pin codes across India through specialized fragile logistics partners.',
    points: [
      'Metro cities: 3 to 5 business days after dispatch.',
      'Rest of India: 4 to 7 business days.',
      'Heavy monolithic stone statues (>15 kg): 5 to 8 business days via specialized surface transport with ground-floor doorstep delivery.'
    ]
  },
  {
    id: 'packaging-safety',
    category: 'orders',
    question: 'How do you pack fragile ceramics and heavy stone statues?',
    answer: 'We pack fragile earthenware and sculptures with multi-layer protective packaging: custom-molded high-density cushioning, reinforced corrugated boxes, and heavy-duty timber crating with steel strapping for monolithic stone statues to guarantee safe transit.'
  },
  {
    id: 'payment-methods',
    category: 'orders',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major secure payment methods: UPI (Google Pay, PhonePe, Paytm, BHIM), Credit & Debit Cards (Visa, MasterCard, RuPay, American Express), Net Banking across 50+ banks, and Cash on Delivery (COD) on eligible pottery items up to ₹5,000.'
  },
  {
    id: 'cancel-modify',
    category: 'orders',
    question: 'Can I cancel or modify my delivery address after placing an order?',
    answer: 'Yes. You can modify your shipping address or cancel your order within 6 hours of placement before our warehouse initiates custom protective crating. Simply send an email to martsindia3@gmail.com or WhatsApp +91 70616 71820 with your Order ID.'
  },

  // Food Safety & Care
  {
    id: 'food-safe',
    category: 'care',
    question: 'Are MArts terracotta and ceramic vessels 100% food-safe?',
    answer: 'Yes. Every culinary vessel, water pot (matka), tea kulhad, and cooking pan is 100% Non-Toxic & Food-Safe. We formulate exclusively lead-free and cadmium-free natural glazes fired at high temperatures (over 1,200°C) to ensure full vitrification.'
  },
  {
    id: 'terracotta-curing',
    category: 'care',
    question: 'How should I cure and maintain terracotta cookware?',
    answer: 'Proper care preserves the longevity and natural properties of your clay cookware:',
    points: [
      'Initial Curing: Submerge your clay pot in fresh water for 6–8 hours. Drain and let it dry naturally in sunlight before first use.',
      'Cooking: Always start on low heat and gradually increase to medium heat. Avoid sudden thermal shocks.',
      'Cleaning: Wash with warm water and natural scrubbing fibers or baking soda. Avoid harsh chemical detergents on unglazed clay.'
    ]
  },
  {
    id: 'dishwasher-microwave',
    category: 'care',
    question: 'Are glazed ceramics microwave and dishwasher safe?',
    answer: 'Yes. Our high-fired glazed ceramic mugs, bowls, and dinnerware are fully microwave-safe and dishwasher-safe on gentle wash cycles. Unglazed natural terracotta pots should only be hand-washed and used for stovetop or oven cooking.'
  },

  // Returns & Replacements
  {
    id: 'replacement-policy',
    category: 'returns',
    question: 'What is your 7-day replacement guarantee?',
    answer: 'We stand behind every piece that leaves our studios. If your handcrafted item arrives damaged, chipped, or flawed, notify us within 7 days of delivery. We will arrange a 100% replacement or refund without hassle.'
  },
  {
    id: 'damaged-transit',
    category: 'returns',
    question: 'What should I do if my parcel arrives damaged?',
    answer: 'Take 2 clear photos of the damaged packaging and the broken item, then email us at martsindia3@gmail.com or WhatsApp +91 70616 71820 with your Order ID. Our support team will verify your claim within 2 hours and dispatch a fresh replacement immediately.'
  },
  {
    id: 'refund-timeline',
    category: 'returns',
    question: 'How long does a refund take to reflect in my bank account?',
    answer: 'Once approved, UPI and Net Banking refunds are processed within 24 to 48 hours back to the original payment source. Card refunds reflect in 3 to 5 business days depending on your bank settlement cycles.'
  },

  // Custom Commissions
  {
    id: 'custom-orders',
    category: 'custom',
    question: 'Can I commission bespoke stone sculptures or bulk pottery?',
    answer: 'Yes. We accept bespoke commission requests for architectural sculptures, garden planters, temple murtis, and customized corporate pottery sets. Email martsindia3@gmail.com with your sketches, dimensions, and preferred stone or clay requirements for a personalized quote.'
  },
  {
    id: 'order-receipt',
    category: 'custom',
    question: 'Where can I download order receipts?',
    answer: 'Every order includes an itemized order receipt. You can download the receipt directly from your "My Orders" page in your Account, or email us at martsindia3@gmail.com to receive a digital copy.'
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All FAQs', icon: HelpCircle },
  { id: 'orders', label: 'Orders & Shipping', icon: Truck },
  { id: 'care', label: 'Care & Food Safety', icon: Utensils },
  { id: 'returns', label: 'Returns & Refunds', icon: RotateCcw },
  { id: 'custom', label: 'Custom & Bulk', icon: Palette }
] as const;

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'track-order': true,
  });

  const supportEmail = 'martsindia3@gmail.com';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredFAQs = useMemo(() => {
    let list = FAQ_DATA;

    if (activeCategory !== 'all') {
      list = list.filter(item => item.category === activeCategory);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(item => 
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        (item.points && item.points.some(p => p.toLowerCase().includes(query)))
      );
    }

    return list;
  }, [activeCategory, searchQuery]);

  return (
    <div className="w-full bg-[#FAF8F5] min-h-screen text-[#2B221B] font-sans selection:bg-[#F2E4D8] selection:text-[#2B221B] flex flex-col">
      {/* Header Bar with unified styling and back button */}
      <header className="sticky top-0 z-[100] bg-white border-b border-gray-100 shadow-xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleGoBack(navigate, '/account')}
            className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors text-gray-800 cursor-pointer shrink-0"
            aria-label="Go back to Profile"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 leading-tight">Help Center</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12 flex flex-col gap-8">
        
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto w-full">
          <h1 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-[#2B221B]">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
            Find quick answers about orders, shipping, food safety standards, and returns. If you need further assistance, reach out directly via email.
          </p>

          {/* Search Bar */}
          <div className="relative pt-3 max-w-2xl mx-auto w-full">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-[#A89283] w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search questions or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#EADBCC] focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/10 rounded-xl pl-11 pr-10 py-3 text-xs sm:text-sm text-[#2B221B] placeholder:text-[#A89283] outline-none shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-[#A89283] hover:text-[#2B221B] p-1 rounded-full cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Category Filter Pills - Extended edge-to-edge without side edge strips, freely scrollable */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar overscroll-x-contain select-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#C85A32] text-white shadow-xs'
                    : 'bg-white border border-[#EADBCC] text-[#5E473A] hover:bg-[#FAF0E6] hover:text-[#2B221B]'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Simple FAQ Accordion Section - 2 columns on desktop to cover the area without adding new UI */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start w-full" aria-label="FAQ Accordion">
          {filteredFAQs.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-[#EADBCC] p-8 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-[#C85A32] mx-auto opacity-70" />
              <h3 className="text-base font-bold text-[#2B221B]">No matching questions found</h3>
              <p className="text-xs text-[#735A4C] max-w-md mx-auto">
                We couldn&apos;t find an answer matching &ldquo;{searchQuery}&rdquo;. Please contact us directly via email below and we will gladly help you.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FAF0E6] text-[#C85A32] border border-[#EADBCC] rounded-xl text-xs font-semibold hover:bg-[#F2E4D8] cursor-pointer"
              >
                Show All FAQs
              </button>
            </div>
          ) : (
            filteredFAQs.map((faq) => {
              const isOpen = !!openItems[faq.id];
              return (
                <div
                  key={faq.id}
                  className="bg-white border border-[#EADBCC] rounded-2xl shadow-2xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(faq.id)}
                    className="w-full text-left px-5 py-4 sm:px-6 sm:py-4.5 flex items-center justify-between gap-4 cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="text-xs sm:text-sm font-bold text-[#2B221B] leading-snug">
                      {faq.question}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#EADBCC] flex items-center justify-center text-[#735A4C] shrink-0 ${
                        isOpen ? 'rotate-180 text-[#C85A32]' : ''
                      }`}
                    >
                      <ChevronDown size={16} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-5 pt-1 text-xs sm:text-sm text-[#5E473A] leading-relaxed border-t border-[#F2EAE1] space-y-2.5">
                      <p>{faq.answer}</p>
                      {faq.points && faq.points.length > 0 && (
                        <ul className="space-y-1.5 pl-4 list-disc text-xs text-[#6B5344]">
                          {faq.points.map((pt, pIdx) => (
                            <li key={pIdx} className="leading-relaxed">
                              {pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Direct Email Contact Section */}
        <section className="mt-4 pt-2">
          <div className="bg-white border border-[#EADBCC] rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-lg sm:text-xl font-serif font-black text-[#2B221B]">
                Still have questions? Contact us directly
              </h2>
              <p className="text-xs sm:text-sm text-[#735A4C] max-w-md">
                Our support desk is available to assist you with order inquiries, replacements, and custom requirements.
              </p>
              <div className="pt-1 text-xs text-[#8C7464] flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1">
                <span>Email: <strong className="text-[#2B221B]">{supportEmail}</strong> / <strong className="text-[#2B221B]">akmarts1511@gmail.com</strong></span>
                <span>•</span>
                <span>Phone / WhatsApp: <strong className="text-[#2B221B]">+91 70616 71820</strong></span>
                <span>•</span>
                <span>Atelier: <strong className="text-[#2B221B]">Bokaro, Jharkhand</strong></span>
              </div>
            </div>

            {/* Direct Email & Call Actions */}
            <div className="w-full md:w-auto shrink-0 flex flex-wrap items-center justify-center md:justify-end gap-3">
              <a
                href="https://wa.me/917061671820"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <span>WhatsApp</span>
              </a>
              <a
                href={`mailto:${supportEmail}?subject=MArts%20Support%20Inquiry`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs cursor-pointer"
              >
                <Mail size={16} />
                <span>Email Support</span>
              </a>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default HelpCenter;
