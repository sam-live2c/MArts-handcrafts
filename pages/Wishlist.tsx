import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  Star
} from 'lucide-react';
import { Product, User } from '../types';
import Header from '../components/Header';
import { FullScreenCircleLoader } from '../components/CircleLoader';
import { getProductRatingInfo } from '../utils/productRating';

interface WishlistProps {
  user: User | null;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  onRemoveFromWishlist: (id: string) => void;
  onMoveToCart: (product: Product) => void;
  onMoveAllToCart?: (products: Product[]) => void;
  onClearWishlist?: () => void;
  cartCount: number;
  products?: Product[];
}

const Wishlist: React.FC<WishlistProps> = ({
  user,
  wishlist,
  onRemoveFromWishlist,
  cartCount,
  products
}) => {
  const navigate = useNavigate();
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

  // Combine products from catalog and local cache
  const allProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    try {
      const cached = localStorage.getItem('marts_products') || localStorage.getItem('melody_products');
      if (cached) {
        const parsed: Product[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  }, [products]);

  // Filter products that exist in the wishlist
  const wishlistProducts = useMemo(() => {
    return allProducts.filter((product) => wishlist.includes(product.id));
  }, [allProducts, wishlist]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2B221B] font-sans flex flex-col selection:bg-[#EBDCCB]">
      {/* Universal Header without search bar and search option */}
      <Header
        user={user}
        cartCount={cartCount}
        wishlistCount={wishlist.length}
        title="My Wishlist"
        showBack={true}
        showSearch={false}
      />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8">
        {/* Page Heading */}
        <div className="pb-6 mb-6 border-b border-[#EADBCC]">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2B221B] tracking-tight">
              My Wishlist
            </h1>
            <span className="text-xs sm:text-sm font-bold bg-[#F2E8DE] text-[#C85A32] px-2.5 py-0.5 rounded-full">
              {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#735A4C] mt-1 max-w-xl">
            Your saved collection of wheel-thrown terracotta pottery, vitrified ceramics, and hand-chiseled stone sculptures.
          </p>
        </div>

        {/* Wishlist Items Grid - matching Home page product grid style */}
        {wishlistProducts.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 items-stretch">
              {wishlistProducts.map((prod) => {
                const isOutOfStock = prod.stock <= 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => navigate(`/product/${prod.id}`)}
                    className="bg-transparent rounded-none border-0 shadow-none p-0 flex flex-col justify-between group cursor-pointer h-full"
                  >
                    <div className="flex-1 flex flex-col">
                      {/* Clean Product Image Container */}
                      <div className="relative bg-[#FAF6F0] rounded-xl sm:rounded-2xl aspect-square overflow-hidden mb-2 sm:mb-3 flex items-center justify-center">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />

                        {/* Top-right Heart Wishlist toggle icon */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromWishlist(prod.id);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 backdrop-blur-xs border border-[#E8DFD8] flex items-center justify-center transition-all cursor-pointer text-[#C85A32] hover:bg-rose-50 shadow-xs active:scale-90"
                          aria-label="Remove from Wishlist"
                          title="Remove from Wishlist"
                        >
                          <Heart size={14} fill="#C85A32" />
                        </button>

                        {/* Out of Stock overlay if applicable */}
                        {isOutOfStock && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                            <span className="bg-white text-[#2B221B] px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider shadow-sm">
                              Sold Out
                            </span>
                          </div>
                        )}
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
                      <h3 className="font-serif font-bold text-[#2B221B] text-xs sm:text-sm md:text-base leading-snug line-clamp-2 min-h-[2.5rem] mb-1.5 group-hover:text-[#B85D36] transition-colors">
                        {prod.name}
                      </h3>

                      {/* Description snippet */}
                      <p className="text-[11px] sm:text-xs text-[#735A4C] line-clamp-2 mb-2.5 leading-relaxed">
                        {prod.description}
                      </p>
                    </div>

                    {/* Aligned Price & Remove Action Footer */}
                    <div className="mt-auto pt-2 border-t border-[#F0E6DC] flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base md:text-lg font-bold text-[#2B221B]">
                          ₹{Number(prod.price || 0).toLocaleString()}
                        </span>
                        {prod.oldPrice && (
                          <del className="text-[10px] sm:text-xs text-[#A89283] font-normal">
                            ₹{Number(prod.oldPrice || 0).toLocaleString()}
                          </del>
                        )}
                        {prod.discount && (
                          <span className="text-[9px] sm:text-[10px] font-bold text-[#9C4320] bg-[#F7ECE4] px-1.5 py-0.5 rounded">
                            {prod.discount}
                          </span>
                        )}
                      </div>

                      {/* Remove label button beside price perfectly aligned */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromWishlist(prod.id);
                        }}
                        className="inline-flex items-center justify-center text-[11px] sm:text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-transparent hover:bg-neutral-50 border border-neutral-300 hover:border-neutral-400 px-2.5 sm:px-3 py-1 rounded transition-colors cursor-pointer shrink-0 active:scale-95 ml-auto"
                        title="Remove from Wishlist"
                        aria-label="Remove from Wishlist"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#FAF0E6] border border-[#EADBCC] flex items-center justify-center mb-5 text-[#C85A32] shadow-xs">
              <Heart size={36} strokeWidth={1.5} className="fill-[#C85A32]/10" />
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#2B221B]">
              Your wishlist is empty
            </h2>
            <p className="text-xs sm:text-sm text-[#735A4C] mt-2 mb-6 leading-relaxed">
              You haven&apos;t saved any handcrafted creations yet. Explore our kiln-fired pottery, stoneware vessels, and artisan stone sculptures to build your collection.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                to="/products"
                className="w-full sm:w-auto px-6 py-3 bg-[#C85A32] hover:bg-[#B34D27] text-white rounded-lg text-sm font-bold shadow-xs transition-colors text-center"
              >
                Explore Handcrafted Collection
              </Link>
              <Link
                to="/"
                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-[#FAF6F0] text-[#5E473A] border border-[#EADBCC] rounded-lg text-sm font-semibold transition-colors text-center"
              >
                Return to Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
