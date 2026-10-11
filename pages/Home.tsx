import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Star,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  ShoppingCart,
  Heart,
  X,
  Search
} from 'lucide-react';
import { PRODUCTS } from '../constants';
import { CartItem, Product, User, CarouselBanner } from '../types';
import Header from '../components/Header';
import WhatsAppButton from '../components/WhatsAppButton';
import { HomeScreenSkeleton } from '../components/Skeleton';
import terracottaBanner from '../src/assets/images/marts_terracotta_banner_1791637410497.jpg';
import stoneStatuesBanner from '../src/assets/images/marts_stone_statues_banner_1791637432558.jpg';
import ceramicVasesBanner from '../src/assets/images/marts_ceramic_vases_banner_1791637442354.jpg';
import bronzeBrassBanner from '../src/assets/images/marts_bronze_brass_banner_1791637453407.jpg';

interface HomeProps {
  user?: User | null;
  onAddToCart: (item: CartItem) => void;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  cartCount?: number;
  products?: Product[];
  banners?: CarouselBanner[];
}

type BannerSlide = CarouselBanner;

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 'slide-1',
    image: terracottaBanner,
    fallbackImage: '/media/banners/marts_terracotta_banner_1791637410497.jpg',
    title: 'MArts Heirloom Terracotta Pottery',
    subtitle: 'Wheel-thrown alluvial clay vessels fired in traditional biomass wood kilns',
    tag: 'Wheel-Thrown Masterpieces',
    link: '/product/1',
    productId: '1',
    ctaText: 'Shop Collection',
    active: true
  },
  {
    id: 'slide-2',
    image: stoneStatuesBanner,
    fallbackImage: '/media/banners/marts_stone_statues_banner_1791637432558.jpg',
    title: 'MArts Sacred Stone Sculptures',
    subtitle: 'Solid monolithic sandstone sculptures carved by generational master sculptors',
    tag: 'Sacred Sculptures',
    link: '/product/2',
    productId: '2',
    ctaText: 'Explore Masterpieces',
    active: true
  },
  {
    id: 'slide-3',
    image: ceramicVasesBanner,
    fallbackImage: '/media/banners/marts_ceramic_vases_banner_1791637442354.jpg',
    title: 'MArts Ceramic Vases',
    subtitle: 'Watertight stoneware pottery dipped in tactile raw earth & oatmeal mineral glazes',
    tag: 'Artisan Ceramics',
    link: '/product/3',
    productId: '3',
    ctaText: 'Discover New Arrivals',
    active: true
  },
  {
    id: 'slide-4',
    image: bronzeBrassBanner,
    fallbackImage: '/media/banners/marts_bronze_brass_banner_1791637453407.jpg',
    title: 'MArts Heritage Bronze & Brass',
    subtitle: 'Heirloom bell-metal sculptures with hand-rubbed antique beeswax patina',
    tag: 'Heritage Metalwork',
    link: '/product/4',
    productId: '4',
    ctaText: 'Shop Heritage Idols',
    active: true
  }
];

// In-memory cache to ensure Home page only shows skeleton on initial load, not on every return
let isHomeLoadedCache = false;

export const Home: React.FC<HomeProps> = ({
  user,
  onAddToCart,
  wishlist,
  onToggleWishlist,
  cartCount = 0,
  products,
  banners
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(() => !isHomeLoadedCache);

  // Dynamic Carousel Banners from Firestore with fallback to defaults
  const activeBanners = useMemo(() => {
    if (banners && banners.length > 0) {
      const filtered = banners.filter((b) => b.active !== false);
      if (filtered.length > 0) return filtered;
    }
    return BANNER_SLIDES;
  }, [banners]);

  // Initial mount transition to show full screen skeleton (cached on first visit)
  useEffect(() => {
    if (!isHomeLoadedCache) {
      const timer = setTimeout(() => {
        isHomeLoadedCache = true;
        setIsLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle initial search from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).initialSearch) {
      setSearchQuery((location.state as any).initialSearch);
    }
  }, [location.state]);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const carouselTouchStartX = useRef<number | null>(null);

  // Auto advance carousel every 5 seconds
  useEffect(() => {
    if (isPaused || activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused, activeBanners.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activeBanners.length);
  };

  // Touch scroll tracker for product cards
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isScrollingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      isScrollingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos.current && e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 7 || dy > 7) {
        isScrollingRef.current = true;
      }
    }
  };

  const handleCardClick = (productId: string) => {
    if (isScrollingRef.current) {
      isScrollingRef.current = false;
      return;
    }
    navigate(`/product/${productId}`);
  };

  const handleQuickAdd = (product: Product, customTitle?: string, customPrice?: number) => {
    const item: CartItem = {
      ...product,
      name: customTitle || product.name,
      price: customPrice || product.price,
      quantity: 1,
    };
    onAddToCart(item);
  };

  const handleDirectBuy = (product: Product, customTitle?: string, customPrice?: number) => {
    const item: CartItem = {
      ...product,
      name: customTitle || product.name,
      price: customPrice || product.price,
      quantity: 1,
    };
    onAddToCart(item);
    if (!user) {
      navigate('/login?redirect=checkout');
      return;
    }
    navigate('/checkout');
  };

  // Filter & Automatic Sorting by Search Query
  const baseCatalog = useMemo(() => {
    return products && products.length > 0 ? products : PRODUCTS;
  }, [products]);

  const displayedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = [...baseCatalog];

    if (q) {
      // Filter products containing search terms
      list = list.filter((p) => {
        const name = p.name.toLowerCase();
        const cat = p.category.toLowerCase();
        const sub = p.subCategory.toLowerCase();
        const desc = p.description.toLowerCase();
        return name.includes(q) || cat.includes(q) || sub.includes(q) || desc.includes(q);
      });

      // Automatically sort products by relevance
      list.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aIdx = aName.indexOf(q);
        const bIdx = bName.indexOf(q);
        if (aIdx !== -1 && bIdx !== -1 && aIdx !== bIdx) {
          return aIdx - bIdx;
        }

        return b.rating - a.rating;
      });
    }

    return list;
  }, [searchQuery, baseCatalog]);

  if (isLoading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2B221B] font-sans selection:bg-[#EBDCCB] pb-16">
      {/* Top Header with live search connection */}
      <Header
        user={user || null}
        cartCount={cartCount || 0}
        wishlistCount={wishlist.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Homepage Products Showcase Banner Carousel */}
      <section
        className="w-full relative overflow-hidden bg-[#2B221B] select-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            carouselTouchStartX.current = e.touches[0].clientX;
          }
        }}
        onTouchEnd={(e) => {
          if (carouselTouchStartX.current !== null && e.changedTouches.length > 0) {
            const diff = carouselTouchStartX.current - e.changedTouches[0].clientX;
            if (diff > 40) handleNextSlide();
            else if (diff < -40) handlePrevSlide();
            carouselTouchStartX.current = null;
          }
        }}
      >
        {/* Carousel Frame - Well-proportioned widescreen format for printed banner graphics */}
        <div className="w-full aspect-[16/9] sm:aspect-[16/8] md:aspect-[16/7] lg:aspect-[16/6.5] max-h-[520px] relative flex">
          {activeBanners.map((slide, idx) => {
            const isActive = idx === currentSlide;
            const targetLink = slide.productId ? `/product/${slide.productId}` : (slide.link || '/');
            return (
              <div
                key={slide.id || `banner-${idx}`}
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                  isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                {/* Banner with Embedded Artistic Typography & Direct Link */}
                <Link
                  to={targetLink}
                  className="block w-full h-full cursor-pointer relative group"
                  aria-label={slide.title}
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (slide.fallbackImage && target.src !== slide.fallbackImage && !target.src.endsWith(slide.fallbackImage)) {
                        target.src = slide.fallbackImage;
                      }
                    }}
                    className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.01]"
                  />
                </Link>
              </div>
            );
          })}

          {/* Carousel Previous / Next Navigation Arrows (Hidden on mobile and tablets, visible on desktop) */}
          {activeBanners.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevSlide}
                className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs items-center justify-center transition-all cursor-pointer border border-white/20"
                aria-label="Previous Slide"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs items-center justify-center transition-all cursor-pointer border border-white/20"
                aria-label="Next Slide"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Carousel Pagination Dots */}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2">
              {activeBanners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`transition-all rounded-full cursor-pointer ${
                    idx === currentSlide
                      ? 'w-6 sm:w-8 h-1.5 sm:h-2 bg-[#C85A32]'
                      : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Product Catalog Section */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-8 sm:py-10 w-full">
        {/* Section Header & Search Status */}
        <div className="mb-6 border-b border-[#E8DFD8] pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#B85D36] uppercase tracking-wider mb-0.5 sm:mb-1">
                {searchQuery ? 'Live Search Results' : 'Curated Catalog'}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#2B221B] tracking-tight">
                {searchQuery ? `Searching "${searchQuery}"` : 'Artisan Pottery & Statues'}
              </h2>
            </div>

            <div className="shrink-0 flex items-center justify-end">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C85A32] hover:text-[#8C3F1E] bg-[#FAF0E6] px-3 py-1.5 rounded-full cursor-pointer border border-[#EADBCC]"
                >
                  <X size={14} />
                  <span>Clear Search Filter</span>
                </button>
              ) : (
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#B85D36] hover:text-[#8C3F1E] group whitespace-nowrap"
                >
                  <span>View all products</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#735A4C] mt-1 sm:mt-1.5">
            {searchQuery
              ? `Showing ${displayedProducts.length} creations sorted automatically by relevance`
              : 'Hand-thrown terracotta pots, glazed ceramic urns, stone sculptures & brass idols'}
          </p>
        </div>

        {/* Products Grid: Exactly 2 in a row on mobile, 4 in a row on tablets, 4 in a row on desktop */}
        {displayedProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center mx-auto">
              <Search size={26} />
            </div>
            <p className="text-base font-serif font-bold text-[#2B221B]">No creations found</p>
            <p className="text-xs text-[#735A4C] max-w-sm mx-auto">
              We couldn&apos;t find any pottery or statue matching &ldquo;{searchQuery}&rdquo;. Try another term or clear your search filter.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 px-4 py-2 bg-[#C85A32] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              View All Creations
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            {displayedProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => handleCardClick(prod.id)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                className="bg-transparent rounded-none border-0 shadow-none p-0 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  {/* Clean Product Image Container directly on surface */}
                  <div className="relative bg-[#FAF6F0] rounded-xl sm:rounded-2xl aspect-square overflow-hidden mb-2 sm:mb-3 flex items-center justify-center">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Wishlist toggle icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(prod.id);
                      }}
                      className={`absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-xs border border-[#E8DFD8] flex items-center justify-center transition-all cursor-pointer ${
                        wishlist.includes(prod.id) ? 'text-[#C85A32]' : 'text-gray-400 hover:text-[#C85A32]'
                      }`}
                      aria-label="Save to Wishlist"
                    >
                      <Heart size={14} fill={wishlist.includes(prod.id) ? '#C85A32' : 'none'} />
                    </button>
                  </div>

                  {/* Rating & reviews */}
                  <div className="flex items-center gap-1 text-[11px] sm:text-xs text-[#735A4C] mb-1">
                    <Star className="w-3 h-3 text-amber-500 fill-current" />
                    <span className="font-bold text-[#2B221B]">{prod.rating}</span>
                    <span className="text-[#8C6D58]">({prod.reviewsCount})</span>
                  </div>

                  {/* Product Title */}
                  <h3 className="font-serif font-bold text-[#2B221B] text-xs sm:text-sm md:text-base leading-snug line-clamp-2 mb-1.5 group-hover:text-[#B85D36] transition-colors">
                    {prod.name}
                  </h3>

                  {/* Description snippet */}
                  <p className="text-[11px] sm:text-xs text-[#735A4C] line-clamp-2 mb-2.5 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                <div>
                  {/* Price Display */}
                  <div className="flex items-baseline gap-1.5 mb-2.5 pt-1.5 border-t border-[#F0E6DC]">
                    <span className="text-sm sm:text-base md:text-lg font-bold text-[#2B221B]">
                      ₹{prod.price.toLocaleString()}
                    </span>
                    {prod.oldPrice && (
                      <del className="text-[10px] sm:text-xs text-[#A89283] font-normal">
                        ₹{prod.oldPrice.toLocaleString()}
                      </del>
                    )}
                    {prod.discount && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#9C4320] bg-[#F7ECE4] px-1.5 py-0.2 rounded">
                        {prod.discount}
                      </span>
                    )}
                  </div>

                  {/* Interactive Action Buttons (Neatly proportioned for 2 in a row mobile) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                    <button
                      type="button"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isScrollingRef.current) return;
                        handleQuickAdd(prod);
                      }}
                      className="flex-[1] bg-[#FAF5EE] hover:bg-[#F2E9DE] text-[#5E473A] text-[11px] sm:text-xs font-semibold py-1.5 sm:py-2 px-1 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer border border-[#E5D7CA] min-w-0"
                      title="Add to Cart"
                      aria-label="Add to Cart"
                    >
                      <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="truncate">Cart</span>
                    </button>

                    <button
                      type="button"
                      style={{ flex: 1.3 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isScrollingRef.current) return;
                        handleDirectBuy(prod);
                      }}
                      className="flex-[1.3] bg-[#C85A32] hover:bg-[#A04724] text-white text-[11px] sm:text-xs font-bold py-1.5 sm:py-2 px-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 shadow-xs cursor-pointer min-w-0"
                      title="Buy Now"
                      aria-label="Buy Now"
                    >
                      <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="truncate font-bold">Buy Now</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating WhatsApp Action Button (Exclusively on Homepage) */}
      <WhatsAppButton />
    </div>
  );
};

export default Home;
