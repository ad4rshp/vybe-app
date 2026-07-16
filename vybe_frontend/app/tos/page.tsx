'use client';

import Link from 'next/link';
import { VybeLogoMark } from '../components/VybeIcons';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#070a13] text-[#f3f4f6] px-6 py-12 flex flex-col items-center relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-brand/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Brand Header */}
      <header className="w-full max-w-3xl flex items-center justify-between mb-12 z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-extrabold text-lg tracking-wide text-white group-hover:text-brand transition-colors">VYBE</span>
        </Link>
        <Link href="/login" className="btn-vybe btn-vybe-primary py-2 px-4 text-xs font-semibold">
          Sign In
        </Link>
      </header>

      {/* Main content */}
      <main className="w-full max-w-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-wide text-white mb-2">Terms of Service</h1>
          <p className="text-xs text-gray-400">Last updated: July 16, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">1. Acceptance of Terms</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            By creating an account, registering, or accessing the VYBE chat application, you confirm that you accept these Terms of Service in full and agree to comply with them. If you do not agree, you must immediately terminate use of our platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">2. Eligibility</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            You must be at least 18 years of age (or the legal age of majority in your jurisdiction) to use VYBE. By accessing the site, you represent and warrant that you possess the legal capability to agree to these terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">3. User Conduct Guidelines</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            VYBE is built on high-vibe, safe, and respectful interactions. You agree NOT to:
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-300 space-y-2">
            <li>Engage in harassment, hate speech, bullying, or abusive behavior.</li>
            <li>Transmit nude, sexually explicit, obscene, or highly offensive visual media.</li>
            <li>Use the platform for commercial solicitations, scams, or advertising.</li>
            <li>Violate or attempt to bypass IP-level bans, account suspensions, or safety boundaries set by moderators.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">4. Credit & Refund Policy</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            VYBE tokens represent promotional and virtual credits used exclusively to support priority filters inside our matching service. Tokens have no direct cash value, are non-transferable, and are not subject to refund exceptions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">5. Disclaimer of Warranties & Liability</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            The platform is provided "as is" and "as available". We do not warrant that connections will be uninterrupted, error-free, or entirely secure. To the maximum extent permitted by law, VYBE disclaims all liabilities resulting from stranger interactions.
          </p>
        </section>

        <div className="border-t border-white/5 pt-8 text-center">
          <Link href="/register" className="text-sm text-brand font-semibold hover:underline">
            Back to registration page
          </Link>
        </div>
      </main>
    </div>
  );
}
