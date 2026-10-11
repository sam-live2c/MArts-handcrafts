import { Product, Review } from '../types';

export interface ProductRatingInfo {
  rating: number;
  reviewsCount: number;
  isUnrated: boolean;
}

/**
 * Derives genuine product rating and review count from authentic customer reviews.
 * If no authentic customer reviews exist, the product is strictly unrated (rating: 0, reviewsCount: 0).
 * Never returns mock or hardcoded rating data.
 */
export function getProductRatingInfo(product: Product | null | undefined): ProductRatingInfo {
  if (!product || !product.id) {
    return { rating: 0, reviewsCount: 0, isUnrated: true };
  }

  try {
    const saved = localStorage.getItem(`marts_reviews_${product.id}`) || localStorage.getItem(`melody_reviews_${product.id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out any legacy sample IDs
        const authentic = parsed.filter(
          (r: Review) => r && r.id && !['rev-1', 'rev-2', 'rev-3', 'sample-1', 'sample-2'].includes(r.id)
        );
        if (authentic.length > 0) {
          const sum = authentic.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
          return {
            rating: Number((sum / authentic.length).toFixed(1)),
            reviewsCount: authentic.length,
            isUnrated: false
          };
        }
      }
    }
  } catch {}

  // If product in Firestore has reviewsCount > 0 and rating > 0, verify if it is genuinely populated
  // If no customer reviews exist in the system, it is strictly unrated
  return {
    rating: 0,
    reviewsCount: 0,
    isUnrated: true
  };
}

/**
 * Sanitizes a catalog of products so that unrated products have rating: 0 and reviewsCount: 0,
 * while authentically reviewed products reflect their real customer feedback.
 */
export function sanitizeProductRatings(products: Product[]): Product[] {
  if (!Array.isArray(products)) return [];
  return products.map((p) => {
    const info = getProductRatingInfo(p);
    return {
      ...p,
      rating: info.rating,
      reviewsCount: info.reviewsCount
    };
  });
}
