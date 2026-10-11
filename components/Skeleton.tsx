import React from 'react';

/**
 * Universal Shimmer Block helper
 */
interface ShimmerBlockProps {
  className?: string;
}

export const ShimmerBlock: React.FC<ShimmerBlockProps> = ({ className = '' }) => (
  <div className={`bg-[#EADBCC]/60 rounded animate-pulse ${className}`} />
);

/**
 * 1. ProductCardSkeleton
 * Matches the actual product card design used across Home, AllProducts, and Category listings:
 * - Square image frame with rounded-xl/sm:rounded-2xl and rounded heart button placeholder
 * - Star rating line
 * - 2-line Serif title
 * - Description snippet
 * - Price row with discount badge
 * - Dual action buttons: "Cart" and "Buy"
 */
export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-transparent rounded-none border-0 shadow-none p-0 flex flex-col justify-between animate-pulse select-none">
      <div>
        {/* Product Image Frame */}
        <div className="relative bg-[#FAF6F0] rounded-xl sm:rounded-2xl aspect-square overflow-hidden mb-2 sm:mb-3 flex items-center justify-center border border-[#EADBCC]/40">
          <div className="w-16 h-16 rounded-full bg-[#EADBCC]/40" />
          {/* Wishlist toggle placeholder */}
          <div className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 border border-[#E8DFD8] flex items-center justify-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#EADBCC]/60" />
          </div>
        </div>

        {/* Rating or status line placeholder */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="h-3 w-16 bg-[#EADBCC]/50 rounded" />
        </div>

        {/* Product Title (2-line font-serif) */}
        <div className="space-y-1.5 mb-2">
          <div className="h-4 w-11/12 bg-[#DFD6CB] rounded" />
          <div className="h-4 w-3/5 bg-[#DFD6CB] rounded" />
        </div>

        {/* Description snippet */}
        <div className="space-y-1 mb-2.5">
          <div className="h-3 w-full bg-[#EADBCC]/50 rounded" />
          <div className="h-3 w-4/5 bg-[#EADBCC]/40 rounded" />
        </div>
      </div>

      <div>
        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mb-2.5 pt-1.5 border-t border-[#F0E6DC]">
          <div className="h-5 w-20 bg-[#DFD6CB] rounded" />
          <div className="h-3.5 w-12 bg-[#EADBCC]/60 rounded" />
          <div className="h-3.5 w-10 bg-[#FAF0E6] rounded" />
        </div>

        {/* Dual action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full">
          <div className="flex-1 h-8 sm:h-9 bg-[#FAF5EE] border border-[#E5D7CA] rounded-lg" />
          <div className="flex-1 h-8 sm:h-9 bg-[#C85A32]/40 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

/**
 * 2. ProductListingSkeleton
 * Matches the /products (AllProducts) page layout:
 * - Sticky header with search, wishlist, cart
 * - Search bar with filter pills (All, Latest, Popular)
 * - 4-column responsive grid of ProductCardSkeletons
 */
export const ProductListingSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2B221B] font-sans flex flex-col animate-pulse select-none">
      {/* Top Header Placeholder */}
      <div className="w-full bg-[#FAF8F5] border-b border-[#EADBCC]/60 sticky top-0 z-40 px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 min-h-[56px] sm:min-h-[62px]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#EADBCC]" />
            <div className="h-5 w-24 bg-[#EADBCC] rounded" />
          </div>
          <div className="hidden lg:block flex-1 max-w-md mx-6">
            <div className="h-9 w-full bg-white/90 border border-[#E5D7CA] rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#EADBCC]/60" />
            <div className="w-9 h-9 rounded-full bg-[#EADBCC]/60" />
          </div>
        </div>
      </div>

      {/* Catalog Search & Filter Controls */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 pt-5 sm:pt-6 pb-2 w-full">
        {/* Search Input bar */}
        <div className="max-w-2xl mx-auto">
          <div className="h-11 sm:h-12 w-full bg-transparent border border-[#E5D7CA] rounded-full" />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 mt-3.5 sm:mt-4 w-full">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="h-8 w-14 bg-[#C85A32]/60 rounded-full" />
            <div className="h-8 w-18 bg-white border border-[#E5D7CA] rounded-full" />
            <div className="h-8 w-20 bg-white border border-[#E5D7CA] rounded-full" />
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-5 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
          {Array.from({ length: count }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 3. ProductDetailSkeleton
 * Matches the updated ProductDetail page UI:
 * - Back button + Logo + Cart header
 * - 2-column dynamic grid on tablet/desktop:
 *   - Left: Square product image frame with centered item and carousel dots (• o o)
 *   - Right: Eyebrow brand, title, pricing, quantity stepper, stock status, guarantee cards, and Add to Cart / Buy Now buttons
 *   - Bottom tabbed info section (Details | Specifications | Reviews) starting straight flush left
 */
export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-white font-sans text-gray-900 flex flex-col animate-pulse select-none">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-xs px-4 sm:px-8 lg:px-12 py-3 min-h-[56px] sm:min-h-[64px] flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="w-10 h-10 rounded-full bg-gray-100" />
        <div className="h-6 w-28 bg-[#EADBCC] rounded" />
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gray-100" />
          <div className="w-10 h-10 rounded-full bg-gray-100" />
        </div>
      </div>

      {/* Main Product Container */}
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 border-b border-gray-100">
          {/* Left Column: Product Gallery */}
          <div className="md:col-span-6 lg:col-span-6 p-4 sm:p-6 lg:p-10 flex flex-col items-center justify-center bg-white md:border-r border-gray-100">
            <div className="w-full aspect-square max-w-[360px] md:max-w-[440px] bg-[#FAF6F0] rounded-2xl flex items-center justify-center p-4 border border-[#EADBCC]/30">
              <div className="w-3/4 h-3/4 bg-[#EADBCC]/50 rounded-xl" />
            </div>
            {/* Gallery pagination dots */}
            <div className="flex items-center gap-2 mt-4">
              <div className="w-2.5 h-2.5 bg-[#2E2E2E] rounded-full" />
              <div className="w-2 h-2 bg-gray-200 rounded-full" />
              <div className="w-2 h-2 bg-gray-200 rounded-full" />
            </div>
          </div>

          {/* Right Column: Metadata, Pricing & Purchase Flow */}
          <div className="md:col-span-6 lg:col-span-6 px-5 sm:px-6 lg:px-10 pt-4 md:pt-6 lg:pt-10 pb-6 flex flex-col justify-between gap-4 bg-white">
            <div className="space-y-4">
              {/* Brand Eyebrow */}
              <div className="h-3.5 w-24 bg-[#C85A32]/40 rounded" />

              {/* Title */}
              <div className="space-y-2">
                <div className="h-6 sm:h-7 w-4/5 bg-gray-200 rounded" />
                <div className="h-6 w-3/5 bg-gray-200 rounded" />
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>

              {/* Price row */}
              <div className="flex items-baseline gap-3 pt-2">
                <div className="h-8 w-28 bg-[#BA3D1D]/30 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-[#F7ECE4] rounded" />
              </div>

              {/* Description preview */}
              <div className="space-y-2 pt-2">
                <div className="h-3.5 w-full bg-gray-200 rounded" />
                <div className="h-3.5 w-5/6 bg-gray-200 rounded" />
                <div className="h-3.5 w-2/3 bg-gray-200 rounded" />
              </div>

              {/* Quantity stepper */}
              <div className="pt-2">
                <div className="h-10 w-36 bg-gray-100 rounded-xl" />
              </div>

              {/* Guarantee / Delivery Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="h-16 bg-[#FAF8F5] border border-[#EADBCC]/60 rounded-xl" />
                <div className="h-16 bg-[#FAF8F5] border border-[#EADBCC]/60 rounded-xl" />
              </div>
            </div>

            {/* Action Buttons: Add to Cart and Buy Now */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <div className="flex-1 h-12 bg-gray-100 rounded-xl" />
              <div className="flex-1 h-12 bg-[#C85A32]/60 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Tabbed Info Section (Details | Specifications | Reviews) */}
        {/* Clean left-aligned tab headers matching current ProductDetail tab layout */}
        <div className="bg-white flex-1 pb-16">
          <div className="flex items-center justify-start gap-6 sm:gap-8 lg:gap-10 border-b border-gray-200 px-5 sm:px-6 lg:px-10 overflow-x-auto">
            <div className="py-3.5 border-b-[2.5px] border-[#C85A32]">
              <div className="h-4 w-16 bg-gray-900/60 rounded" />
            </div>
            <div className="py-3.5 border-b-[2.5px] border-transparent">
              <div className="h-4 w-24 bg-gray-300 rounded" />
            </div>
            <div className="py-3.5 border-b-[2.5px] border-transparent">
              <div className="h-4 w-20 bg-gray-300 rounded" />
            </div>
          </div>

          {/* Tab Content Placeholder */}
          <div className="px-5 sm:px-6 lg:px-10 py-6 max-w-4xl space-y-4">
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-11/12 bg-gray-100 rounded" />
            <div className="h-4 w-4/5 bg-gray-100 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <div className="h-12 bg-gray-50 rounded-lg border border-gray-100" />
              <div className="h-12 bg-gray-50 rounded-lg border border-gray-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 4. WishlistSkeleton
 * Matches the updated Wishlist page:
 * - Header with "My Wishlist" title and item counter badge
 * - Description line
 * - 4-column responsive grid of wishlist items with square image and card metadata
 */
export const WishlistSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2B221B] font-sans flex flex-col animate-pulse select-none">
      {/* Top Header Placeholder */}
      <div className="w-full bg-[#FAF8F5] border-b border-[#EADBCC]/60 sticky top-0 z-40 px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 min-h-[56px] sm:min-h-[62px]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#EADBCC]/60" />
            <div className="h-5 w-28 bg-[#EADBCC] rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#EADBCC]/60" />
            <div className="w-9 h-9 rounded-full bg-[#EADBCC]/60" />
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8">
        {/* Page Heading */}
        <div className="pb-6 mb-6 border-b border-[#EADBCC] space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-36 bg-[#DFD6CB] rounded-md" />
            <div className="h-5 w-16 bg-[#F2E8DE] rounded-full" />
          </div>
          <div className="h-4 w-96 max-w-full bg-[#EADBCC]/60 rounded" />
        </div>

        {/* Grid of Wishlist Item Skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
          {Array.from({ length: count }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 5. OrderHistorySkeleton
 * Matches the updated MyOrders page order cards:
 * - Transparent background cards with border border-[#EADBCC]
 * - Aligned to max-w-7xl matching the header and page container
 * - 2-column responsive layout on desktop (products on left, price summary on right)
 * - Shimmer animation in warm earthen artisanal tones
 */
export const OrderHistorySkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="w-full space-y-6 sm:space-y-8 divide-y divide-[#EADBCC]/80 animate-pulse select-none">
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className="bg-transparent border-0 pt-6 first:pt-0 pb-2 space-y-4 sm:space-y-5"
        >
          {/* Top Bar: Order ID, Date & Status Chip Placeholder */}
          <div className="flex items-center justify-between pb-4 border-b border-[#EADBCC]/80">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="h-4 w-32 sm:w-44 bg-[#EADBCC] rounded" />
              <div className="h-3 w-24 bg-[#EADBCC]/60 rounded mt-1" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block h-7 w-20 bg-[#FAF5EF] border border-[#EADBCC] rounded-full" />
              <div className="h-7 w-24 bg-[#FAF0E6] rounded-full border border-[#EADBCC]/80" />
            </div>
          </div>

          {/* Card Body Grid: Products on Left, Price Summary on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Product items placeholder */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-3.5 divide-y divide-[#EADBCC]/60">
              <div className="flex gap-3 sm:gap-4 items-start pt-1 first:pt-0">
                <div className="w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] bg-[#FAF5EF] border border-[#EADBCC]/60 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2 py-0.5 min-w-0">
                  <div className="h-4 w-3/4 sm:w-2/3 bg-[#EADBCC] rounded" />
                  <div className="h-3 w-32 bg-[#EADBCC]/60 rounded" />
                  <div className="h-3 w-40 bg-[#EADBCC]/40 rounded mt-1.5" />
                </div>
              </div>
            </div>

            {/* Right: Price details breakdown placeholder */}
            <div className="lg:col-span-5 xl:col-span-4 border-t lg:border-t-0 lg:border-l border-[#EADBCC]/80 pt-4 lg:pt-0 lg:pl-6 space-y-2.5">
              <div className="h-3 w-36 bg-[#EADBCC] rounded mb-2" />
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-[#EADBCC]/50 rounded" />
                <div className="h-3 w-16 bg-[#EADBCC]/50 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-24 bg-[#EADBCC]/50 rounded" />
                <div className="h-3 w-14 bg-[#EADBCC]/50 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-20 bg-[#EADBCC]/50 rounded" />
                <div className="h-3 w-12 bg-[#EADBCC]/50 rounded" />
              </div>
              <div className="flex justify-between pt-2 border-t border-[#EADBCC]/60">
                <div className="h-4 w-24 bg-[#EADBCC] rounded" />
                <div className="h-4 w-20 bg-[#C85A32]/40 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 6. CartSkeleton
 * Matches the updated Cart page:
 * - Header bar
 * - Saved delivery address bar with change action
 * - Cart item cards with image, title, price, and stepper (+ -)
 * - Order summary sidebar on desktop
 */
export const CartSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-white min-h-screen text-[#1F1F1F] font-sans flex flex-col animate-pulse select-none">
      {/* Header Bar */}
      <div className="bg-white py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] px-4 sm:px-8 lg:px-12 flex items-center justify-between sticky top-0 z-40 border-b border-gray-100 shadow-xs max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-gray-100" />
          <div className="h-5 w-24 bg-gray-300 rounded" />
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 flex-1">
        {/* Address Banner */}
        <div className="p-4 rounded-xl border border-gray-200 mb-6 bg-[#FAF8F5] flex items-center justify-between">
          <div className="space-y-1.5 w-3/4">
            <div className="h-3.5 w-28 bg-[#C85A32]/40 rounded" />
            <div className="h-4 w-56 bg-gray-300 rounded" />
            <div className="h-3 w-80 max-w-full bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-20 bg-white border border-gray-200 rounded-lg" />
        </div>

        {/* Cart Content: Items + Summary (2 columns on desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-8 divide-y divide-gray-100">
            {[1, 2].map((i) => (
              <div key={i} className="py-4 first:pt-0 flex gap-4 items-start">
                <div className="w-24 h-24 bg-[#FAF6F0] rounded-xl border border-[#EADBCC]/40 shrink-0" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-4 w-3/4 bg-gray-300 rounded" />
                  <div className="h-3 w-1/3 bg-gray-200 rounded" />
                  <div className="h-5 w-24 bg-[#C85A32]/40 rounded" />
                  <div className="h-8 w-28 bg-gray-100 rounded-lg mt-2" />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Summary Sidebar */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-[#FAF8F5] border border-gray-200 space-y-4">
            <div className="h-5 w-32 bg-gray-300 rounded" />
            <div className="space-y-2.5 pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <div className="h-3.5 w-20 bg-gray-200 rounded" />
                <div className="h-3.5 w-16 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3.5 w-20 bg-gray-200 rounded" />
                <div className="h-3.5 w-12 bg-gray-200 rounded" />
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <div className="h-5 w-24 bg-gray-300 rounded" />
                <div className="h-5 w-20 bg-[#C85A32]/60 rounded" />
              </div>
            </div>
            <div className="h-12 w-full bg-[#C85A32]/70 rounded-xl mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 7. AddressPageSkeleton
 * Matches the newly updated full-width desktop address page & form:
 * - Unified header with back arrow and "Address" title
 * - Full-width max-w-7xl desktop container
 * - Address list cards with default badge and action buttons
 * - Right-aligned buttons layout
 */
export const AddressPageSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-gray-50 min-h-screen font-sans relative animate-pulse select-none">
      <div className="w-full bg-white min-h-screen relative flex flex-col max-w-7xl mx-auto shadow-sm">
        {/* Header Bar */}
        <div className="bg-white py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] px-4 sm:px-8 lg:px-12 flex items-center gap-4 sticky top-0 z-30 border-b border-gray-100 shadow-xs">
          <div className="w-9 h-9 rounded-full bg-gray-100" />
          <div className="h-5 w-24 bg-gray-300 rounded" />
        </div>

        {/* Content area */}
        <div className="flex-1 px-4 sm:px-8 lg:px-12 py-5 space-y-4">
          {/* Top action row */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="h-5 w-40 bg-gray-300 rounded" />
            <div className="h-9 w-36 bg-[#C85A32]/40 rounded-lg" />
          </div>

          {/* Address cards list */}
          <div className="divide-y divide-gray-100">
            {[1, 2].map((i) => (
              <div key={i} className="py-5 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-32 bg-gray-300 rounded" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  {i === 1 && <div className="h-4 w-16 bg-[#FAF0E6] rounded" />}
                </div>
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
                <div className="flex items-center justify-between pt-2">
                  <div className="h-3.5 w-36 bg-gray-100 rounded" />
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-16 bg-gray-100 rounded" />
                    <div className="h-8 w-16 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 8. PolicyPageSkeleton
 * Matches Policy & Subpages desktop layout (Help Center, Privacy Policy, Terms, Refunds, Shipping):
 * - Sticky unified header with back arrow
 * - Full desktop width (max-w-7xl mx-auto px-4 sm:px-8 lg:px-12)
 * - 2-column or content cards layout
 */
export const PolicyPageSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-white min-h-screen font-sans flex flex-col animate-pulse select-none">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-[100] bg-white border-b border-gray-100 shadow-xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-3 sm:py-3.5 min-h-[56px] sm:min-h-[64px] flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-gray-100" />
          <div className="h-5 w-48 bg-gray-300 rounded" />
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-12 sm:pt-8 sm:pb-16 space-y-6">
        {/* Banner summary card */}
        <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#EADBCC]/60 space-y-3">
          <div className="h-6 w-64 bg-gray-300 rounded" />
          <div className="h-4 w-full max-w-2xl bg-gray-200 rounded" />
          <div className="h-4 w-4/5 max-w-xl bg-gray-200 rounded" />
        </div>

        {/* 2-Column Desktop Grid for Articles/Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl border border-gray-200 bg-white space-y-3">
              <div className="h-5 w-48 bg-gray-300 rounded" />
              <div className="h-3.5 w-full bg-gray-200 rounded" />
              <div className="h-3.5 w-11/12 bg-gray-200 rounded" />
              <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 9. HomeScreenSkeleton
 * Full Screen Skeleton UI for Home Page matching current MArts UI:
 * - Brand logo + desktop center search bar + action icons (Search mobile, Wishlist, Cart, Profile)
 * - High-end Carousel Banner with Widescreen aspect ratio (16/9 down to 16/6.5 desktop) and pagination dots
 * - Catalog Header: "Curated Catalog" eyebrow, "Artisan Pottery & Statues" heading, search bar & filter pills
 * - 8 Product Card Skeletons matching exact Home page grid (2 cols mobile, 4 cols tablet/desktop)
 */
export const HomeScreenSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-[#FAF8F5] text-[#2B221B] font-sans pb-16 animate-pulse select-none">
      {/* Top Header Skeleton Bar */}
      <header className="w-full bg-[#FAF8F5] border-b border-[#EADBCC]/60 sticky top-0 z-50 shadow-2xs">
        <div className="w-full px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 min-h-[56px] sm:min-h-[62px] max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo Placeholder */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#E5DDD4]" />
            <div className="h-5 w-24 bg-[#E5DDD4] rounded-md" />
          </div>

          {/* Desktop Search Input Bar Placeholder */}
          <div className="flex-1 max-w-md mx-6 hidden lg:block">
            <div className="h-9 w-full bg-white/90 rounded-full border border-[#E5D7CA]" />
          </div>

          {/* Header Action Icons (Search, Wishlist, Cart, Profile) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5DDD4]/70 lg:hidden" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5DDD4]/70" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5DDD4]/70" />
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5DDD4]/70" />
          </div>
        </div>
      </header>

      {/* Hero Banner Carousel Skeleton */}
      <section className="w-full relative overflow-hidden bg-[#FAF8F5]">
        <div className="w-full aspect-[16/9] sm:aspect-[16/8] md:aspect-[16/7] lg:aspect-[16/6.5] max-h-[520px] bg-[#E5DDD4]/60 relative flex flex-col justify-end p-4 sm:p-8 md:p-12 overflow-hidden border-b border-[#EADBCC]">
          {/* Carousel Pagination Dots */}
          <div className="absolute bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2">
            <div className="w-6 sm:w-8 h-1.5 sm:h-2 bg-[#C85A32] rounded-full" />
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/70 rounded-full" />
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/70 rounded-full" />
            <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* Catalog & Products Showcase Section Skeleton */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 pt-6 sm:pt-8 pb-8 sm:pb-10 w-full">
        {/* Section Header & Search Status */}
        <div className="mb-3 sm:mb-4 space-y-1.5">
          <div className="h-3 w-28 bg-[#B85D36]/40 rounded-full" />
          <div className="h-7 sm:h-8 w-64 sm:w-80 bg-[#DFD6CB] rounded-md" />
        </div>

        {/* Live Search bar placeholder */}
        <div className="max-w-2xl mx-auto my-4 sm:my-5">
          <div className="h-11 sm:h-12 w-full bg-transparent border border-[#E5D7CA] rounded-full" />
        </div>

        {/* 8 Product Cards Grid Skeleton (2 cols mobile, 4 cols tablet/desktop) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6 mt-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </section>
    </div>
  );
};
