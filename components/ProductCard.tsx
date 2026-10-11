import React, { useRef } from "react";
import { Product, CartItem } from "../types";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getProductRatingInfo } from "../utils/productRating";

interface ProductCardProps {
  product: Product;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
  onAddToCart?: (item: CartItem, silent?: boolean) => void; // Keeping for compatibility, though we might not use it directly here
  isComparing?: boolean;
  onToggleComparison?: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted = false,
  onToggleWishlist,
}) => {
  const isOutOfStock = product.stock <= 0;
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
      if (dy > 25) {
        isScrollingRef.current = true;
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isScrollingRef.current) {
      e.preventDefault();
      isScrollingRef.current = false;
    }
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleWishlist) onToggleWishlist(product.id);
  };

  return (
    <Link
      to={`/product/${product.id}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      className={`bg-white rounded-none overflow-hidden flex flex-col h-full hover:shadow transition-shadow pb-2 ${isOutOfStock ? "opacity-75" : ""}`}
      aria-label={`View details for ${product.name}, price ₹${product.price.toLocaleString()}`}
    >
      <div className="relative bg-gray-50 flex items-center justify-center overflow-hidden aspect-square rounded-none">
        <img
          src={product.image}
          alt=""
          role="presentation"
          referrerPolicy="no-referrer"
          className="object-contain w-full h-full p-2"
        />

        {isOutOfStock && (
          <div
            className="absolute inset-0 bg-white/40 flex items-center justify-center z-20"
            aria-hidden="true"
          >
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-medium uppercase shadow-sm">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 px-2 flex-1 flex flex-col items-start bg-white z-10 relative">
        {/* Rating & reviews */}
        {(() => {
          const ratingInfo = getProductRatingInfo(product);
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

        <h3 className="text-xs font-semibold text-gray-700 leading-tight line-clamp-1 mb-1">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap w-full">
          <span className="text-sm font-bold text-gray-900">
            ₹{product.price.toLocaleString()}
          </span>
          {product.oldPrice && (
            <del
              className="text-[11px] text-gray-400 font-normal"
              aria-label="Maximum retail price"
            >
              ₹{product.oldPrice.toLocaleString()}
            </del>
          )}
          {product.discount && (
            <span className="text-[10px] font-bold text-green-600">
              {product.discount}
            </span>
          )}
        </div>

        {product.discount && (
          <div className="text-[10px] font-medium text-[#C85A32] mt-0.5">
            <b>{product.discount.replace(/[^0-9%]/g, "")} Off</b> with Bank
            offer
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
