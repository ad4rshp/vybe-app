'use client';

import Link from 'next/link';
import { VybeLogoMark } from '../components/VybeIcons';

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-extrabold tracking-wide text-white mb-2">Privacy Policy</h1>
          <p className="text-xs text-gray-400">Last updated: July 16, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">1. Information We Collect</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            To provide a responsive, safe chat environment, we log the minimum possible data payload:
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-300 space-y-2">
            <li><strong>Account details:</strong> Username, email, password hashes, and profile preference configurations (such as gender and match mode).</li>
            <li><strong>Technical identifiers:</strong> Your IP address (logged to evaluate and apply safety IP suspensions) and device metadata.</li>
            <li><strong>Communication payload:</strong> Text-only direct messages sent to friends (saved to enable offline/unread inbox synchronization).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">2. Zero Video & Audio Recording</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            All matching video and audio streams run **directly peer-to-peer (P2P)** between users. VYBE does NOT record, process, store, or intercept your video or audio conversations at any point.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">3. How Data is Utilized</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            We use your data solely to:
          </p>
          <ul className="list-disc pl-5 text-sm text-gray-300 space-y-2">
            <li>Authenticate accounts and compute token balances.</li>
            <li>Match you symmetrically based on selected preferences.</li>
            <li>Enforce safety policies, including account blocklists and client-side IP-level bans.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">4. Third-Party Integrations</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            We do not sell, trade, or share your personal details with advertisers or external parties. Technical logging is restricted entirely to our private PostgreSQL, Redis, and internal telemetry environments.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">5. Data Retention & Deletion</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            You hold the right to delete your account at any point. Upon account termination, all active friendships, profile details, and DM history associated with your user identity are permanently pruned from our active database.
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
