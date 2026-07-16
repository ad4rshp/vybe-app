'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../utils/api';
import { Video, Mail, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Handle auto-verification if token is in URL
  useEffect(() => {
    if (token) {
      const verifyToken = async () => {
        setVerifying(true);
        setError('');
        try {
          await apiFetch('/auth/verify-email/', {
            method: 'POST',
            body: { token },
          });
          setVerified(true);
          setMessage('Your email has been verified successfully!');
        } catch (err: any) {
          setError(err.message || 'Verification failed. The link may have expired or is invalid.');
        } finally {
          setVerifying(false);
        }
      };

      verifyToken();
    }
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email address to resend the link.');
      return;
    }

    setResending(true);
    setError('');
    setMessage('');

    try {
      const response = await apiFetch('/auth/resend-verification/', {
        method: 'POST',
        body: { email },
      });
      setMessage(response.detail || 'Verification email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Could not resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-zinc-900/50 border border-white/5 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative text-center">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/35 mb-3">
          <Video className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-wide">Email Verification</h2>
      </div>

      {verifying && (
        <div className="py-8 flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-rose-500 animate-spin" />
          <p className="text-gray-300">Verifying your token. Please wait...</p>
        </div>
      )}

      {!verifying && token && verified && (
        <div className="py-6 flex flex-col items-center gap-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 animate-bounce" />
          <p className="text-green-400 font-semibold text-lg">{message}</p>
          <Link
            href="/login"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl py-3 px-4 shadow-lg shadow-rose-500/20 transition-all text-sm mt-4 inline-block"
          >
            Go to Login
          </Link>
        </div>
      )}

      {!verifying && token && !verified && error && (
        <div className="py-6 flex flex-col items-center gap-4">
          <AlertCircle className="w-16 h-16 text-rose-500" />
          <p className="text-rose-400 font-medium">{error}</p>
          <div className="w-full border-t border-white/5 my-4 pt-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Resend Verification Link</h3>
            <form onSubmit={handleResend} className="space-y-3">
              <input
                type="email"
                required
                className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors text-left"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                disabled={resending}
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 font-medium rounded-xl py-2.5 px-4 transition-all text-sm flex items-center justify-center gap-2"
              >
                {resending ? 'Resending...' : 'Resend Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {!token && (
        <div className="py-4">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-rose-400" />
          </div>

          <h3 className="text-xl font-semibold mb-2">Check your email</h3>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            We sent a verification link to your email address. Please click it to verify your account.
          </p>

          {message && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleResend} className="space-y-3 border-t border-white/5 pt-6">
            <div className="text-left">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Resend Link for Email
              </label>
              <input
                type="email"
                required
                className="w-full bg-[#0d1222] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={resending}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white font-bold rounded-xl py-3 px-4 shadow-lg shadow-rose-500/20 transition-all text-sm flex items-center justify-center gap-2"
            >
              {resending ? 'Resending...' : 'Resend Email'}
            </button>
          </form>

          <div className="text-center mt-6 text-sm">
            <Link href="/login" className="text-gray-400 hover:text-white font-medium hover:underline">
              Back to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-[#070a13] px-6 text-[#f3f4f6]">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
      <Suspense fallback={
        <div className="w-full max-w-md bg-zinc-900/50 border border-white/5 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative text-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
