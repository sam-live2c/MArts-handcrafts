import React, { useRef } from "react";
import { Product, CartItem } from "../types";
import { Link } from "react-router-dom";

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
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 7 || dy > 7) {
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
          className="object-contain w-full h-full mix-blend-multiply p-2"
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
        <h3 className="text-xs font-semibold text-gray-700 leading-tight line-clamp-1 mb-1">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-1.5 flex-wrap w-full">
          <span className="text-sm font-bold text-gray-900">
            ₹{product.price.toLocaleString()}
          </span>
          {(product.oldPrice || 1499) && (
            <del
              className="text-[11px] text-gray-400 font-normal"
              aria-label="Maximum retail price"
            >
              ₹{(product.oldPrice || 1499).toLocaleString()}
            </del>
          )}
          {(product.discount || '50% off') && (
            <span className="text-[10px] font-bold text-green-600">
              {product.discount || '50% off'}
            </span>
          )}
        </div>

        {product.discount && (
          <div className="text-[10px] font-medium text-blue-600 mt-0.5">
            <b>{product.discount.replace(/[^0-9%]/g, "")} Off</b> with Bank
            offer
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
