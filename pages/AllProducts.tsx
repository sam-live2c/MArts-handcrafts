import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, CartItem, Product } from '../types';
import Header from '../components/Header';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, ShoppingCart, Check, ShoppingBag, X, Search } from 'lucide-react';
import { FullScreenCircleLoader } from '../components/CircleLoader';

// In-memory cache for AllProducts page
let isAllProductsLoadedCache = false;

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
  const catalog = useMemo(() => {
    return products && products.length > 0 ? products : [];
  }, [products]);

  const [searchQuery, setSearchQuery] = useState(() => {
    return (location.state as any)?.initialSearch || '';
  });
  const [isLoading, setIsLoading] = useState(() => !isAllProductsLoadedCache);

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

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!isAllProductsLoadedCache) {
      const timer = setTimeout(() => {
        isAllProductsLoadedCache = true;
        setIsLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
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

  // Filter & Automatic Sorting by Search Query right on AllProducts page
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

        return (b.rating || 0) - (a.rating || 0);
      });
    }

    return list;
  }, [searchQuery, catalog]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header with Search enabled in home page style, live filtering this page */}
      <Header
        user={user}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        title="All Products"
        showBack={true}
        showSearch={true}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        products={products}
      />
      
      {isLoading ? (
        <FullScreenCircleLoader />
      ) : (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8">
          {/* Header Context / Search Status banner */}
          {searchQuery ? (
            <div className="mb-6 flex items-center justify-between gap-3 bg-[#FAF0E6]/70 p-3.5 sm:p-4 rounded-2xl border border-[#EADBCC]">
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#C85A32] uppercase tracking-wider block mb-0.5">
                  Live Search Results
                </span>
                <p className="text-sm sm:text-base font-serif font-bold text-[#2B221B] truncate">
                  Showing {displayedProducts.length} {displayedProducts.length === 1 ? 'creation' : 'creations'} for &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C85A32] hover:text-[#8C3F1E] bg-white px-3 py-1.5 rounded-full cursor-pointer border border-[#EADBCC] shrink-0 transition-colors shadow-2xs"
                title="Clear filter"
              >
                <X size={14} />
                <span>Clear Filter</span>
              </button>
            </div>
          ) : (
            <div className="mb-8">
              <p className="text-sm sm:text-base text-[#5F6368]">
                Explore our complete collection of handcrafted terracotta pottery, stone sculptures, and artisan creations.
              </p>
            </div>
          )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayedProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleCardClick(prod.id)}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  className="bg-transparent rounded-none border-0 p-0 flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Image Container directly on surface */}
                    <div className="relative bg-transparent rounded-none p-0 aspect-square flex items-center justify-center overflow-hidden mb-4">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain rounded-xl p-1"
                        referrerPolicy="no-referrer"
                      />
                      {prod.subCategory && (
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-[#8C3F1E] border border-[#DADCE0]">
                          {prod.subCategory}
                        </div>
                      )}
                    </div>

                  {/* Rating */}
                  {(() => {
                    let count = prod.reviewsCount || 0;
                    let ratingVal = prod.rating || 0;
                    try {
                      const saved = localStorage.getItem(`marts_reviews_${prod.id}`) || localStorage.getItem(`melody_reviews_${prod.id}`);
                      if (saved) {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                          const genuine = parsed.filter((r: any) => r.id && !['rev-1', 'rev-2', 'rev-3'].includes(r.id));
                          if (genuine.length > 0) {
                            count = genuine.length;
                            const sum = genuine.reduce((acc: number, r: any) => acc + (r.rating || 5), 0);
                            ratingVal = Number((sum / genuine.length).toFixed(1));
                          }
                        }
                      }
                    } catch {}
                    if (count > 0 || ratingVal > 0) {
                      return (
                        <div className="flex items-center gap-1 text-xs text-[#5F6368] mb-2">
                          <Star className="w-3.5 h-3.5 text-[#FBBC04] fill-current" />
                          <span className="font-bold text-[#202124]">{ratingVal > 0 ? ratingVal.toFixed(1) : '5.0'}</span>
                          <span>({count.toLocaleString()})</span>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8C6D58] mb-2">
                        <span className="bg-[#FAF0E6] text-[#C85A32] px-1.5 py-0.5 rounded text-[10px] font-semibold">Handcrafted</span>
                        <span className="text-[#A89283] text-[10px]">Artisan Original</span>
                      </div>
                    );
                  })()}

                  {/* Name */}
                  <h3 className="font-bold text-[#202124] text-sm sm:text-base leading-snug line-clamp-2 mb-2 group-hover:text-[#1A73E8] transition-colors">
                    {prod.name}
                  </h3>

                  {/* Highlight Bullet */}
                  <p className="text-xs text-[#5F6368] line-clamp-2 mb-4 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                <div>
                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-xl font-black text-[#202124]">
                      ₹{prod.price.toLocaleString()}
                    </span>
                    {prod.oldPrice && (
                      <del className="text-xs text-[#80868B] font-normal" aria-label="Maximum retail price">
                        ₹{prod.oldPrice.toLocaleString()}
                      </del>
                    )}
                    {prod.discount && (
                      <span className="text-[10px] font-bold text-[#188038] bg-[#E6F4EA] px-1.5 py-0.5 rounded">
                        {prod.discount}
                      </span>
                    )}
                  </div>

                {/* Action Buttons: Add to Cart (1) : Buy Now (2) Ratio */}
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    style={{ flex: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isScrollingRef.current) return;
                      handleQuickAdd(prod);
                    }}
                    className="flex-[1] bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#3C4043] text-xs font-semibold py-2.5 px-2 rounded-full transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer border border-gray-200/60 min-w-0"
                    title="Add to Cart"
                    aria-label="Add to Cart"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Add to Cart</span>
                  </button>
                  <button
                    type="button"
                    style={{ flex: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isScrollingRef.current) return;
                      handleDirectBuy(prod);
                    }}
                    className="flex-[2] bg-[#C85A32] hover:bg-[#A04724] text-white text-xs font-bold py-2.5 px-3 rounded-full transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-w-0"
                    title="Buy Now"
                    aria-label="Buy Now"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-bold">Buy Now</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>
  );
};

export default AllProducts;
