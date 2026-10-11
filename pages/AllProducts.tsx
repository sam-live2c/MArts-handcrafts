import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, CartItem, Product } from '../types';
import Header from '../components/Header';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, ShoppingCart, ShoppingBag, X, Search, Heart } from 'lucide-react';
import { getProductRatingInfo } from '../utils/productRating';

interface AllProductsProps {
  user: User | null;
  cartCount: number;
  onAddToCart: (item: CartItem, silent?: boolean) => void;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  products?: Product[];
}

const AllProducts: React.FC<AllProductsProps> = ({
  user,
  cartCount,
  onAddToCart,
  wishlist,
  onToggleWishlist,
  products
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [reviewsTick, setReviewsTick] = useState(0);

  useEffect(() => {
    const handleReviewsUpdated = () => setReviewsTick((t) => t + 1);
    window.addEventListener('marts_reviews_updated', handleReviewsUpdated);
    window.addEventListener('storage', handleReviewsUpdated);
    return () => {
      window.removeEventListener('marts_reviews_updated', handleReviewsUpdated);
      window.removeEventListener('storage', handleReviewsUpdated);
    };
  }, []);

  const catalog = useMemo(() => {
    return products && products.length > 0 ? products : [];
  }, [products]);

  const [searchQuery, setSearchQuery] = useState(() => {
    return (location.state as any)?.initialSearch || '';
  });

  // Sync initialSearch if navigated with state
  useEffect(() => {
    if (location.state && (location.state as any).initialSearch) {
      setSearchQuery((location.state as any).initialSearch);
    }
  }, [location.state]);

  // Track touch/scroll movement so scrolling doesn't trigger card navigation
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
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dy > 28) {
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Filter & Automatic Sorting by Search Query and Active Filter
  const [activeFilter, setActiveFilter] = useState<'all' | 'latest' | 'popular'>('all');

  const displayedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...catalog];

    if (q) {
      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const sub = (p.subCategory || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(q) || cat.includes(q) || sub.includes(q) || desc.includes(q);
      });
    }

    if (activeFilter === 'popular') {
      // For popular use most rated product (genuine highest rating, then authentic review count)
      list.sort((a, b) => {
        const aInfo = getProductRatingInfo(a);
        const bInfo = getProductRatingInfo(b);
        const ratingDiff = bInfo.rating - aInfo.rating;
        if (ratingDiff !== 0) return ratingDiff;
        return bInfo.reviewsCount - aInfo.reviewsCount;
      });
    } else if (activeFilter === 'latest') {
      // Latest products
      list.reverse();
    } else if (q) {
      // If 'all' with active search query, sort products by relevance
      list.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aIdx = aName.indexOf(q);
        const bIdx = bName.indexOf(q);
        if (aIdx !== -1 && bIdx !== -1 && aIdx !== bIdx) {
          return aIdx - bIdx;
        }

        const aInfo = getProductRatingInfo(a);
        const bInfo = getProductRatingInfo(b);
        return bInfo.rating - aInfo.rating;
      });
    }

    return list;
  }, [searchQuery, catalog, activeFilter, reviewsTick]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF8F5] text-[#2B221B]">
      {/* Header without popup search icon */}
      <Header
        user={user}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        title="All Products"
        showBack={true}
        showSearch={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        products={products}
      />

      {/* Prominent Search Bar identical to Homepage */}
      <section className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 pt-4 sm:pt-6 pb-2">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-center bg-white rounded-full border border-[#E5D7CA] focus-within:border-[#C85A32] focus-within:ring-2 focus-within:ring-[#C85A32]/20 shadow-xs hover:border-[#D5C2B2] transition-all">
            <Search
              size={18}
              className="absolute left-4 text-[#8C6D58] pointer-events-none shrink-0"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search handcrafted pottery, statues, vases..."
              className="w-full pl-11 pr-11 py-2.5 sm:py-3 bg-transparent rounded-full text-xs sm:text-sm text-[#2B221B] placeholder-[#8C6D58]/80 outline-none font-medium"
              aria-label="Search creations"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 text-[#8C6D58] hover:text-[#2B221B] p-1 rounded-full cursor-pointer transition-colors"
                aria-label="Clear search query"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills Below Search Bar: Positioned to the LEFT same as Homepage */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-3.5 sm:mt-4 w-full">
          {[
            { id: 'all', label: 'All' },
            { id: 'latest', label: 'Latest' },
            { id: 'popular', label: 'Popular' }
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as 'all' | 'latest' | 'popular')}
                className={`h-8 sm:h-9 px-4 sm:px-5 inline-flex items-center justify-center rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap select-none shrink-0 transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#C85A32] text-white border-[#C85A32] shadow-xs'
                    : 'bg-white hover:bg-[#F2EAE2] text-[#4E392D] border-[#E5D7CA]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>
      
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-5 sm:py-8">
          {/* Empty Catalog or Empty Search Results */}
          {catalog.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center mx-auto">
                <ShoppingBag size={26} />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#2B221B]">No Creations Available Yet</h3>
              <p className="text-xs sm:text-sm text-[#735A4C] max-w-sm mx-auto">
                Our master artisans are currently crafting new collections. Please check back soon or explore our home gallery.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-3 px-5 py-2 bg-[#C85A32] text-white text-xs font-bold rounded-xl hover:bg-[#A04724] transition-colors cursor-pointer"
              >
                Back to Home
              </button>
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center mx-auto">
                <Search size={26} />
              </div>
              <h3 className="text-lg font-serif font-bold text-[#2B221B]">No Creations Found</h3>
              <p className="text-xs sm:text-sm text-[#735A4C] max-w-sm mx-auto">
                No products matched &ldquo;{searchQuery}&rdquo;. Try another keyword or clear the search filter.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 px-5 py-2 bg-[#C85A32] text-white text-xs font-bold rounded-xl hover:bg-[#A04724] transition-colors cursor-pointer"
              >
                Clear Search Filter
              </button>
            </div>
          ) : (
            /* Products Grid: Exactly 2 in a row on mobile, 4 in a row on desktop — same as homepage */
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
                    {/* Image Container with Wishlist Heart */}
                    <div className="relative bg-[#FAF6F0] rounded-xl sm:rounded-2xl aspect-square overflow-hidden mb-2 sm:mb-3 flex items-center justify-center">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-2"
                        referrerPolicy="no-referrer"
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
                    {(() => {
                      const ratingInfo = getProductRatingInfo(prod);
                      return (
                        <div className="flex items-center gap-1 text-[11px] sm:text-xs text-[#735A4C] mb-1">
                          {!ratingInfo.isUnrated && ratingInfo.reviewsCount > 0 && ratingInfo.rating > 0 ? (
                            <>
                              <Star className="w-3 h-3 text-amber-500 fill-current" />
                              <span className="font-bold text-[#2B221B]">{ratingInfo.rating.toFixed(1)}</span>
                              <span className="text-[#8C6D58]">({ratingInfo.reviewsCount})</span>
                            </>
                          ) : (
                            <span className="text-[10px] sm:text-[11px] font-medium text-[#A89283]">Unrated</span>
                          )}
                        </div>
                      );
                    })()}

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
                        <span className="text-[11px] sm:text-xs text-[#8C6D58] line-through">
                          ₹{prod.oldPrice.toLocaleString()}
                        </span>
                      )}
                      {prod.oldPrice && (
                        <span className="text-[10px] sm:text-[11px] font-bold text-[#1E7246] bg-[#E8F5E9] px-1 sm:px-1.5 py-0.5 rounded">
                          {Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100)}% OFF
                        </span>
                      )}
                    </div>

                    {/* Action Buttons: Add to Cart & Buy Now side-by-side */}
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(prod);
                        }}
                        className="w-full py-1.5 sm:py-2 px-1 sm:px-2 bg-[#FAF0E6] hover:bg-[#F2E4D8] active:bg-[#EBDCCB] text-[#C85A32] rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer border border-[#EADBCC]"
                      >
                        <ShoppingCart size={13} className="shrink-0" />
                        <span className="truncate">Add to Cart</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectBuy(prod);
                        }}
                        className="w-full py-1.5 sm:py-2 px-1 sm:px-2 bg-[#C85A32] hover:bg-[#A04724] active:bg-[#8C3F1E] text-white rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <ShoppingBag size={13} className="shrink-0" />
                        <span className="truncate">Buy Now</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
};

export default AllProducts;
