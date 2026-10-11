import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Support environments without explicit @types/react class definitions
const ComponentBase: any = React.Component;

export class ErrorBoundary extends ComponentBase {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an unhandled runtime error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[70vh] w-full flex items-center justify-center px-4 py-12 bg-[#FAF8F5] text-[#2B221B]">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#EADBCC] text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-[#C85A32] flex items-center justify-center">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#2B221B]">Something went wrong</h2>
              <p className="text-xs sm:text-sm text-[#735A4C] leading-relaxed">
                We encountered an unexpected issue while loading this section. Your data is safe.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 h-11 bg-[#C85A32] hover:bg-[#A04724] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <RefreshCw size={16} />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '#/';
                }}
                className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 text-[#2B221B] text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Home size={16} />
                <span>Go to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
