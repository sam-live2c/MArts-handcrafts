import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  User as UserIcon,
  ShoppingCart,
  ArrowLeft,
  Search,
  X,
  ChevronRight,
  Heart
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User, Product } from "../types";
import Logo from "./Logo";
import { handleGoBack } from "../utils/navigation";
import { useScrollDirection } from "../hooks/useScrollDirection";

interface HeaderProps {
  cartCount: number;
  user: User | null;
  onLogout?: () => void;
  title?: string;
  showBack?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  wishlistCount?: number;
  showSearch?: boolean;
  showWishlist?: boolean;
  products?: Product[];
}

const Header: React.FC<HeaderProps> = ({
  user,
  cartCount,
  title,
  showBack,
  searchQuery = "",
  onSearchChange,
  wishlistCount,
  showSearch = true,
  showWishlist = true,
  products
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isVisible } = useScrollDirection();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const headerRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  const liveCatalog = useMemo(() => {
    if (products && products.length > 0) return products;
    try {
      const cached = localStorage.getItem('marts_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }, [products]);

  // Sync external query prop
  useEffect(() => {
    setInternalQuery(searchQuery);
  }, [searchQuery]);

  // Compute live search suggestions
  useEffect(() => {
    const q = internalQuery.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const filtered = liveCatalog.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const sub = (p.subCategory || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || sub.includes(q) || desc.includes(q);
    }).sort((a, b) => {
      const aStarts = (a.name || '').toLowerCase().startsWith(q);
      const bStarts = (b.name || '').toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });

    setSuggestions(filtered.slice(0, 5));
    setShowDropdown(filtered.length > 0);
  }, [internalQuery, liveCatalog]);

  // Auto-focus mobile search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Close search and dropdown on route change
  useEffect(() => {
    setShowDropdown(false);
    setIsSearchOpen(false);
  }, [location.pathname]);

  // Click outside closes the suggestions dropdown, but search remains active
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInput =
        mobileSearchInputRef.current?.contains(target) ||
        desktopSearchInputRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedInput && !clickedDropdown) {
        setShowDropdown(false);
        // Note: Search remains active, isSearchOpen is not closed
      }
    };

    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDownGlobal);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDownGlobal);
    };
  }, []);

  const handleBack = () => {
    handleGoBack(navigate, '/');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalQuery(val);
    if (onSearchChange) {
      onSearchChange(val);
    } else if (location.pathname !== '/' && location.pathname !== '/products' && val.trim().length > 0) {
      // If current page doesn't have custom search handler and isn't products page, route to /products
      navigate('/products', { state: { initialSearch: val } });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setShowDropdown(false);
      (e.target as HTMLInputElement).blur();
      const val = internalQuery.trim();
      if (!onSearchChange && location.pathname !== '/' && location.pathname !== '/products' && val.length > 0) {
        navigate('/products', { state: { initialSearch: val } });
      }
    }
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setShowDropdown(false);
    setInternalQuery("");
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  const handleClearQuery = () => {
    setInternalQuery("");
    if (onSearchChange) {
      onSearchChange("");
    }
    setShowDropdown(false);
    mobileSearchInputRef.current?.focus();
    desktopSearchInputRef.current?.focus();
  };

  const handleSelectProduct = (productId: string) => {
    setShowDropdown(false);
    setIsSearchOpen(false);
    navigate(`/product/${productId}`);
  };

  return (
    <header
      ref={headerRef}
      className={`w-full bg-[#FAF8F5] border-b border-[#EADBCC]/60 sticky top-0 z-50 shadow-2xs transition-transform duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "max-md:-translate-y-full"
      }`}
    >
      <div className="w-full px-4 sm:px-8 lg:px-12 py-2.5 sm:py-3 min-h-[56px] sm:min-h-[62px] relative max-w-7xl mx-auto flex items-center">
        {/* Mobile & Tablet Full-Header Search Mode (No container or background) */}
        {isSearchOpen ? (
          <div className="w-full flex items-center gap-2 sm:gap-3 lg:hidden animate-in fade-in duration-150">
            {/* Back Arrow button to dismiss search */}
            <button
              type="button"
              onClick={handleCloseSearch}
              className="p-1.5 -ml-1 text-[#4E392D] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer active:scale-95 shrink-0"
              aria-label="Back to normal header"
              title="Close search"
            >
              <ArrowLeft size={21} />
            </button>

            {/* Containerless, backgroundless full-width search input */}
            <div className="flex-1 flex items-center min-w-0">
              <Search
                size={18}
                className="text-[#8C6D58] shrink-0 mr-2 sm:mr-2.5 pointer-events-none"
              />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={internalQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onClick={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder="Search handcrafted pottery, statues, brass..."
                className="w-full bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:outline-none p-0 text-[#2B221B] placeholder-[#8C6D58]/70 text-sm sm:text-base font-medium shadow-none selection:bg-[#EBDCCB]"
              />
            </div>

            {/* Clear button if text typed */}
            {internalQuery && (
              <button
                type="button"
                onClick={handleClearQuery}
                className="p-1 text-[#8C6D58] hover:text-[#2B221B] rounded-full cursor-pointer shrink-0"
                aria-label="Clear search input"
              >
                <X size={18} />
              </button>
            )}

            {/* Cancel text action */}
            <button
              type="button"
              onClick={handleCloseSearch}
              className="text-xs sm:text-sm font-semibold text-[#8C6D58] hover:text-[#C85A32] px-2 py-1 transition-colors cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {/* Regular Header Elements (Always on desktop; on mobile/tablets visible when search is not open) */}
        <div
          className={`w-full items-center justify-between ${
            isSearchOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Left: Branding or Title/Back Button */}
          <div className="flex items-center gap-3 shrink-0">
            {showBack && (
              <button
                onClick={handleBack}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-[#F2EAE2] rounded-full text-[#4E392D] transition-colors cursor-pointer shrink-0 active:scale-95"
                aria-label="Go Back"
              >
                <ArrowLeft size={22} />
              </button>
            )}

            {title ? (
              <h1 className="text-[17px] font-bold text-[#2B221B] tracking-tight">{title}</h1>
            ) : (
              <Link
                to="/"
                className="flex items-center transition-transform active:scale-98"
                aria-label="MArts Home"
              >
                <Logo variant="dark" size="sm" showStoreTag={false} />
              </Link>
            )}
          </div>

          {/* Desktop Center Search Bar */}
          {showSearch && (
            <div className="hidden lg:flex flex-1 max-w-md mx-6 transition-all duration-200 relative">
              <div className="w-full relative flex items-center">
                <Search
                  size={17}
                  className="absolute left-3.5 text-[#8C6D58] pointer-events-none shrink-0"
                />
                <input
                  ref={desktopSearchInputRef}
                  type="text"
                  value={internalQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onClick={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                  }}
                  placeholder="Search handcrafted pottery, statues..."
                  className="w-full pl-9 pr-9 py-2 bg-white/90 hover:bg-white focus:bg-white rounded-full text-xs sm:text-sm text-[#2B221B] placeholder-[#8C6D58] border border-[#E5D7CA] focus:border-[#C85A32] focus:ring-1 focus:ring-[#C85A32]/30 outline-none transition-all shadow-2xs"
                />
                {internalQuery && (
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="absolute right-3 text-[#8C6D58] hover:text-[#2B221B] p-0.5 rounded-full cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right Corner: Search Toggle (Mobile/Tablet), Wishlist, Cart, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-[#5F6368] shrink-0">
            {/* Mobile & Tablet Search Icon Toggle Button */}
            {showSearch && (
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(true);
                }}
                className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer active:scale-95 shrink-0"
                aria-label="Search Store"
                title="Search Store"
              >
                <Search size={20} />
              </button>
            )}

            {/* Wishlist Option */}
            {showWishlist && location.pathname !== "/wishlist" && (
              <Link
                to="/wishlist"
                className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer active:scale-95 shrink-0"
                aria-label="Wishlist"
                title="Saved Pieces"
              >
                <Heart
                  size={20}
                  className={wishlistCount !== undefined && wishlistCount > 0 ? "text-[#C85A32] fill-[#C85A32]/10" : ""}
                />
                {wishlistCount !== undefined && wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#C85A32] text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none shadow-xs border-2 border-[#FAF8F5]">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Cart Option */}
            <Link
              to="/cart"
              className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer active:scale-95 shrink-0"
              aria-label="Shopping Cart"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#C85A32] text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none shadow-xs border-2 border-[#FAF8F5]">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Profile Option */}
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  navigate("/login?redirect=account");
                } else {
                  navigate("/account");
                }
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E5D7CA] hover:border-[#C85A32] hover:bg-[#F2EAE2] bg-transparent flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] shrink-0 active:scale-95 transition-all cursor-pointer overflow-hidden"
              aria-label="User Profile"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <UserIcon size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Live Search Suggestions Dropdown Menu (No header label, no separation lines between suggestions) */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-4 right-4 sm:left-8 sm:right-8 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-md mt-1.5 bg-white rounded-2xl border border-[#EADBCC] shadow-xl p-1.5 overflow-hidden z-[100] animate-in fade-in duration-150"
          >
            <div className="max-h-[340px] overflow-y-auto space-y-0.5">
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectProduct(item.id)}
                  className="p-2.5 sm:p-3 hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer flex items-center gap-3 group"
                >
                  <div className="w-11 h-11 rounded-lg bg-[#FAF6F0] overflow-hidden shrink-0 border border-[#E5D7CA]">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#2B221B] truncate group-hover:text-[#C85A32] transition-colors">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium text-[#8C6D58] bg-[#F2E8E1] px-1.5 py-0.2 rounded">
                        {item.subCategory}
                      </span>
                      <span className="text-xs font-bold text-[#2B221B]">
                        ₹{item.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#A89283] group-hover:text-[#C85A32] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
