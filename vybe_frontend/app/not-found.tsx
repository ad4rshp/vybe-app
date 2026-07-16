'use client';

import { useRouter } from 'next/navigation';
import { EyeOff, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#070a13] text-white p-6 text-center">
      <div className="w-16 h-16 bg-brand/10 border border-brand/25 rounded-2xl flex items-center justify-center mb-6 shadow-xl relative animate-pulse">
        <EyeOff className="w-8 h-8 text-brand" />
      </div>
      
      <h2 className="text-2xl font-extrabold mb-2">404 - Page Not Found</h2>
      <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        The page you are looking for does not exist, has been removed, or is temporarily unavailable.
      </p>

      <button
        onClick={() => router.push('/chat')}
        className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-all text-sm flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Lobby
      </button>
    </div>
  );
}
