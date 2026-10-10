import { useState, useEffect } from 'react';

export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 10);

      // Hide when scrolling down, show immediately when scrolling back up
      if (currentScrollY > lastScrollY + 8 && currentScrollY > 60) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY - 6 || currentScrollY <= 60) {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { isVisible, isScrolled };
}
