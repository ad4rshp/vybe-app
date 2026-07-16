'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, saveTokens, saveUser } from '../utils/api';
import { AlertTriangle } from 'lucide-react';
import { VybeLogoMark } from '../components/VybeIcons';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username_or_email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch('/auth/login/', {
        method: 'POST',
        body: formData,
      });

      // Save tokens and user info if present in JSON response body
      if (response.tokens) {
        saveTokens(response.tokens.access, response.tokens.refresh);
      }
      saveUser(response.user);

      // Redirect to chat page
      router.push('/chat');
    } catch (err: any) {
      if (err.data?.error === 'EMAIL_UNVERIFIED' || err.message.includes('EMAIL_UNVERIFIED')) {
        // Redirect to verification instructions page, passing the username/email to help
        const identifier = encodeURIComponent(formData.username_or_email);
        router.push(`/verify-email?email=${identifier}`);
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
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
      <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] bg-brand/6 rounded-full blur-[120px] pointer-events-none z-0 animate-float" />
      <div className="absolute bottom-[15%] right-[15%] w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none z-0 animate-float" style={{ animationDelay: '3s' }} />

      <div className="w-full max-w-md card-vybe p-8 shadow-2xl relative z-10 animate-slide-up">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold tracking-wide text-white">Welcome to VYBE</h2>
          <p className="text-gray-400 text-sm mt-1">Sign in to match and video chat</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-start gap-3 animate-scale-in">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-slide-up animate-slide-up-delay-1">
            <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Username or Email
            </label>
            <input
              type="text"
              required
              className="input-vybe w-full"
              placeholder="Enter your username or email"
              value={formData.username_or_email}
              onChange={(e) => setFormData({ ...formData, username_or_email: e.target.value })}
            />
          </div>

          <div className="animate-slide-up animate-slide-up-delay-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => alert("Password reset via console emails is not implemented. Please register a new account or log in with password 'userpassword123' / 'adminpassword123' / 'teampassword123'.")}
                className="text-xs text-brand hover:text-brand-hover hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              required
              className="input-vybe w-full"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="animate-slide-up animate-slide-up-delay-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-vybe btn-vybe-primary w-full py-3 text-sm mt-2 glow-btn"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>

        <div className="text-center mt-8 text-sm text-gray-400 animate-slide-up animate-slide-up-delay-4">
          Don't have an account?{' '}
          <Link href="/register" className="text-brand hover:text-brand-hover font-semibold hover:underline transition-colors">
            Register Here
          </Link>
        </div>
      </div>
    </div>
  );
}
