import React from 'react';

/**
 * Skeleton component for individual Product Card in product listings
 */
export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-xs flex flex-col gap-3 animate-pulse">
      {/* Product Image Placeholder */}
      <div className="w-full aspect-[4/3] bg-gray-200 rounded-lg shrink-0"></div>
      
      {/* Title & Category Line */}
      <div className="flex flex-col gap-1.5">
        <div className="h-2.5 w-1/3 bg-gray-200 rounded-full"></div>
        <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
        <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
      </div>

      {/* Rating & Price */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-auto">
        <div className="flex flex-col gap-1">
          <div className="h-3 w-12 bg-gray-200 rounded"></div>
          <div className="h-5 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 w-8 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );
};

/**
 * Skeleton UI for Product Listing Grid / Category list
 */
export const ProductListingSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4">
      {/* Search / Filter Header Placeholder */}
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 rounded-md"></div>
        <div className="h-9 w-28 bg-gray-200 rounded-lg"></div>
      </div>

      {/* Grid of Product Skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <ProductCardSkeleton key={idx} />
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
    <div className="w-full divide-y divide-gray-100">
      {/* List of Order Skeleton Items */}
      {Array.from({ length: count }).map((_, idx) => (
        <div 
          key={idx} 
          className="py-5 first:pt-1 last:pb-1 space-y-4 animate-pulse"
        >
          {/* Top Bar: Order ID & Status Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-24 bg-gray-200 rounded"></div>
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
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
  );
};
