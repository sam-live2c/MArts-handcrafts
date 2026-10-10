import { NavigateFunction } from 'react-router-dom';

/**
 * Universal smart back button handler.
 * Safely navigates back in browser history if history exists in this session,
 * otherwise falls back to the specified default path.
 */
export const handleGoBack = (navigate: NavigateFunction, fallbackPath: string = '/') => {
  try {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  } catch {
    navigate(fallbackPath, { replace: true });
  }
};
