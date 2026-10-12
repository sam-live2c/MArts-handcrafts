import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  X,
  ShoppingCart,
  Star,
  Plus,
  Minus,
  Check,
  CreditCard,
  Zap,
  ChevronDown,
  HelpCircle,
  ArrowLeft,
  Share2,
  ThumbsUp,
  MessageSquare,
  Send,
  UserCheck,
  Lock,
  ShieldCheck,
  ShoppingBag,
  AlertCircle,
  Filter,
  Heart
} from "lucide-react";
import { CartItem, User, Review, Order, Product } from "../types";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { fetchUserOrders } from "../services/dbService";
import Logo from "../components/Logo";
import { RunningTruckIcon } from "../components/RunningTruckIcon";
import { ProductDetailSkeleton } from "../components/Skeleton";
import { safeStorage } from "../utils/storage";

interface ProductDetailProps {
  onAddToCart: (item: CartItem, silent?: boolean) => void;
  wishlist: string[];
  onToggleWishlist: (id: string) => void;
  user?: User | null;
  cartCount?: number;
  products?: Product[];
  cart?: CartItem[];
  onUpdateCartQuantity?: (productId: string, quantity: number) => void;
}


// In-memory cache for visited product details
const visitedProductsCache = new Set<string>();

const ProductDetail: React.FC<ProductDetailProps> = ({
  onAddToCart,
  wishlist,
  onToggleWishlist,
  user,
  cartCount = 0,
  products,
  cart = [],
  onUpdateCartQuantity,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [remoteProduct, setRemoteProduct] = useState<Product | null>(null);

  const product = useMemo(() => {
    if (remoteProduct && remoteProduct.id === id) return remoteProduct;
    if (products && products.length > 0) {
      const found = products.find((p) => p.id === id);
      if (found) return found;
    }
    try {
      const cached = localStorage.getItem('marts_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const found = parsed.find((p: Product) => p.id === id);
          if (found) return found;
        }
      }
    } catch {}
    return null;
  }, [remoteProduct, products, id]);

  const [isLoading, setIsLoading] = useState(() => (id ? !visitedProductsCache.has(id) : false));

  // Asynchronously fetch product directly from Firestore if not found in local catalog
  useEffect(() => {
    if (!id) return;
    const existsLocally = Boolean(products && products.some((p) => p.id === id));
    if (!existsLocally) {
      getDoc(doc(db, 'products', id))
        .then((snap) => {
          if (snap.exists()) {
            setRemoteProduct(snap.data() as Product);
          }
        })
        .catch((err) => {
          console.warn('Direct product fetch notice:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [id, products]);

  useEffect(() => {
    if (id && !visitedProductsCache.has(id)) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        visitedProductsCache.add(id);
        setIsLoading(false);
      }, 180);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [id]);

  const [selectedImg, setSelectedImg] = useState(0);
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "reviews">("details");
  const [copiedLink, setCopiedLink] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Reviews state with persistence - genuine customer reviews only, no mock data
  const [reviews, setReviews] = useState<Review[]>(() => {
    if (!id) return [];
    try {
      const saved = localStorage.getItem(`marts_reviews_${id}`) || localStorage.getItem(`melody_reviews_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: Review) => r.id && !['rev-1', 'rev-2', 'rev-3'].includes(r.id));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Keep reviews updated when viewing different products
  useEffect(() => {
    if (!id) {
      setReviews([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`marts_reviews_${id}`) || localStorage.getItem(`melody_reviews_${id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setReviews(parsed.filter((r: Review) => r.id && !['rev-1', 'rev-2', 'rev-3'].includes(r.id)));
          return;
        }
      }
    } catch {}
    setReviews([]);
  }, [id]);

  const [authorName, setAuthorName] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "helpful">("newest");

  const wordCount = useMemo(() => {
    const trimmed = newComment.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }, [newComment]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const words = val.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 500) {
      setNewComment(val);
    } else {
      const allowedWords = words.slice(0, 500).join(" ");
      setNewComment(allowedWords);
    }
  };

  const [liveOrders, setLiveOrders] = useState<Order[]>([]);

  // Fetch live orders for authenticated user to ensure fresh delivery status
  useEffect(() => {
    const uid = user?.id || (user as any)?.uid || auth.currentUser?.uid;
    const cleanEmail = (user?.email || auth.currentUser?.email || '').trim().toLowerCase();
    if (uid) {
      fetchUserOrders(uid, cleanEmail).then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setLiveOrders(res);
        }
      }).catch(() => {});
    }
  }, [user]);

  // Extract all user orders from user profile, live orders, and localStorage caches
  const userOrders: Order[] = useMemo(() => {
    const list: Order[] = [];
    if (user && Array.isArray(user.orders)) {
      list.push(...user.orders);
    }
    if (liveOrders.length > 0) {
      liveOrders.forEach((lo) => {
        const idx = list.findIndex((o) => o.id === lo.id);
        if (idx >= 0) {
          list[idx] = lo;
        } else {
          list.push(lo);
        }
      });
    }

    const uid = user?.id || (user as any)?.uid || auth.currentUser?.uid;
    const sources = [
      'marts_orders',
      'melody_orders',
      uid ? `marts_orders_${uid}` : null,
      uid ? `melody_orders_${uid}` : null,
      user?.email ? `marts_orders_${user.email}` : null,
      user?.email ? `melody_orders_${user.email}` : null,
      user?.phone ? `marts_orders_${user.phone}` : null,
      user?.phone ? `melody_orders_${user.phone}` : null,
    ].filter(Boolean) as string[];

    for (const key of sources) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            parsed.forEach((po: Order) => {
              if (po && po.id) {
                const idx = list.findIndex((o) => o.id === po.id);
                if (idx >= 0) {
                  if ((po.updatedAt || 0) > (list[idx].updatedAt || 0)) {
                    list[idx] = po;
                  }
                } else {
                  list.push(po);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Order read error:", err);
      }
    }
    return list;
  }, [user, liveOrders]);

  // Identify purchase: only users who purchased this specific product and whose delivery status is delivered can write reviews
  const matchingPurchase = useMemo(() => {
    return (
      userOrders.find(
        (order) =>
          Boolean(order?.id) &&
          (String(order.status || '').trim().toLowerCase() === 'delivered' ||
           String(order.tracking?.currentStatus || '').trim().toLowerCase() === 'delivered') &&
          Array.isArray(order.items) &&
          order.items.some(
            (item: any) =>
              product && String(item?.id || item?.productId || "").trim() === String(product.id).trim()
          )
      ) || null
    );
  }, [userOrders, product]);

  const hasPurchased = Boolean(matchingPurchase && matchingPurchase.id);

  useEffect(() => {
    if (!product?.id) return;
    try {
      localStorage.setItem(`marts_reviews_${product.id}`, JSON.stringify(reviews));
    } catch (e) {
      console.error(e);
    }
  }, [reviews, product?.id]);

  const ratingCounts = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.min(Math.max(Math.round(r.rating), 1), 5);
      counts[star] = (counts[star] || 0) + 1;
    });
    return counts;
  }, [reviews]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) {
      return "0.0";
    }
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const displayedReviews = useMemo(() => {
    let list = [...reviews];
    if (ratingFilter !== "all") {
      list = list.filter((r) => Math.round(r.rating) === ratingFilter);
    }
    if (sortBy === "highest") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "helpful") {
      list.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
    }
    return list;
  }, [reviews, ratingFilter, sortBy]);

  const handleSubmitReview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingReview(true);
    setTimeout(() => {
      const displayName = (authorName.trim() || user?.name || "Verified Customer").trim();
      const newRev: Review = {
        id: `rev-${Date.now()}`,
        productId: product.id,
        userName: displayName,
        rating: newRating,
        comment: newComment.trim(),
        date: "Just now",
        isVerified: true,
        orderId: matchingPurchase?.id,
        helpfulCount: 0,
      };
      const updatedReviews = [newRev, ...reviews];
      setReviews(updatedReviews);

      const calculatedAvg = Number((updatedReviews.reduce((acc, r) => acc + r.rating, 0) / updatedReviews.length).toFixed(1));
      try {
        updateDoc(doc(db, 'products', product.id), {
          rating: calculatedAvg,
          reviewsCount: updatedReviews.length,
          updatedAt: Date.now()
        }).catch(err => console.warn('Product rating update notice:', err));
      } catch (_) {}

      try {
        window.dispatchEvent(new Event('marts_reviews_updated'));
      } catch (_) {}

      setNewComment("");
      setAuthorName("");
      setSubmittingReview(false);
      setShowReviewModal(false);
      setReviewSuccessMsg("Thank you! Your verified purchaser review has been added.");
      setTimeout(() => setReviewSuccessMsg(""), 5000);
    }, 250);
  };

  const handleToggleHelpful = (reviewId: string) => {
    setHelpfulVotes((prev) => {
      const wasHelpful = prev[reviewId];
      setReviews((currentReviews) =>
        currentReviews.map((r) =>
          r.id === reviewId
            ? { ...r, helpfulCount: r.helpfulCount + (wasHelpful ? -1 : 1) }
            : r
        )
      );
      return { ...prev, [reviewId]: !wasHelpful };
    });
  };

  const faqs = [
    {
      question: "How are MArts pottery pieces and statues crafted?",
      answer: "Each creation is hand-thrown on the potter wheel or hand-chiseled from monolithic natural sandstone blocks by master generational artisans. Ceramic vessels are vitrified at 1,250°C Cone 10 for enduring structural strength."
    },
    {
      question: "How are heavy pottery and delicate statues protected during shipping?",
      answer: "We use heavy timber-crate packaging lined with high-density shock-absorbing honeycomb foam and multi-layer air cushioning. Every piece is 100% transit-insured from our atelier to your doorstep."
    },
    {
      question: "Are ceramic dinnerware and drinkware food-safe?",
      answer: "Yes, 100%. All tableware and drinkware utilize non-toxic, lead-free natural mineral glazes and are microwave, oven, and dishwasher safe."
    },
    {
      question: "How should I maintain and care for unglazed terracotta pottery?",
      answer: "Rinse unglazed terracotta with warm water and a soft natural coir brush. Avoid harsh chemical detergents as porous natural clay absorbs chemical residues. Allow it to sun-dry thoroughly."
    },
    {
      question: "What happens if an artisanal piece arrives damaged?",
      answer: "We provide a 30-day hassle-free replacement guarantee. If transit damage occurs, simply contact our support and an insured replacement is dispatched immediately at zero cost."
    }
  ];

  const displayImages =
    product && product.images && product.images.length > 0
      ? product.images
      : product?.image
      ? [product.image]
      : [];

  const isWishlisted = Boolean(product && wishlist.includes(product.id));

  // Touch swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || displayImages.length === 0) return;
    const distance = touchStart - touchEnd;
    if (distance > 35) {
      // Next image
      setSelectedImg((prev) => (prev + 1) % displayImages.length);
    } else if (distance < -35) {
      // Prev image
      setSelectedImg((prev) => (prev - 1 + displayImages.length) % displayImages.length);
    }
  };

  const inCartItem = useMemo(() => {
    if (!product) return null;
    if (cart && Array.isArray(cart)) {
      return cart.find((item) => item.id === product.id) || null;
    }
    try {
      const saved = localStorage.getItem('marts_cart') || localStorage.getItem('melody_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.find((item: CartItem) => item.id === product.id) || null;
        }
      }
    } catch {}
    return null;
  }, [product, cart]);

  const quantityInCart = inCartItem ? inCartItem.quantity : 0;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const handleDecreaseQty = () => {
    if (!product) return;
    if (quantityInCart > 1) {
      if (onUpdateCartQuantity) {
        onUpdateCartQuantity(product.id, quantityInCart - 1);
      }
    } else if (quantityInCart === 1) {
      if (onUpdateCartQuantity) {
        onUpdateCartQuantity(product.id, 0);
      }
    }
  };

  const handleIncreaseQty = () => {
    if (!product) return;
    if (quantityInCart === 0) {
      onAddToCart(
        {
          ...product,
          quantity: 1,
        },
        true
      );
    } else {
      if (onUpdateCartQuantity) {
        onUpdateCartQuantity(product.id, quantityInCart + 1);
      } else {
        onAddToCart(
          {
            ...product,
            quantity: 1,
          },
          true
        );
      }
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (quantityInCart === 0) {
      onAddToCart({
        ...product,
        quantity: 1,
      });
    } else {
      if (onUpdateCartQuantity) {
        onUpdateCartQuantity(product.id, quantityInCart + 1);
      } else {
        onAddToCart({
          ...product,
          quantity: 1,
        });
      }
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (quantityInCart === 0) {
      onAddToCart(
        {
          ...product,
          quantity: 1,
        },
        true
      );
    }

    if (!user) {
      navigate("/login?redirect=checkout");
      return;
    }
    navigate("/checkout");
  };

  const handleShare = () => {
    if (!product) return;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <div className="w-full min-h-screen bg-white font-sans text-[#1F1F1F] flex flex-col">
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-xs">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <Logo size="sm" />
          <Link
            to="/cart"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-800 relative"
            aria-label="Cart"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#C85A32] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-[#FAF0E6] text-[#C85A32] flex items-center justify-center mb-4">
            <ShoppingBag size={28} />
          </div>
          <h2 className="text-xl font-serif font-bold text-[#2B221B] mb-2">Piece Not Found</h2>
          <p className="text-xs sm:text-sm text-[#735A4C] mb-6">
            This handcrafted creation is no longer in our catalog. Explore our current collection of artisan pottery and sculptures.
          </p>
          <Link
            to="/products"
            className="px-6 py-2.5 bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors"
          >
            Browse All Creations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white font-sans selection:bg-purple-100 text-[#1F1F1F] flex flex-col">
      {/* Top Minimalist Bar: Edge-to-edge across devices with proper outer edge positioning */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between">
          {/* Back/Close Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 text-gray-800 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={22} strokeWidth={2} />
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-[#5F6368] shrink-0">
            {/* Share link button */}
            <button
              type="button"
              onClick={handleShare}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 active:scale-95 flex items-center justify-center text-gray-700 transition-colors cursor-pointer"
              aria-label="Share product"
              title="Share product"
            >
              <Share2 size={18} strokeWidth={2} />
              {copiedLink && (
                <span className="absolute -bottom-7 right-0 text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                  Link copied!
                </span>
              )}
            </button>

            {/* Wishlist toggle button */}
            <button
              type="button"
              onClick={() => onToggleWishlist(product.id)}
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 active:scale-95 flex items-center justify-center transition-colors cursor-pointer ${
                isWishlisted ? "text-[#C85A32]" : "text-gray-700 hover:text-[#C85A32]"
              }`}
              aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              title={isWishlisted ? "Saved to wishlist" : "Save to wishlist"}
            >
              <Heart size={19} strokeWidth={2} className={isWishlisted ? "fill-[#C85A32]" : ""} />
            </button>

            {/* Cart circular button with badge */}
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-gray-100 active:scale-95 flex items-center justify-center text-gray-700 transition-colors cursor-pointer"
              aria-label="Shopping Cart"
            >
              <ShoppingCart size={20} strokeWidth={2} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C85A32] text-white rounded-full text-[11px] font-bold flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Grid Body: 1 Column on Mobile, 2 Columns on Tablet & Desktop */}
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 items-start md:items-stretch">
            
          {/* Left Column: Product Gallery */}
          <div className="md:col-span-6 lg:col-span-6 p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start bg-white md:border-r border-gray-100 md:sticky md:top-16 self-start">
            <div
              className="relative w-full aspect-square max-w-[340px] md:max-w-[420px] lg:max-w-[460px] flex items-center justify-center select-none touch-pan-y group p-2"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={displayImages[selectedImg] || product.image}
                alt={product.name}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Pagination dots (o o • o) */}
            {displayImages.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {displayImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImg(idx)}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      idx === selectedImg
                        ? "w-2.5 h-2.5 bg-[#2E2E2E]"
                        : "w-2 h-2 bg-[#E5E7EB] hover:bg-gray-400"
                    }`}
                    aria-label={`Image slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Metadata, Pricing, Stepper & Purchase Flow */}
          <div className="md:col-span-6 lg:col-span-6 px-4 sm:px-6 lg:px-8 py-3 md:py-6 lg:py-8 flex flex-col justify-between bg-white">
            <div className="flex flex-col gap-3.5">
              {/* Eyebrow / Brand */}
              <div className="text-[#C85A32] font-bold text-xs uppercase tracking-wider">
                <span>{product.brand || "MArts"}</span>
              </div>

              {/* Product Title */}
              <h1 className="text-[19px] sm:text-[21px] lg:text-[24px] font-bold text-gray-900 leading-[1.3] tracking-tight -mt-1">
                {product.name}
              </h1>

              {/* Pricing & Unit Info */}
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-2xl lg:text-3xl font-black text-[#BA3D1D] tracking-tight">
                  ₹{product.price.toLocaleString()}
                </span>
                {product.oldPrice && (
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-xs text-gray-400 font-normal">M.R.P.:</span>
                    <del className="text-sm lg:text-base text-gray-400 font-normal" aria-label="Maximum retail price">
                      ₹{product.oldPrice.toLocaleString()}
                    </del>
                    {product.discount && (
                      <span className="text-xs lg:text-sm font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        {product.discount}
                      </span>
                    )}
                  </span>
                )}
                {product.subCategory && (
                  <span className="text-sm font-medium text-[#735A4C]">
                    {product.subCategory}
                  </span>
                )}
              </div>

              {/* Rating & Review count */}
              <div className="flex items-center gap-1.5 text-sm text-gray-800 -mt-0.5">
                {reviews.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("reviews");
                      const el = document.getElementById("reviews-tab-section");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="flex items-center gap-1.5 text-gray-800 hover:text-[#C85A32] transition-colors cursor-pointer group text-left"
                    aria-label={`View ${reviews.length} ratings and reviews`}
                  >
                    <span className="font-bold">{avgRating}</span>
                    <div className="flex text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={
                            s <= Math.round(Number(avgRating))
                              ? "fill-current text-amber-400"
                              : "text-gray-200"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-gray-600 group-hover:text-[#C85A32] group-hover:underline text-xs ml-0.5 font-medium">
                      ({reviews.length} {reviews.length === 1 ? "rating" : "ratings"})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("reviews");
                      const el = document.getElementById("reviews-tab-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex items-center gap-1.5 text-xs text-[#8C6D58] hover:text-[#C85A32] transition-colors cursor-pointer"
                  >
                    <div className="flex text-gray-300">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={13} className="text-gray-300" />
                      ))}
                    </div>
                    <span className="font-medium">No reviews yet • Be the first to review</span>
                  </button>
                )}
              </div>

              {/* Delivery & Artisan Branding Card */}
              <div className="rounded-2xl border border-gray-200/90 p-3.5 sm:p-4 flex flex-col gap-3">
                {/* Delivery Information */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 flex items-center justify-center shrink-0 mt-0.5"
                    title="Express Delivery"
                  >
                    <RunningTruckIcon size={21} className="text-gray-900" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-gray-900 tracking-tight">
                        Free delivery across India
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 font-normal mt-0.5 leading-relaxed">
                      Dispatches within 24 hours • Expected delivery in 2–4 business days
                    </p>
                  </div>
                </div>

                {/* Subtle Divider */}
                <div className="h-px bg-gray-200/80 w-full" />

                {/* Brand Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* MArts Store Branding without Studio Tag */}
                  <div className="flex items-center gap-1.5">
                    <Logo variant="dark" size="sm" showStoreTag={false} />
                  </div>
                </div>
              </div>

              {/* Quantity Stepper synced with Cart - No border */}
              <div className="mt-1 w-full bg-[#FAF5EE] text-[#2B221B] h-[48px] rounded-xl px-2.5 flex items-center justify-between border-0 shadow-2xs">
                <button
                  type="button"
                  onClick={handleDecreaseQty}
                  disabled={quantityInCart <= 0}
                  className={`w-8 h-8 rounded-lg bg-white text-[#2B221B] flex items-center justify-center transition-all cursor-pointer shadow-2xs border-0 ${
                    quantityInCart <= 0 ? "opacity-35 cursor-not-allowed" : "active:scale-90 hover:bg-[#FAF0E6]"
                  }`}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} strokeWidth={2.5} />
                </button>

                <span className="font-bold text-sm text-[#2B221B] tracking-wide select-none">
                  {quantityInCart} in cart
                </span>

                <button
                  type="button"
                  onClick={handleIncreaseQty}
                  className="w-8 h-8 rounded-lg bg-white text-[#2B221B] flex items-center justify-center active:scale-90 hover:bg-[#FAF0E6] transition-transform cursor-pointer shadow-2xs border-0"
                  aria-label="Increase quantity"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Instant High-Conversion CTAs (Desktop / Tablet: Inline; Mobile: Fixed Bottom Bar) - Aligned down with carousel dots */}
            <div className="mt-5 md:mt-auto pt-2 hidden sm:flex flex-row gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-900 font-bold text-[15px] sm:text-[16px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <ShoppingCart size={18} />
                <span>Add to Cart</span>
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                className="flex-1 h-12 bg-[#C85A32] hover:bg-[#A04724] active:scale-98 text-white font-bold text-[15px] sm:text-[16px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag size={18} />
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabbed Info Section (Details | Specifications | Reviews) */}
        <div id="reviews-tab-section" className="border-t border-gray-100 bg-white pb-28 sm:pb-16">
          {/* Tab Headers: Straight up left-aligned with other options starting */}
          <div className="flex items-center justify-start gap-6 sm:gap-8 lg:gap-10 border-b border-gray-200 px-5 sm:px-6 lg:px-10 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`py-3.5 text-left text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "details"
                  ? "text-gray-900 border-b-[2.5px] border-[#C85A32]"
                  : "text-gray-500 hover:text-gray-800 border-b-[2.5px] border-transparent"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={`py-3.5 text-left text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "specs"
                  ? "text-gray-900 border-b-[2.5px] border-[#C85A32]"
                  : "text-gray-500 hover:text-gray-800 border-b-[2.5px] border-transparent"
              }`}
            >
              Specifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={`py-3.5 text-left text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "reviews"
                  ? "text-gray-900 border-b-[2.5px] border-[#C85A32]"
                  : "text-gray-500 hover:text-gray-800 border-b-[2.5px] border-transparent"
              }`}
            >
              <span>Reviews</span>
              <span className="text-[#C85A32] text-xs font-extrabold">
                ({reviews.length})
              </span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 sm:p-6 lg:p-10">
            {activeTab === "details" && (
              <div className="space-y-6 text-[13.5px] md:text-[14.5px] leading-relaxed text-gray-700 w-full">
                <p>
                  Handcrafted with generational skill by master heritage artisans, each {product.name.toLowerCase()} is individually wheel-thrown, sculpted, and fired using traditional techniques. Finished with natural organic patinas and mineral glazes, it brings timeless artistic elegance and cultural heritage to your living spaces, temples, gardens, or collector galleries.
                </p>

                {/* Highlights grid */}
                <div className="pt-2 bg-transparent border-0 outline-none">
                  <h4 className="font-bold text-gray-900 text-sm mb-3">Highlights</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {product.highlights.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 py-2 px-0 bg-transparent rounded-none border-0">
                        <Check size={16} className="text-[#C85A32] shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-xs sm:text-sm font-medium text-gray-800">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "specs" && (
              <div className="space-y-6 max-w-4xl text-xs sm:text-sm">
                {product.specGroups && product.specGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {product.specGroups.map((group, idx) => (
                      <div key={idx} className="space-y-2 bg-transparent rounded-none p-0 border-0">
                        <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                          {group.title}
                        </h4>
                        <div className="divide-y divide-gray-200">
                          {Object.entries(group.specs).map(([k, v], i) => (
                            <div key={i} className="py-2.5 flex justify-between gap-4">
                              <span className="text-gray-500 font-medium">{k}</span>
                              <span className="text-gray-900 font-bold text-right">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-transparent rounded-none p-0 border-0 space-y-2 text-xs sm:text-sm max-w-lg">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Brand</span>
                      <span className="font-bold text-gray-900">MArts</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Craftsmanship</span>
                      <span className="font-bold text-gray-900">Generational Handcrafted</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-500">Material</span>
                      <span className="font-bold text-gray-900">{product.category || "Alluvial Clay & Natural Minerals"}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Origin</span>
                      <span className="font-bold text-gray-900">Indian Artisan Guilds</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-5 max-w-4xl">
                {/* Rating & Review Summary Banner */}
                <div className="bg-transparent rounded-none p-0 border-0 grid grid-cols-1 md:grid-cols-3 gap-6 items-center pb-5 border-b border-gray-100">
                  <div className="text-center md:text-left space-y-2 md:border-r border-gray-200 pr-0 md:pr-6">
                    {reviews.length > 0 ? (
                      <>
                        <div className="flex items-baseline justify-center md:justify-start gap-2">
                          <span className="text-4xl font-extrabold text-gray-900">{avgRating}</span>
                          <span className="text-sm font-semibold text-gray-500">out of 5</span>
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-1 text-amber-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={18}
                              className={
                                star <= Math.round(Number(avgRating))
                                  ? "fill-current text-amber-400"
                                  : "text-gray-200"
                              }
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 font-medium">
                          Based on {reviews.length} authentic customer reviews
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-[#8C6D58]">
                          Unrated
                        </div>
                        <p className="text-xs text-gray-600 font-medium pt-1">
                          No customer reviews yet. Be the first to share your experience with this piece!
                        </p>
                      </>
                    )}
                  </div>

                  {/* Rating Breakdown Bars */}
                  <div className="space-y-2 md:col-span-2 text-xs">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = ratingCounts[stars] || 0;
                      const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                      const isSelected = ratingFilter === stars;
                      return (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => setRatingFilter(isSelected ? "all" : stars)}
                          className={`w-full flex items-center gap-3 p-1 rounded-lg transition-colors cursor-pointer text-left ${
                            isSelected ? "bg-[#FAF0E6]" : "hover:bg-gray-100/70"
                          }`}
                        >
                          <span className={`w-14 font-bold text-right ${isSelected ? "text-[#C85A32]" : "text-gray-700"}`}>
                            {stars} {stars === 1 ? "Star" : "Stars"}
                          </span>
                          <div className="flex-1 bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#C85A32] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-12 text-gray-500 text-right font-medium">
                            {count} ({pct}%)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                      <Filter size={13} /> Filter:
                    </span>
                    <button
                      type="button"
                      onClick={() => setRatingFilter("all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        ratingFilter === "all"
                          ? "bg-gray-900 text-white shadow-xs"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All ({reviews.length})
                    </button>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingFilter(ratingFilter === star ? "all" : star)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          ratingFilter === star
                            ? "bg-[#C85A32] text-white shadow-xs"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        <span>{star}</span>
                        <Star size={11} className="fill-current" />
                        <span>({ratingCounts[star] || 0})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review Submission Section: only available when confirmed order id present is true */}
                {hasPurchased && (
                  <div id="verified-purchaser-review-section" className="space-y-2.5 pb-4 border-b border-gray-100">
                    {/* 5-Star section on top of input: stars without background, without border */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">Rating:</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const isSelected = star <= (hoverRating || newRating);
                            return (
                              <button
                                key={star}
                                type="button"
                                id={`verified-rating-star-${star}`}
                                onClick={() => setNewRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                className="p-0.5 transition-transform hover:scale-115 cursor-pointer bg-transparent border-0 focus:outline-none"
                                title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                              >
                                <Star
                                  size={18}
                                  className={`transition-colors ${
                                    isSelected
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-gray-300 fill-none hover:text-amber-300"
                                  }`}
                                />
                              </button>
                            );
                          })}
                          <span className="text-xs font-semibold text-gray-600 ml-1">
                            {hoverRating || newRating} / 5 Stars
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-gray-400 shrink-0">
                        {wordCount} / 500 words
                      </span>
                    </div>

                    {/* Single-line comment input section (not a box, single line with icon button) */}
                    <div className="flex items-center gap-2 border-b border-gray-300 focus-within:border-[#C85A32] transition-colors pb-1">
                      <input
                        type="text"
                        id="verified-comment-input"
                        value={newComment}
                        maxLength={3000}
                        onChange={handleCommentChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newComment.trim() && !submittingReview) {
                            e.preventDefault();
                            handleSubmitReview();
                          }
                        }}
                        placeholder="Write your review in a single line (up to 500 words)..."
                        className="flex-1 text-xs sm:text-sm py-2 px-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-gray-900 placeholder:text-gray-400"
                      />
                      {newComment.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewComment("")}
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer shrink-0"
                          aria-label="Clear review"
                          title="Clear"
                        >
                          <X size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        id="submit-verified-review-btn"
                        onClick={() => handleSubmitReview()}
                        disabled={submittingReview || !newComment.trim()}
                        title="Post Review"
                        aria-label="Post Review"
                        className="w-8 h-8 flex items-center justify-center rounded-full text-[#C85A32] hover:bg-[#FAF0E6] active:bg-[#F2E4D8] disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                      >
                        <Send size={16} />
                      </button>
                    </div>

                    {/* Review submission success message: without background and outline container */}
                    {reviewSuccessMsg && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 pt-1 transition-all">
                        <Check size={15} className="text-emerald-600 shrink-0" />
                        <span>{reviewSuccessMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback Review submission success message if not in hasPurchased container */}
                {!hasPurchased && reviewSuccessMsg && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 py-1 transition-all">
                    <Check size={15} className="text-emerald-600 shrink-0" />
                    <span>{reviewSuccessMsg}</span>
                  </div>
                )}

                {/* Customer Reviews Feed */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="font-bold text-gray-900 text-sm">
                      Customer Reviews ({displayedReviews.length})
                    </h4>
                    {ratingFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setRatingFilter("all")}
                        className="text-xs font-semibold text-[#C85A32] hover:underline cursor-pointer"
                      >
                        Clear {ratingFilter}-star filter
                      </button>
                    )}
                  </div>

                  {displayedReviews.length === 0 ? (
                    <div className="text-center py-8 bg-transparent border-0 space-y-2 px-4">
                      <MessageSquare size={26} className="mx-auto text-[#C85A32]" />
                      <p className="text-sm font-bold text-[#2B221B]">
                        {reviews.length === 0 ? "No customer reviews yet" : "No reviews found for this filter"}
                      </p>
                      <p className="text-xs text-[#735A4C] max-w-sm mx-auto">
                        {reviews.length === 0
                          ? "Be the first to share your feedback and help others discover this authentic handcrafted piece."
                          : "Try selecting a different star rating or view all reviews."}
                      </p>
                      {reviews.length > 0 && ratingFilter !== "all" && (
                        <button
                          type="button"
                          onClick={() => setRatingFilter("all")}
                          className="mt-2 px-4 py-1.5 bg-transparent border border-[#C5B3A1] hover:border-gray-400 text-[#2B221B] text-xs font-bold rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          Show All Reviews
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 space-y-4">
                      {displayedReviews.map((rev) => (
                        <div key={rev.id} className="pt-4 first:pt-0 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {/* User Avatar */}
                              <div className="w-9 h-9 rounded-full bg-[#FAF0E6] text-[#C85A32] font-bold text-xs flex items-center justify-center shrink-0">
                                {rev.userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-sm">{rev.userName}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <div className="flex items-center text-amber-400">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        size={12}
                                        className={
                                          s <= rev.rating
                                            ? "fill-current text-amber-400"
                                            : "text-gray-200"
                                        }
                                      />
                                    ))}
                                  </div>
                                  <span className="text-[11px] text-gray-400 font-medium">• {rev.date}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Comment text */}
                          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium pl-12">
                            {rev.comment}
                          </p>

                          {/* Helpful button */}
                          <div className="pl-12 flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleToggleHelpful(rev.id)}
                              className={`flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg border transition-colors cursor-pointer bg-transparent hover:bg-transparent active:bg-transparent outline-none focus:outline-none focus:ring-0 select-none ${
                                helpfulVotes[rev.id]
                                  ? "text-[#C85A32] border-[#C85A32] bg-[#FAF0E6]"
                                  : "text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800"
                              }`}
                            >
                              <ThumbsUp
                                size={13}
                                className={helpfulVotes[rev.id] ? "fill-[#C85A32]" : ""}
                              />
                              <span>Helpful ({rev.helpfulCount})</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Native-App Fixed Bottom Action Bar (Mobile Only) */}
      <div 
        id="mobile-bottom-action-bar"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-3 w-full max-w-md mx-auto">
          <button
            type="button"
            id="mobile-add-to-cart-btn"
            onClick={handleAddToCart}
            className="flex-1 h-12 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-900 font-bold text-[15px] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-gray-200/80 shadow-2xs"
            aria-label="Add to cart"
          >
            <ShoppingCart size={18} />
            <span>Add to Cart</span>
          </button>
          <button
            type="button"
            id="mobile-buy-now-btn"
            onClick={handleBuyNow}
            className="flex-1 h-12 bg-[#C85A32] hover:bg-[#A04724] active:scale-98 text-white font-bold text-[15px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            aria-label="Buy now"
          >
            <ShoppingBag size={18} />
            <span>Buy Now</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default ProductDetail;
