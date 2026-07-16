'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070a13] text-white p-6 text-center">
      <div className="w-16 h-16 bg-brand/10 border border-brand/25 rounded-2xl flex items-center justify-center mb-6 shadow-xl relative animate-pulse">
        <AlertCircle className="w-8 h-8 text-brand" />
      </div>
      
      <h2 className="text-2xl font-extrabold mb-2">Something went wrong!</h2>
      <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
        An unexpected error occurred in the application. We have logged this event and are looking into it.
      </p>

      <button
        onClick={() => reset()}
        className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-2xl shadow-lg shadow-brand/35 transition-all text-sm flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}
