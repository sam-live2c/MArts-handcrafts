import React, { useEffect, useState, useRef } from 'react';
import { User, CartItem, Product } from '../types';
import { PRODUCTS } from '../constants';
import Header from '../components/Header';
import { useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Check, ShoppingBag } from 'lucide-react';
import { FullScreenCircleLoader } from '../components/CircleLoader';

// In-memory cache for AllProducts page
let isAllProductsLoadedCache = false;

interface AllProductsProps {
  user: User | null;
  cartCount: number;
  onAddToCart: (item: CartItem, silent?: boolean) => void;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
}

const AllProducts: React.FC<AllProductsProps> = ({
  user,
  cartCount,
  onAddToCart,
  wishlist,
  onToggleWishlist
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(() => !isAllProductsLoadedCache);

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

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header
        user={user}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        title="All Products"
        showBack={true}
      />
      
      {isLoading ? (
        <FullScreenCircleLoader />
      ) : (
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8">
          <div className="mb-8">
            <p className="text-sm sm:text-base text-[#5F6368]">
              Explore our complete collection of handcrafted terracotta pottery, stone sculptures, and artisan creations.
            </p>
          </div>

          {/* 4-Card Hardware / Pottery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRODUCTS.map((prod) => (
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
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] font-bold text-[#8C3F1E] border border-[#DADCE0]">
                      {prod.subCategory}
                    </div>
                  </div>

                {/* Rating */}
                {(() => {
                  let count = prod.reviewsCount || 3;
                  let ratingVal = prod.rating || 5.0;
                  try {
                    const saved = localStorage.getItem(`melody_reviews_${prod.id}`);
                    if (saved) {
                      const parsed = JSON.parse(saved);
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        count = parsed.length;
                        const sum = parsed.reduce((acc: number, r: any) => acc + (r.rating || 5), 0);
                        ratingVal = Number((sum / parsed.length).toFixed(1));
                      }
                    }
                  } catch {}
                  return (
                    <div className="flex items-center gap-1 text-xs text-[#5F6368] mb-2">
                      <Star className="w-3.5 h-3.5 text-[#FBBC04] fill-current" />
                      <span className="font-bold text-[#202124]">{ratingVal}</span>
                      <span>({count.toLocaleString()})</span>
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
                  {(prod.oldPrice || 1499) && (
                    <del className="text-xs text-[#80868B] font-normal" aria-label="Maximum retail price">
                      ₹{(prod.oldPrice || 1499).toLocaleString()}
                    </del>
                  )}
                  {(prod.discount || '50% off') && (
                    <span className="text-[10px] font-bold text-[#188038] bg-[#E6F4EA] px-1.5 py-0.5 rounded">
                      {prod.discount || '50% off'}
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
      </div>
      )}
    </div>
  );
};

export default AllProducts;
