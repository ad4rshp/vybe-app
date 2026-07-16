'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../utils/api';
import { AlertTriangle } from 'lucide-react';
import { VybeLogoMark } from '../components/VybeIcons';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!acceptTerms) {
      setError("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    // Quick validation
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/auth/register/', {
        method: 'POST',
        body: formData,
      });

      // Redirect to email verification helper page
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen justify-center items-center px-6 text-[#f3f4f6] relative overflow-hidden">
      {/* Studio background */}
      <div className="absolute inset-0 bg-auth opacity-50 pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[#070a13]/60 pointer-events-none z-0" />

      {/* Decorative glows */}
      <div className="absolute top-[15%] right-[10%] w-[350px] h-[350px] bg-brand/6 rounded-full blur-[120px] pointer-events-none z-0 animate-float" />
      <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none z-0 animate-float" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md card-vybe p-8 shadow-2xl relative z-10 animate-slide-up">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-4">
          <h2 className="text-2xl font-bold tracking-wide text-white">Create Account</h2>
          <p className="text-gray-400 text-sm mt-1">Get started with VYBE instant matching</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-start gap-3 animate-scale-in">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="animate-slide-up animate-slide-up-delay-1">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              className="input-vybe w-full"
              placeholder="Pick a unique username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="animate-slide-up animate-slide-up-delay-1">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              className="input-vybe w-full"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="animate-slide-up animate-slide-up-delay-2">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              className="input-vybe w-full"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="animate-slide-up animate-slide-up-delay-2">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              required
              className="input-vybe w-full"
              placeholder="••••••••"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
            />
          </div>

          {/* ToS Checkbox */}
          <div className="flex items-start gap-2.5 my-3 animate-slide-up animate-slide-up-delay-3">
            <input
              id="tos-check"
              type="checkbox"
              required
              className="mt-1 cursor-pointer accent-brand rounded border-white/10 bg-[#0d1222]"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <label htmlFor="tos-check" className="text-xs text-gray-400 cursor-pointer select-none">
              I agree to the <Link href="/tos" target="_blank" className="text-brand font-semibold hover:underline">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="text-brand font-semibold hover:underline">Privacy Policy</Link>.
            </label>
          </div>

          <div className="animate-slide-up animate-slide-up-delay-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-vybe btn-vybe-primary w-full py-3 text-sm mt-3 glow-btn"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </div>
        </form>

        <div className="text-center mt-6 text-sm text-gray-400 animate-slide-up animate-slide-up-delay-4">
          Already have an account?{' '}
          <Link href="/login" className="text-brand hover:text-brand-hover font-semibold hover:underline transition-colors">
            Login Here
          </Link>
        </div>
      </div>
    </div>
  );
}
