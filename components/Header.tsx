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

interface HeaderProps {
  cartCount: number;
  user: User | null;
  onLogout?: () => void;
  title?: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
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
  backPath,
  onBack,
  searchQuery = "",
  onSearchChange,
  wishlistCount,
  showSearch = true,
  showWishlist = true,
  products
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  
  const headerRef = useRef<HTMLElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  // Sync external query prop
  useEffect(() => {
    setInternalQuery(searchQuery);
  }, [searchQuery]);

  // Auto-focus mobile search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Close search on route change
  useEffect(() => {
    setIsSearchOpen(false);
  }, [location.pathname]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      handleGoBack(navigate, backPath || '/');
    }
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
      (e.target as HTMLInputElement).blur();
      const val = internalQuery.trim();
      if (!onSearchChange && location.pathname !== '/' && location.pathname !== '/products' && val.length > 0) {
        navigate('/products', { state: { initialSearch: val } });
      }
    }
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
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
    mobileSearchInputRef.current?.focus();
    desktopSearchInputRef.current?.focus();
  };

  return (
    <header
      ref={headerRef}
      className="w-full bg-[#FAF8F5] border-b border-[#EADBCC]/60 sticky top-0 z-50 shadow-2xs"
    >
      <div className="w-full px-3 sm:px-6 lg:px-12 py-2.5 sm:py-3 min-h-[56px] sm:min-h-[62px] relative max-w-7xl mx-auto flex items-center">
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
                className="w-9 h-9 sm:w-10 sm:h-10 -ml-1 sm:-ml-1.5 flex items-center justify-center hover:bg-[#F2EAE2] rounded-full text-[#4E392D] transition-colors cursor-pointer shrink-0 touch-manipulation"
                aria-label="Go Back"
              >
                <ArrowLeft size={22} className="pointer-events-none" />
              </button>
            )}

            {title ? (
              <h1 className="text-[17px] font-bold text-[#2B221B] tracking-tight">{title}</h1>
            ) : (
              <Link
                to="/"
                className="flex items-center touch-manipulation"
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
                  placeholder="Search handcrafted pottery, statues..."
                  className="w-full pl-9 pr-9 py-2 bg-white/90 hover:bg-white focus:bg-white rounded-full text-xs sm:text-sm text-[#2B221B] placeholder-[#8C6D58] border border-[#E5D7CA] focus:border-[#C85A32] focus:ring-1 focus:ring-[#C85A32]/30 outline-none transition-all shadow-2xs"
                />
                {internalQuery && (
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="absolute right-3 text-[#8C6D58] hover:text-[#2B221B] p-0.5 rounded-full cursor-pointer touch-manipulation"
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
                className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer shrink-0 touch-manipulation"
                aria-label="Search Store"
                title="Search Store"
              >
                <Search size={20} className="pointer-events-none" />
              </button>
            )}

            {/* Wishlist Option */}
            {showWishlist && location.pathname !== "/wishlist" && (
              <Link
                to="/wishlist"
                className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer shrink-0 touch-manipulation"
                aria-label="Wishlist"
                title="Saved Pieces"
              >
                <Heart
                  size={20}
                  className={`pointer-events-none ${wishlistCount !== undefined && wishlistCount > 0 ? "text-[#C85A32] fill-[#C85A32]/10" : ""}`}
                />
                {wishlistCount !== undefined && wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#C85A32] text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none shadow-xs border-2 border-[#FAF8F5] pointer-events-none">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {/* Cart Option */}
            <Link
              to="/cart"
              className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] hover:bg-[#F2EAE2] rounded-full transition-colors cursor-pointer shrink-0 touch-manipulation"
              aria-label="Shopping Cart"
            >
              <ShoppingCart size={20} className="pointer-events-none" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#C85A32] text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none shadow-xs border-2 border-[#FAF8F5] pointer-events-none">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Profile Option - Instant Direct Link */}
            <Link
              to="/account"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#E5D7CA] hover:border-[#C85A32] hover:bg-[#F2EAE2] bg-transparent flex items-center justify-center text-[#5E473A] hover:text-[#2B221B] shrink-0 transition-colors cursor-pointer overflow-hidden touch-manipulation active:scale-95"
              aria-label="User Profile"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "User"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full pointer-events-none"
                />
              ) : (
                <UserIcon size={18} className="pointer-events-none" />
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
