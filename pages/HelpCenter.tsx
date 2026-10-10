import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoBack } from '../utils/navigation';
import { 
  ArrowLeft, Search, Mail, ExternalLink, CheckCircle2, 
  ChevronRight, Clock, Sparkles, ShieldCheck, 
  ShoppingBag, Truck, RotateCcw, FileText, HelpCircle, 
  Send, X, ThumbsUp, ThumbsDown, User, MessageSquare
} from 'lucide-react';

// Official WhatsApp Brand SVG Component
const WhatsAppBrandIcon: React.FC<{ className?: string; size?: number }> = ({ 
  className = "w-5 h-5", 
  size 
}) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    style={size ? { width: size, height: size } : undefined}
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface Article {
  id: string;
  collectionId: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string[];
  author: string;
  updatedAt: string;
}

interface Collection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  articlesCount: number;
  authors: string[];
}

const COLLECTIONS: Collection[] = [
  {
    id: 'orders',
    title: 'Orders & Shopping',
    description: 'Learn how to place orders, track shipments, and manage payment options.',
    icon: ShoppingBag,
    iconBg: 'bg-amber-50 border border-amber-200/60',
    iconColor: 'text-[#C85A32]',
    articlesCount: 4,
    authors: ['MArts Concierge', 'Guild Support']
  },
  {
    id: 'craft',
    title: 'Craftsmanship & Food Safety',
    description: 'Information regarding 100% non-toxic natural glazes, clay firing, and stone care.',
    icon: Sparkles,
    iconBg: 'bg-orange-50 border border-orange-200/60',
    iconColor: 'text-[#B44C28]',
    articlesCount: 4,
    authors: ['Master Potter', 'Quality Guild']
  },
  {
    id: 'shipping',
    title: 'Packaging & Delivery',
    description: 'Details on timber crating, anti-shock foam layers, timelines, and tracking.',
    icon: Truck,
    iconBg: 'bg-blue-50 border border-blue-200/60',
    iconColor: 'text-blue-600',
    articlesCount: 4,
    authors: ['Logistics Desk', 'Transit Lead']
  },
  {
    id: 'returns',
    title: 'Returns & 100% Replacements',
    description: 'Our doorstep 7-day transit replacement policy and quick refund process.',
    icon: RotateCcw,
    iconBg: 'bg-emerald-50 border border-emerald-200/60',
    iconColor: 'text-emerald-600',
    articlesCount: 3,
    authors: ['Customer Care', 'Assurance Guild']
  },
  {
    id: 'custom',
    title: 'Custom & Bulk Commissions',
    description: 'Bespoke hand-carved stone statues, architectural pottery, and corporate gifting.',
    icon: FileText,
    iconBg: 'bg-purple-50 border border-purple-200/60',
    iconColor: 'text-purple-600',
    articlesCount: 3,
    authors: ['Artisan Liaison', 'Custom Studio']
  },
  {
    id: 'account',
    title: 'Account & Invoicing',
    description: 'Managing addresses, downloading GST tax invoices, and privacy protection.',
    icon: ShieldCheck,
    iconBg: 'bg-stone-100 border border-stone-200',
    iconColor: 'text-stone-700',
    articlesCount: 3,
    authors: ['Account Support']
  }
];

const ARTICLES: Article[] = [
  // Orders & Shopping
  {
    id: 'track-order',
    collectionId: 'orders',
    title: 'How do I place an order and track my shipment?',
    summary: 'Step-by-step guidance on placing artisan orders and tracking live transit updates.',
    author: 'MArts Concierge',
    updatedAt: 'Updated 2 days ago',
    content: [
      'Placing an order is seamless on MArts Handcrafted. Browse our curated collection of wheel-thrown pottery, natural terracotta cookware, and monolithic stone sculptures.',
      'Once added to your bag, proceed to Checkout, enter your verified shipping address, and choose your preferred payment method (UPI, Cards, Net Banking, or Cash on Delivery where eligible).',
      'Upon order dispatch, you will receive real-time SMS and email tracking links. You can also view live delivery progress directly inside your Account dashboard under "My Orders".'
    ],
    tips: [
      'Orders are typically dispatched within 24 to 48 hours following artisan quality inspection.',
      'For fragile items, courier tracking updates appear within 4-6 hours of courier hub pickup.'
    ]
  },
  {
    id: 'payment-methods',
    collectionId: 'orders',
    title: 'What payment methods are supported on MArts?',
    summary: 'We support all major Indian and international payment gateways securely.',
    author: 'MArts Concierge',
    updatedAt: 'Updated last week',
    content: [
      'We support all major payment systems protected with 256-bit bank-grade SSL encryption:',
      '• UPI (Google Pay, PhonePe, Paytm, BHIM)',
      '• Credit & Debit Cards (Visa, MasterCard, RuPay, American Express)',
      '• Net Banking across all 50+ major Indian banks',
      '• Cash on Delivery (COD) on eligible pottery items up to ₹5,000.'
    ]
  },
  {
    id: 'modify-cancel',
    collectionId: 'orders',
    title: 'Can I cancel or modify my order after placing it?',
    summary: 'How to make changes or cancel before artisan dispatch.',
    author: 'Guild Support',
    updatedAt: 'Updated 3 days ago',
    content: [
      'You can modify your delivery address or cancel your order within 6 hours of placement before our logistics team initiates custom packing.',
      'To request an immediate edit or cancellation, message our WhatsApp support desk at +91 98765 43210 or email support@marts.com with your Order ID.'
    ]
  },
  {
    id: 'delivery-pincodes',
    collectionId: 'orders',
    title: 'Do you deliver across all pin codes in India?',
    summary: 'Pan-India coverage through our specialized fragile courier network.',
    author: 'Logistics Desk',
    updatedAt: 'Updated this week',
    content: [
      'Yes, we ship to over 19,000+ pin codes across India through specialized fragile logistics partners (Delhivery, BlueDart, and specialized stone freight carriers).',
      'Remote hilly terrains and North-Eastern regions may require 2-3 additional transit days.'
    ]
  },

  // Craftsmanship & Food Safety
  {
    id: 'food-safety',
    collectionId: 'craft',
    title: 'Are MArts terracotta and ceramic vessels 100% food-safe?',
    summary: 'Our strict adherence to lead-free, non-toxic, and cadmium-free standards.',
    author: 'Quality Guild',
    updatedAt: 'Updated 1 day ago',
    content: [
      'Every dining vessel, water pot (matka), tea kulhad, and cooking pan is 100% Non-Toxic & Food-Safe.',
      'We exclusively formulate lead-free and cadmium-free natural feldspar glazes fired at high temperatures (over 1,200°C) to ensure full vitrification.',
      'Our porous terracotta water vessels undergo natural clay filtration tests without any chemical sealing agents, keeping drinking water naturally alkaline and mineral-enriched.'
    ],
    tips: [
      'Before first culinary use with unglazed cookware, soak in water for 6-8 hours and let air dry completely.',
      'Wash gently with warm water and natural scrubbing fibers. Avoid harsh chemical dish soaps on unglazed clay.'
    ]
  },
  {
    id: 'artisan-process',
    collectionId: 'craft',
    title: 'How are MArts pottery and stone statues crafted?',
    summary: 'A peek into wheel-thrown pottery kilns and monolithic stone chisel work.',
    author: 'Master Potter',
    updatedAt: 'Updated 4 days ago',
    content: [
      'Our items are made by generational artisan communities across Bengal, Rajasthan, and Khurja.',
      'Terracotta items are thrown manually on potter wheels and wood-fired in traditional wood kilns to achieve distinctive natural earthen hues.',
      'Our stone statues are chiseled from single blocks of monolithic sandstone and marble using hand tools, ensuring each piece is a genuine heirloom with unique tactile contours.'
    ]
  },
  {
    id: 'care-maintenance',
    collectionId: 'craft',
    title: 'How should I cure and maintain my terracotta cookware?',
    summary: 'Preserve the longevity of your handcrafted clay and earthenware pots.',
    author: 'Master Potter',
    updatedAt: 'Updated 2 weeks ago',
    content: [
      '1. Initial Curing: Submerge your clay pot in fresh water for 6–8 hours. Drain and let it dry naturally in sunlight.',
      '2. Cooking: Always start on low heat and gradually increase to medium heat. Never expose dry cold terracotta directly to high flames.',
      '3. Cleaning: Use hot water and a pinch of baking soda or coconut coir scrub. Do not put unglazed clay into modern automatic dishwashers.'
    ]
  },
  {
    id: 'dishwasher-microwave',
    collectionId: 'craft',
    title: 'Can glazed ceramics go into the microwave and dishwasher?',
    summary: 'Thermal guidelines for glazed stoneware and ceramic tableware.',
    author: 'Quality Guild',
    updatedAt: 'Updated 3 days ago',
    content: [
      'Yes! Our high-fired glazed ceramic mugs, bowls, and plates are fully microwave-safe and dishwasher-safe on gentle wash cycles.',
      'Unglazed natural terracotta cookware should only be hand-washed and is best suited for stovetop cooking.'
    ]
  },

  // Packaging & Delivery
  {
    id: 'transit-packaging',
    collectionId: 'shipping',
    title: 'How do you pack fragile ceramics and heavy stone statues?',
    summary: 'Anti-breakage multi-layer timber crate packaging standard.',
    author: 'Transit Lead',
    updatedAt: 'Updated 3 days ago',
    content: [
      'We pack fragile pottery with museum-grade care. Each vessel receives 3 distinct protective layers:',
      '1. Custom-molded high-density bubble cushioning preventing surface abrasion.',
      '2. Heavy corrugated outer wall with air pillows to absorb shocks.',
      '3. For heavy monolithic stone statues and large terracotta planters, we encase the package in reinforced timber crating with steel strapping to withstand rigorous multi-state transit.'
    ],
    tips: [
      'Keep the outer carton and unboxing video handy in the rare event of transit damage for immediate 100% replacement.'
    ]
  },
  {
    id: 'timelines',
    collectionId: 'shipping',
    title: 'What are the delivery timelines and white-glove transport details?',
    summary: 'Estimated shipping transit times across metropolitan and regional zones.',
    author: 'Logistics Desk',
    updatedAt: 'Updated 5 days ago',
    content: [
      '• Metro Cities: 3 to 5 business days after artisan dispatch.',
      '• Rest of India: 4 to 7 business days.',
      '• Heavy Monumental Statues (>15 kg): 5 to 8 business days via specialized surface transport with ground-floor doorstep unloading.'
    ]
  },
  {
    id: 'box-damage',
    collectionId: 'shipping',
    title: 'What should I do if the parcel arrives damaged?',
    summary: 'Immediate doorstep protocol for damaged consignments.',
    author: 'Transit Lead',
    updatedAt: 'Updated last week',
    content: [
      'If the outer packaging shows visible impact or crushing upon arrival, please take 2 quick photographs of the box before opening.',
      'If the artisan item inside is broken or chipped, send the pictures to our WhatsApp concierge (+91 98765 43210). We will initiate a 100% replacement without requiring you to return the broken ceramic.'
    ]
  },
  {
    id: 'international',
    collectionId: 'shipping',
    title: 'Do you offer international shipping?',
    summary: 'Worldwide export guidelines for artisanal handicrafts.',
    author: 'Logistics Desk',
    updatedAt: 'Updated 2 weeks ago',
    content: [
      'Currently, our direct website checkout serves all pin codes across India. For international orders (USA, UK, Europe, UAE, Australia), please contact our custom concierge on WhatsApp for bespoke international freight quotes and customs paperwork.'
    ]
  },

  // Returns & 100% Replacements
  {
    id: 'replacement-policy',
    collectionId: 'returns',
    title: 'What is your 7-day replacement and refund guarantee?',
    summary: 'Hassle-free coverage for transit breakage or defects.',
    author: 'Customer Care',
    updatedAt: 'Updated 2 days ago',
    content: [
      'We stand behind every piece that leaves our kilns and chisel studios. We provide a 7-day doorstep replacement or refund guarantee.',
      'If your handcrafted item arrives damaged, flawed, or differs from the specifications, notify us within 7 days of delivery for an instant replacement or 100% refund.'
    ]
  },
  {
    id: 'report-breakage',
    collectionId: 'returns',
    title: 'How do I report transit breakage or receive an instant replacement?',
    summary: 'Zero hassle process via WhatsApp or email with your Order ID.',
    author: 'Assurance Guild',
    updatedAt: 'Updated 4 days ago',
    content: [
      '1. Take 2 clear photos of the damaged item showing the fracture.',
      '2. WhatsApp our care team at +91 98765 43210 or email support@marts.com with your Order ID.',
      '3. Our team verifies the claim within 2 hours and dispatches a fresh piece from our inventory immediately.'
    ]
  },
  {
    id: 'refund-timeline',
    collectionId: 'returns',
    title: 'How long does a refund take to reflect in my bank account?',
    summary: 'Processing speeds for UPI, card, and net banking reversals.',
    author: 'Customer Care',
    updatedAt: 'Updated last week',
    content: [
      'Once a refund is approved:',
      '• UPI & Net Banking: Processed within 24 to 48 hours directly to the original payment source.',
      '• Credit / Debit Cards: 3 to 5 business days depending on your bank settlement cycles.'
    ]
  },

  // Custom & Bulk Commissions
  {
    id: 'custom-sculptures',
    collectionId: 'custom',
    title: 'Can I commission bespoke temple sculptures or custom pottery designs?',
    summary: 'Direct guild collaboration for bespoke architectural carvings.',
    author: 'Artisan Liaison',
    updatedAt: 'Updated 4 days ago',
    content: [
      'Yes! Our guild accepts bespoke commission requests for architectural sculptures, garden planters, temple murtis, and custom pottery sets.',
      'Share your reference sketches, dimensions, and preferred stone (sandstone, black granite, or white marble) with our liaison via WhatsApp.'
    ]
  },
  {
    id: 'corporate-gifting',
    collectionId: 'custom',
    title: 'Do you offer corporate artisan gifting and wholesale pricing?',
    summary: 'Handcrafted artisan hampers and corporate partner programs.',
    author: 'Custom Studio',
    updatedAt: 'Updated last week',
    content: [
      'We provide curated festive gifting sets (ceramic mugs, terracotta aroma diffusers, handcrafted diyas) with custom embossed guild packaging for corporate events and weddings.',
      'Volume tier discounts apply for quantities above 25 units.'
    ]
  },
  {
    id: 'commission-duration',
    collectionId: 'custom',
    title: 'How long does a custom monolithic stone carving take?',
    summary: 'Artisan production cycles for bespoke stone sculptures.',
    author: 'Artisan Liaison',
    updatedAt: 'Updated 2 weeks ago',
    content: [
      'Bespoke stone carving requires 2 to 4 weeks depending on the complexity, scale, and stone block sourcing. You receive periodic photo updates from the master sculptor throughout the chisel process.'
    ]
  },

  // Account & Invoicing
  {
    id: 'gst-invoices',
    collectionId: 'account',
    title: 'Where can I download GST tax invoices for my purchases?',
    summary: 'Tax invoices and GST credit documentation.',
    author: 'Account Support',
    updatedAt: 'Updated 1 week ago',
    content: [
      'Every order includes a GST-compliant tax invoice. You can download the PDF invoice directly from your "My Orders" tab after shipment dispatch, or contact our support desk to receive a copy via email.'
    ]
  },
  {
    id: 'update-address',
    collectionId: 'account',
    title: 'How do I update my delivery address or phone number?',
    summary: 'Managing profile addresses and default shipping destinations.',
    author: 'Account Support',
    updatedAt: 'Updated last week',
    content: [
      'Go to your Account icon in the top header, select "Manage Addresses", and add or edit your shipping details. You can save multiple addresses and set your default destination.'
    ]
  },
  {
    id: 'data-privacy',
    collectionId: 'account',
    title: 'How is my personal data and payment security protected?',
    summary: 'Compliance with Indian data protection norms and encryption standards.',
    author: 'Account Support',
    updatedAt: 'Updated 2 weeks ago',
    content: [
      'We strictly maintain user confidentiality. We never store credit card numbers or banking passwords on our servers. All transaction processing is tokenized through RBI-authorized payment gateways.'
    ]
  }
];

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation states: 'home' | 'collection' | 'article'
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Article feedback state
  const [articleFeedback, setArticleFeedback] = useState<Record<string, 'helpful' | 'not-helpful' | null>>({});

  // WhatsApp & Email Desk Info
  const rawWhatsAppPhone = "919876543210";
  const whatsappDisplay = "+91 98765 43210";
  const whatsappUrl = `https://wa.me/${rawWhatsAppPhone}?text=${encodeURIComponent("Hello MArts Support, I need assistance with my handcrafted order/inquiry.")}`;
  const supportEmail = "support@marts.com";

  // Quick Message Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    name: '',
    email: '',
    subject: 'Order Tracking & Delivery',
    message: ''
  });
  const [emailSent, setEmailSent] = useState(false);

  // Scroll to top on load or view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeCollectionId, activeArticleId]);

  // Support deep linking or search query param if present
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // Filtered articles based on search query
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return ARTICLES.filter(art => 
      art.title.toLowerCase().includes(q) || 
      art.summary.toLowerCase().includes(q) ||
      art.content.some(c => c.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const activeCollection = COLLECTIONS.find(c => c.id === activeCollectionId);
  const activeArticle = ARTICLES.find(a => a.id === activeArticleId);
  const collectionArticles = useMemo(() => {
    if (!activeCollectionId) return [];
    return ARTICLES.filter(a => a.collectionId === activeCollectionId);
  }, [activeCollectionId]);

  const handleOpenArticle = (artId: string) => {
    setActiveArticleId(artId);
  };

  const handleOpenCollection = (colId: string) => {
    setActiveCollectionId(colId);
    setActiveArticleId(null);
  };

  const handleBackToSupportHome = () => {
    setActiveCollectionId(null);
    setActiveArticleId(null);
    setSearchQuery('');
  };

  const handleBackToCollection = () => {
    setActiveArticleId(null);
  };

  const handleFeedback = (artId: string, type: 'helpful' | 'not-helpful') => {
    setArticleFeedback(prev => ({ ...prev, [artId]: type }));
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email || !emailForm.message) return;
    setEmailSent(true);
  };

  return (
    <div className="w-full bg-[#FAFAFA] min-h-screen text-gray-800 font-sans selection:bg-[#F2E4D8] selection:text-[#2B221B] flex flex-col">
      {/* 
        App's standard header bar (per instruction: "Ignore the header of this UI example and replicate other components style") 
      */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (activeArticleId) {
                handleBackToCollection();
              } else if (activeCollectionId || searchQuery) {
                handleBackToSupportHome();
              } else {
                handleGoBack(navigate, '/');
              }
            }}
            className="inline-flex items-center gap-2.5 text-gray-800 hover:text-gray-900 rounded-lg transition-colors cursor-pointer group"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-gray-700 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
              Support
            </span>
          </button>

          {/* Quick status indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline font-medium text-gray-700">Artisan Support Active</span>
          </div>
        </div>
      </header>

      {/* Main Ruul-style Knowledge Base Experience */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-10">

        {/* -------------------------------------------------------------
            1. HERO & SEARCH BAR (Replicating Ruul's clean advice hero)
           ------------------------------------------------------------- */}
        <section className="text-center max-w-2xl mx-auto w-full space-y-4">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Advice and answers from the MArts Team
          </h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
            Search our knowledge base for instant answers or explore collections below.
          </p>

          {/* Search Box Input with Instant Clear */}
          <div className="relative pt-2">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search for answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 hover:border-gray-400 focus:border-[#C85A32] focus:ring-4 focus:ring-[#C85A32]/10 rounded-xl pl-11 pr-10 py-3.5 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 transition-all shadow-xs outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Quick suggested tags */}
            {!searchQuery && !activeArticleId && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 text-xs text-gray-500">
                <span className="text-gray-400">Popular:</span>
                <button 
                  onClick={() => setSearchQuery('food safe')} 
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
                >
                  Food Safety
                </button>
                <button 
                  onClick={() => setSearchQuery('crating')} 
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
                >
                  Packaging & Crating
                </button>
                <button 
                  onClick={() => setSearchQuery('replacement')} 
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
                >
                  7-Day Replacements
                </button>
                <button 
                  onClick={() => setSearchQuery('whatsapp')} 
                  className="px-2 py-0.5 rounded-md bg-white border border-gray-200 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
                >
                  WhatsApp Chat
                </button>
              </div>
            )}
          </div>
        </section>


        {/* -------------------------------------------------------------
            2. CONDITIONAL VIEW: SEARCH RESULTS
           ------------------------------------------------------------- */}
        {searchQuery.trim().length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for &ldquo;{searchQuery}&rdquo;
              </h2>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#C85A32] font-semibold hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
                <HelpCircle className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="text-base font-bold text-gray-900">No articles matched your search</h3>
                <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                  We couldn&apos;t find an article matching &ldquo;{searchQuery}&rdquo;. You can connect with our live artisan concierge directly via WhatsApp or email below.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1EBE5D] transition-colors"
                  >
                    <WhatsAppBrandIcon size={16} />
                    <span>Ask on WhatsApp</span>
                  </a>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <Mail size={16} />
                    <span>Write to Us</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {searchResults.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => {
                      setActiveArticleId(article.id);
                      setSearchQuery('');
                    }}
                    className="bg-white rounded-xl border border-gray-200/90 hover:border-gray-300 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span className="uppercase tracking-wider font-semibold text-[#C85A32]">
                          {COLLECTIONS.find(c => c.id === article.collectionId)?.title || 'Knowledge Base'}
                        </span>
                        <span>{article.updatedAt}</span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <User size={13} className="text-gray-400" />
                        {article.author}
                      </span>
                      <span className="font-semibold text-[#C85A32] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                        Read answer <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}


        {/* -------------------------------------------------------------
            3. CONDITIONAL VIEW: ARTICLE READER (Ruul's article view)
           ------------------------------------------------------------- */}
        {!searchQuery && activeArticle && (
          <article className="space-y-6 max-w-3xl mx-auto w-full">
            {/* Breadcrumbs Navigation */}
            <nav className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <button 
                onClick={handleBackToSupportHome}
                className="hover:text-gray-900 cursor-pointer font-medium"
              >
                All Collections
              </button>
              <ChevronRight size={12} className="text-gray-400" />
              <button 
                onClick={() => {
                  setActiveCollectionId(activeArticle.collectionId);
                  setActiveArticleId(null);
                }}
                className="hover:text-gray-900 cursor-pointer font-medium"
              >
                {COLLECTIONS.find(c => c.id === activeArticle.collectionId)?.title}
              </button>
              <ChevronRight size={12} className="text-gray-400" />
              <span className="text-gray-800 font-semibold truncate max-w-xs">
                {activeArticle.title}
              </span>
            </nav>

            {/* Article Card */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-9 shadow-xs space-y-6">
              {/* Title & Author Meta */}
              <div className="border-b border-gray-100 pb-5 space-y-3">
                <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
                  {activeArticle.title}
                </h1>
                
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="w-8 h-8 rounded-full bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center font-bold text-xs border border-[#EADBCC]">
                    {activeArticle.author.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{activeArticle.author}</p>
                    <p className="text-gray-400">{activeArticle.updatedAt} • 2 min read</p>
                  </div>
                </div>
              </div>

              {/* Main Content paragraphs */}
              <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed font-normal">
                {activeArticle.content.map((paragraph, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}

                {/* Pro Tips / Highlights Box */}
                {activeArticle.tips && activeArticle.tips.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-[#FAF0E6]/60 border border-[#EADBCC] space-y-2">
                    <p className="font-bold text-xs uppercase tracking-wider text-[#C85A32] flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Artisan Note &amp; Helpful Tips
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-700 list-disc list-inside">
                      {activeArticle.tips.map((tip, tIdx) => (
                        <li key={tIdx} className="leading-relaxed">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Ruul-style Helpfulness Reaction Widget */}
              <div className="pt-6 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs sm:text-sm font-bold text-gray-900">
                      Did this answer your question?
                    </p>
                    <p className="text-xs text-gray-500">
                      Your feedback helps our artisan guild improve this documentation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {articleFeedback[activeArticle.id] ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                        <CheckCircle2 size={14} />
                        Thank you for your feedback!
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFeedback(activeArticle.id, 'helpful')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer shadow-2xs"
                        >
                          <ThumbsUp size={13} className="text-emerald-600" />
                          <span>Yes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(activeArticle.id, 'not-helpful')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer shadow-2xs"
                        >
                          <ThumbsDown size={13} className="text-red-500" />
                          <span>No</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Back to collection link */}
              <div className="pt-2 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCollectionId(activeArticle.collectionId);
                    setActiveArticleId(null);
                  }}
                  className="font-bold text-[#C85A32] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  ← Back to {COLLECTIONS.find(c => c.id === activeArticle.collectionId)?.title}
                </button>
                <button
                  type="button"
                  onClick={handleBackToSupportHome}
                  className="text-gray-500 hover:text-gray-900 cursor-pointer font-medium"
                >
                  All Collections
                </button>
              </div>
            </div>
          </article>
        )}


        {/* -------------------------------------------------------------
            4. CONDITIONAL VIEW: SINGLE COLLECTION DETAIL VIEW
           ------------------------------------------------------------- */}
        {!searchQuery && !activeArticle && activeCollection && (
          <section className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-gray-500">
              <button 
                onClick={handleBackToSupportHome}
                className="hover:text-gray-900 cursor-pointer font-medium"
              >
                All Collections
              </button>
              <ChevronRight size={12} className="text-gray-400" />
              <span className="text-gray-800 font-semibold">
                {activeCollection.title}
              </span>
            </nav>

            {/* Collection Header Banner */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-6 sm:p-8 shadow-xs flex items-start gap-5">
              <div className={`w-14 h-14 rounded-2xl ${activeCollection.iconBg} ${activeCollection.iconColor} flex items-center justify-center shrink-0 shadow-xs`}>
                <activeCollection.icon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  {activeCollection.title}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {activeCollection.description}
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <span className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-[#C85A32] text-white text-[10px] flex items-center justify-center font-bold">M</span>
                    <span className="inline-block h-5 w-5 rounded-full ring-2 ring-white bg-[#735A4C] text-white text-[10px] flex items-center justify-center font-bold">A</span>
                  </div>
                  <span>{collectionArticles.length} articles in this collection</span>
                </div>
              </div>
            </div>

            {/* Articles List in Collection */}
            <div className="space-y-3">
              {collectionArticles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => handleOpenArticle(art.id)}
                  className="bg-white rounded-xl border border-gray-200/90 hover:border-gray-300 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                      {art.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {art.summary}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-[#C85A32] group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              ))}
            </div>

            {/* Back button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleBackToSupportHome}
                className="text-xs font-bold text-[#C85A32] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                ← Back to all collections
              </button>
            </div>
          </section>
        )}


        {/* -------------------------------------------------------------
            5. DEFAULT VIEW: RUUL'S COLLECTIONS GRID
           ------------------------------------------------------------- */}
        {!searchQuery && !activeArticle && !activeCollection && (
          <section className="space-y-6">
            <div className="flex items-center justify-between pb-1 border-b border-gray-200/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Browse by Category
              </h2>
              <span className="text-xs text-gray-400 font-medium">
                {COLLECTIONS.reduce((acc, c) => acc + c.articlesCount, 0)} total articles
              </span>
            </div>

            {/* The Signature Ruul Grid of Collection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {COLLECTIONS.map((col) => {
                const previewArticles = ARTICLES.filter(a => a.collectionId === col.id).slice(0, 3);

                return (
                  <div
                    key={col.id}
                    onClick={() => handleOpenCollection(col.id)}
                    className="bg-white rounded-2xl border border-gray-200/90 hover:border-gray-300 hover:shadow-lg transition-all duration-200 p-6 flex flex-col justify-between cursor-pointer group relative"
                  >
                    <div className="space-y-4">
                      {/* Top icon and article count */}
                      <div className="flex items-start justify-between">
                        <div className={`w-12 h-12 rounded-xl ${col.iconBg} ${col.iconColor} flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs`}>
                          <col.icon className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100/90 px-2.5 py-1 rounded-full border border-gray-200/60">
                          {col.articlesCount} articles
                        </span>
                      </div>

                      {/* Collection Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#C85A32] transition-colors">
                          {col.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed line-clamp-2">
                          {col.description}
                        </p>
                      </div>

                      {/* Top 3 Article Teasers */}
                      <div className="pt-2 space-y-1.5 border-t border-gray-100">
                        {previewArticles.map((art) => (
                          <div 
                            key={art.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenArticle(art.id);
                            }}
                            className="text-xs text-gray-700 hover:text-[#C85A32] flex items-center justify-between py-1 px-1.5 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <span className="truncate pr-2 font-medium">• {art.title}</span>
                            <ChevronRight size={12} className="text-gray-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Author Cluster */}
                    <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          <span className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-[#C85A32] text-white text-[9px] flex items-center justify-center font-bold">M</span>
                          <span className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-[#735A4C] text-white text-[9px] flex items-center justify-center font-bold">G</span>
                        </div>
                        <span>By MArts Artisans &amp; Concierge</span>
                      </div>
                      <span className="font-bold text-[#C85A32] group-hover:translate-x-1 transition-transform inline-flex items-center">
                        View collection →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


        {/* -------------------------------------------------------------
            6. STILL NEED HELP? DIRECT CHANNELS (Ruul-style Support Desk)
            (Dedicated WhatsApp & Email Concierge Desk)
           ------------------------------------------------------------- */}
        <section className="mt-4 pt-10 border-t border-gray-200 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700 shadow-2xs">
              <MessageSquare size={13} className="text-[#C85A32]" />
              <span>Direct Human Support</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Still have questions? We&apos;re here to help
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Can&apos;t find what you&apos;re looking for? Reach out directly to our live artisan concierge via WhatsApp or email.
            </p>
          </div>

          {/* Side-by-side Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto w-full">
            
            {/* Card 1: Official WhatsApp Chat */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-[#BBF7D0] hover:border-[#86EFAC] rounded-2xl p-6 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <WhatsAppBrandIcon size={26} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
                    Online Now
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                    WhatsApp Support Desk
                    <ExternalLink size={14} className="text-gray-400 group-hover:text-gray-600" />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                    Direct chat with our artisan care team. Best for instant delivery tracking, transit damage photos, and bespoke commission quotes.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{whatsappDisplay}</p>
                  <p className="text-[11px] text-gray-400">Typical reply: under 15 minutes</p>
                </div>
                <span className="inline-flex items-center gap-1 px-3.5 py-2 bg-[#25D366] text-white font-bold rounded-xl shadow-xs group-hover:bg-[#1EBE5D] transition-colors">
                  Start WhatsApp Chat
                </span>
              </div>
            </a>

            {/* Card 2: Email Concierge Desk */}
            <div
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-6 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group cursor-pointer relative"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-[#C85A32] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                    <Mail size={24} />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#FFF7ED] text-[#C85A32] border border-[#FED7AA]">
                    <Clock size={11} />
                    Within 24 Hours
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                    Email Inquiry Desk
                    <ChevronRight size={16} className={`text-gray-400 transition-transform ${isFormOpen ? 'rotate-90' : ''}`} />
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                    Send detailed inquiries, institutional bulk orders, or tax invoice requests directly to our official inbox.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{supportEmail}</p>
                  <p className="text-[11px] text-gray-400">Operating hours: 9 AM - 7 PM IST</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-gray-900 text-white font-bold rounded-xl shadow-xs group-hover:bg-gray-800 transition-colors"
                >
                  {isFormOpen ? 'Close Form' : 'Write a Message'}
                </button>
              </div>
            </div>

          </div>

          {/* Interactive In-Page Contact Form Drawer */}
          {isFormOpen && (
            <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Send a Message to Support
                  </h3>
                  <p className="text-xs text-gray-500">
                    Our team will reply to your registered email address within 24 business hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {emailSent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-gray-900">Message Dispatched Successfully</h4>
                  <p className="text-xs text-gray-600 max-w-sm mx-auto">
                    Thank you! We have received your inquiry for <span className="font-semibold text-gray-800">{emailForm.email}</span>. A representative will get back to you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSent(false);
                      setEmailForm({ name: '', email: '', subject: 'Order Tracking & Delivery', message: '' });
                      setIsFormOpen(false);
                    }}
                    className="mt-3 px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sahanur Molla"
                        value={emailForm.name}
                        onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. customer@example.com"
                        value={emailForm.email}
                        onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Topic / Category
                    </label>
                    <select
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/10"
                    >
                      <option value="Order Tracking & Delivery">Order Tracking &amp; Delivery</option>
                      <option value="Transit Damage or Replacement">Transit Damage / 7-Day Replacement</option>
                      <option value="Custom Pottery / Statue Request">Custom Pottery or Bespoke Sculpture</option>
                      <option value="Corporate Gifting & Wholesale">Corporate Gifting &amp; Bulk Inquiry</option>
                      <option value="Billing / GST Invoice">Billing or GST Invoice</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Message Details *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe your inquiry (include Order ID if applicable)..."
                      value={emailForm.message}
                      onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#C85A32] focus:ring-2 focus:ring-[#C85A32]/10 resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-gray-400">
                      Protected under MArts Privacy Policy
                    </p>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Send size={14} />
                      <span>Submit Inquiry</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Standards & Transparency notice at bottom */}
          <div className="max-w-4xl mx-auto bg-white border border-gray-200/90 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#C85A32] flex items-center justify-center shrink-0 border border-orange-100">
              <ShieldCheck size={20} />
            </div>
            <div className="text-xs text-gray-600 leading-relaxed space-y-0.5">
              <p className="font-bold text-gray-900">Direct Human Artisan Network</p>
              <p>
                All communications and order assistance are handled by human curators in our artisan guild network. For urgent order corrections and immediate dispatch tracking, WhatsApp remains our fastest channel.
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default HelpCenter;
