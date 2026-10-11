import { useState, useEffect } from 'react';

export function useScrollDirection() {
  const [isVisible, setIsVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      setIsScrolled(currentScrollY > 10);

      // Hide only on clear intentional downward scroll, show immediately on any scroll up
      if (currentScrollY > lastScrollY + 30 && currentScrollY > 90) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY - 15 || currentScrollY <= 60) {
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
