import React from 'react';

/**
 * Skeleton component for individual Product Card in product listings
 */
export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-transparent rounded-none border-0 p-0 flex flex-col justify-between animate-pulse">
      {/* Product Image Placeholder */}
      <div className="relative bg-gray-200 rounded-xl aspect-square overflow-hidden mb-3"></div>
      
      {/* Title & Category Line */}
      <div className="space-y-2">
        <div className="h-3 w-1/3 bg-gray-200 rounded-full"></div>
        <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
        <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
      </div>

      {/* Rating & Price */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
        <div className="space-y-1">
          <div className="h-3 w-12 bg-gray-200 rounded"></div>
          <div className="h-5 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 w-20 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Product Listing Grid / Category list
 */
export const ProductListingSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8 animate-pulse">
      {/* Header Placeholder */}
      <div className="mb-8 space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded-md"></div>
        <div className="h-4 w-96 max-w-full bg-gray-200 rounded"></div>
      </div>

      {/* Grid of Product Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: count }).map((_, idx) => (
          <ProductCardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Product Detail Page
 */
export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8 animate-pulse">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-3 w-14 bg-gray-200 rounded"></div>
        <div className="h-3 w-3 bg-gray-200 rounded-full"></div>
        <div className="h-3 w-24 bg-gray-200 rounded"></div>
        <div className="h-3 w-3 bg-gray-200 rounded-full"></div>
        <div className="h-3 w-32 bg-gray-200 rounded"></div>
      </div>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Image Gallery Skeleton */}
        <div className="lg:col-span-7 space-y-4">
          <div className="w-full aspect-square bg-gray-200 rounded-2xl"></div>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="aspect-square bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>

        {/* Right Column: Product Info Skeleton */}
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-gray-200 rounded-full"></div>
            <div className="h-8 w-4/5 bg-gray-200 rounded"></div>
            <div className="h-4 w-36 bg-gray-200 rounded"></div>
          </div>

          {/* Price Tag Skeleton */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
            <div className="flex items-baseline gap-3">
              <div className="h-8 w-28 bg-gray-200 rounded"></div>
              <div className="h-5 w-20 bg-gray-200 rounded"></div>
            </div>
            <div className="h-3 w-40 bg-gray-200 rounded"></div>
          </div>

          {/* Description Paragraphs */}
          <div className="space-y-2 pt-2">
            <div className="h-3.5 w-full bg-gray-200 rounded"></div>
            <div className="h-3.5 w-5/6 bg-gray-200 rounded"></div>
            <div className="h-3.5 w-4/6 bg-gray-200 rounded"></div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            <div className="h-12 w-full bg-gray-200 rounded-xl"></div>
            <div className="h-12 w-full bg-gray-200 rounded-xl"></div>
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            <div className="h-14 bg-gray-100 rounded-xl"></div>
            <div className="h-14 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Wishlist Page
 */
export const WishlistSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-3 w-12 bg-gray-200 rounded"></div>
        <div className="h-3 w-3 bg-gray-200 rounded-full"></div>
        <div className="h-3 w-20 bg-gray-200 rounded"></div>
      </div>

      {/* Heading */}
      <div className="pb-6 mb-6 border-b border-gray-100 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-7 w-36 bg-gray-200 rounded-md"></div>
          <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-4 w-80 max-w-full bg-gray-200 rounded"></div>
      </div>

      {/* Grid of Wishlist Item Skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="flex flex-col gap-2.5">
            <div className="relative aspect-square bg-gray-200 rounded-xl sm:rounded-2xl overflow-hidden">
              <div className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/70 rounded-full"></div>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="h-2.5 w-16 bg-gray-200 rounded-full"></div>
              <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
              <div className="h-3.5 w-20 bg-gray-200 rounded mt-1"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Order History Page
 */
export const OrderHistorySkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-4 animate-pulse">
      {/* Filters Bar Placeholder */}
      <div className="flex items-center gap-2 pb-4 mb-2 border-b border-gray-100">
        <div className="h-8 w-20 bg-gray-200 rounded-full"></div>
        <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
        <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
      </div>

      {/* List of Order Skeleton Items */}
      <div className="w-full divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, idx) => (
          <div 
            key={idx} 
            className="py-5 first:pt-3 last:pb-1 space-y-4"
          >
            {/* Top Bar: Order ID & Status Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
              <div className="h-6 w-24 bg-gray-200 rounded-md"></div>
            </div>

            {/* Item Details */}
            <div className="flex gap-4 items-start py-1">
              <div className="w-[76px] h-[76px] bg-gray-200 rounded-sm shrink-0"></div>
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                <div className="h-3 w-1/3 bg-gray-200 rounded"></div>
                <div className="h-3 w-28 bg-gray-200 rounded"></div>
              </div>
            </div>

            {/* Bottom Price Details breakdown */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-5 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Cart Page
 */
export const CartSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 lg:px-12 py-6 animate-pulse">
      {/* Address skeleton bar */}
      <div className="pb-4 mb-4 border-b border-gray-100 flex justify-between items-start">
        <div className="space-y-1.5 w-3/4">
          <div className="h-3 w-20 bg-gray-200 rounded"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
          <div className="h-3 w-64 bg-gray-200 rounded"></div>
        </div>
        <div className="h-7 w-16 bg-gray-200 rounded"></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex-1 w-full divide-y divide-gray-100">
          {[1, 2].map(i => (
            <div key={i} className="py-4 first:pt-0 last:pb-0 flex gap-4">
              <div className="w-[84px] h-[84px] bg-gray-200 rounded-sm shrink-0"></div>
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="h-5 bg-gray-200 rounded w-1/4 mt-2"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l lg:border-gray-100 pt-6 lg:pt-0 lg:pl-8">
          <div className="h-5 w-28 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded mt-4"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
