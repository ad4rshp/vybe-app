'use client';

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

/* ───────────────────────────────────────────────
 * VYBE LOGO — Animated "V" mark with gradient
 * Usage: <VybeLogo size={32} className="text-brand" />
 * ─────────────────────────────────────────────── */
export function VybeLogo({ size = 32, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="vybe-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent, #f43f5e)" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <filter id="vybe-logo-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vybe-logo-grad)" opacity="0.15" />
      <rect x="4" y="4" width="40" height="40" rx="12" stroke="url(#vybe-logo-grad)" strokeWidth="1.5" opacity="0.4" />
      <path
        d="M16 16L24 34L32 16"
        stroke="url(#vybe-logo-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#vybe-logo-glow)"
      />
      {/* Signal dot */}
      <circle cx="36" cy="12" r="3" fill="#10b981" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE LOGO MARK — Compact mark for header bars
 * ─────────────────────────────────────────────── */
export function VybeLogoMark({ size = 36, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent, #f43f5e)" />
          <stop offset="50%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#mark-grad)" />
      <path
        d="M13 13L20 29L27 13"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Live indicator */}
      <circle cx="31" cy="9" r="3" fill="#10b981">
        <animate attributeName="r" values="3;3.8;3" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE MATCH — Two nodes connecting (matchmaking)
 * ─────────────────────────────────────────────── */
export function VybeMatch({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="match-grad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="100%" stopColor="var(--accent, #f43f5e)" />
        </linearGradient>
      </defs>
      {/* Left node */}
      <circle cx="6" cy="12" r="3" fill="url(#match-grad)" opacity="0.9">
        <animate attributeName="cx" values="6;8;6" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Right node */}
      <circle cx="18" cy="12" r="3" fill="url(#match-grad)" opacity="0.9">
        <animate attributeName="cx" values="18;16;18" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Connecting line */}
      <line x1="9" y1="12" x2="15" y2="12" stroke="url(#match-grad)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2">
        <animate attributeName="stroke-dashoffset" values="0;4" dur="0.8s" repeatCount="indefinite" />
      </line>
      {/* Spark */}
      <circle cx="12" cy="12" r="1.5" fill="#facc15">
        <animate attributeName="r" values="0;2;0" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE SHIELD — Security/verification badge
 * ─────────────────────────────────────────────── */
export function VybeShield({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 3L4 7V12C4 16.4 7.4 20.5 12 21.5C16.6 20.5 20 16.4 20 12V7L12 3Z"
        fill="var(--accent, #f43f5e)"
        opacity="0.12"
        stroke="var(--accent, #f43f5e)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="var(--accent, #f43f5e)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE CHAT — Stylized speech bubble with signal
 * ─────────────────────────────────────────────── */
export function VybeChat({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M21 12C21 16.4183 16.9706 20 12 20C10.4607 20 9.01172 19.6565 7.74023 19.05L3 20L4.39453 16.2617C3.51367 14.9961 3 13.5508 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z"
        fill="var(--accent, #f43f5e)"
        opacity="0.12"
        stroke="var(--accent, #f43f5e)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Signal waves */}
      <circle cx="8.5" cy="12" r="1" fill="var(--accent, #f43f5e)" />
      <circle cx="12" cy="12" r="1" fill="var(--accent, #f43f5e)">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="15.5" cy="12" r="1" fill="var(--accent, #f43f5e)">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE COINS — Custom token / credits icon
 * ─────────────────────────────────────────────── */
export function VybeCoins({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="coin-grad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Back coin */}
      <ellipse cx="14" cy="10" rx="7" ry="7" fill="url(#coin-grad)" opacity="0.2" />
      {/* Front coin */}
      <ellipse cx="10" cy="14" rx="7" ry="7" fill="url(#coin-grad)" opacity="0.25" stroke="#facc15" strokeWidth="1" />
      {/* V mark on coin */}
      <path d="M8 12L10 16L12 12" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE SEARCH — Radar pulse animation for searching
 * ─────────────────────────────────────────────── */
export function VybeSearch({ size = 56, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="radar-grad" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--accent, #f43f5e)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent, #f43f5e)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Radar rings */}
      <circle cx="32" cy="32" r="28" stroke="var(--accent, #f43f5e)" strokeWidth="0.5" opacity="0.2" />
      <circle cx="32" cy="32" r="20" stroke="var(--accent, #f43f5e)" strokeWidth="0.5" opacity="0.3" />
      <circle cx="32" cy="32" r="12" stroke="var(--accent, #f43f5e)" strokeWidth="0.5" opacity="0.4" />
      {/* Pulse rings */}
      <circle cx="32" cy="32" r="8" fill="none" stroke="var(--accent, #f43f5e)" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="r" values="8;28;8" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="32" cy="32" r="8" fill="none" stroke="var(--accent, #f43f5e)" strokeWidth="1" opacity="0.4">
        <animate attributeName="r" values="8;28;8" dur="3s" begin="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" begin="1s" repeatCount="indefinite" />
      </circle>
      {/* Center V logo */}
      <path d="M27 26L32 38L37 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Sweep line */}
      <line x1="32" y1="32" x2="32" y2="6" stroke="url(#radar-grad)" strokeWidth="2" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="4s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE VIDEO — Custom video camera icon
 * ─────────────────────────────────────────────── */
export function VybeVideo({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="6" width="14" height="12" rx="3" fill="var(--accent, #f43f5e)" opacity="0.12" stroke="var(--accent, #f43f5e)" strokeWidth="1.5" />
      <path d="M16 9.5L22 6V18L16 14.5" stroke="var(--accent, #f43f5e)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Recording dot */}
      <circle cx="6" cy="10" r="1.5" fill="var(--accent, #f43f5e)">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ───────────────────────────────────────────────
 * VYBE GENDER icons for filter UI
 * ─────────────────────────────────────────────── */
export function VybeMale({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="10" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 9L20 4M20 4H16M20 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VybeFemale({ size = 20, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 15V22M9 19H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
