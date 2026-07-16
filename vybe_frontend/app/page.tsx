'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { getAccessToken, getSavedUser } from './utils/api';
import { ArrowRight, Users, Globe, Zap } from 'lucide-react';
import { generateDynamicFavicon } from './utils/favicon';
import { VybeLogo, VybeLogoMark, VybeMatch, VybeShield, VybeChat, VybeVideo } from './components/VybeIcons';

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const user = getSavedUser();
    if (token && user) {
      setIsLoggedIn(true);
      setUsername(user.username);
    }

    // Dynamic canvas particle mesh background
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        drawGrid();
      }, 200);
    };
    window.addEventListener('resize', handleResize);

    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = width;
    gridCanvas.height = height;
    const drawGrid = () => {
      gridCanvas.width = width;
      gridCanvas.height = height;
      const gCtx = gridCanvas.getContext('2d');
      if (!gCtx) return;
      gCtx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
      gCtx.lineWidth = 1;
      const gridSize = 80;
      gCtx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        gCtx.moveTo(x, 0);
        gCtx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        gCtx.moveTo(0, y);
        gCtx.lineTo(width, y);
      }
      gCtx.stroke();
    };
    drawGrid();

    const particleCount = Math.min(40, Math.floor((width * height) / 45000));
    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number }> = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.8,
      });
    }

    let accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f43f5e';
    const colorInterval = setInterval(() => {
      accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f43f5e';
    }, 1000);

    const LINK_DIST = 140;
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30;

    const draw = (time: number) => {
      animationId = requestAnimationFrame(draw);
      if (time - lastFrame < FRAME_INTERVAL) return;
      lastFrame = time;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(gridCanvas, 0, 0);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      }
      ctx.fill();

      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < LINK_DIST_SQ) {
            const alpha = Math.floor((1 - dSq / LINK_DIST_SQ) * 30);
            ctx.strokeStyle = `${accentColor}${alpha.toString(16).padStart(2, '0')}`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      clearInterval(colorInterval);
      clearTimeout(resizeTimer);
    };

  }, []);

  return (
    <div className="flex flex-col min-h-screen justify-between bg-[#070a13] text-[#f3f4f6] relative overflow-hidden">
      {/* Studio background image layer */}
      <div className="absolute inset-0 bg-hero opacity-40 pointer-events-none z-0" />

      {/* Dynamic Network Canvas Mesh */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />

      {/* Decorative Radial Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand/8 blur-[120px] pointer-events-none z-0 animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-violet-500/5 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[10%] w-[300px] h-[300px] rounded-full bg-cyan-500/3 blur-[100px] pointer-events-none z-0 animate-float" style={{ animationDelay: '3s' }} />

      {/* Navigation Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10 shrink-0 animate-slide-up">
        <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => router.push('/')}>
          <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            VYBE
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm hidden sm:inline">
                Welcome back, <strong className="text-brand font-semibold">{username}</strong>
              </span>
              <Link
                href="/chat"
                className="btn-vybe btn-vybe-primary px-5 py-2.5 text-sm flex items-center gap-1.5"
              >
                Enter Chat Lobby
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-gray-300 hover:text-white font-medium text-sm px-4 py-2 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="btn-vybe btn-vybe-ghost px-5 py-2.5 text-sm"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center px-6 py-12 z-10 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 text-left flex flex-col items-start">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand/10 border border-brand/25 rounded-full text-brand text-xs font-semibold uppercase tracking-wider mb-8 animate-slide-up animate-glow">
              <span className="w-1.5 h-1.5 rounded-full bg-brand pulse-red" />
              Live Matchmaking Active
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08] mb-6 animate-slide-up animate-slide-up-delay-1">
              Connect with<br />
              <span className="text-gradient-brand">
                real people
              </span><br />
              instantly.
            </h1>

            <p className="text-base sm:text-lg text-gray-400 leading-relaxed mb-10 max-w-lg animate-slide-up animate-slide-up-delay-2">
              Random video chat made simple. Match with real people, have real conversations, and move on when you're ready.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto animate-slide-up animate-slide-up-delay-3">
              <button
                onClick={() => {
                  router.push(isLoggedIn ? '/chat' : '/login');
                }}
                className="btn-vybe btn-vybe-primary w-full sm:w-auto px-8 py-4 text-lg group glow-btn"
              >
                <VybeMatch size={22} />
                <span>Start Matching Now</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
              {!isLoggedIn && (
                <Link
                  href="/register"
                  className="btn-vybe btn-vybe-ghost w-full sm:w-auto px-8 py-4 text-lg"
                >
                  Join VYBE
                </Link>
              )}
            </div>

            {/* Live stats strip */}
            <div className="flex items-center gap-6 mt-10 animate-slide-up animate-slide-up-delay-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-red" />
                <span className="text-sm text-gray-400"><strong className="text-white">Live</strong> matching</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Globe className="w-4 h-4 text-brand" />
                <span><strong className="text-white">Global</strong> users</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span><strong className="text-white">Instant</strong> connect</span>
              </div>
            </div>
          </div>

          {/* Hero Right — Feature Cards Grid */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full animate-slide-up animate-slide-up-delay-3">
            <div className="card-vybe p-6 flex flex-col gap-4">
              <div className="w-11 h-11 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center">
                <VybeMatch size={22} />
              </div>
              <h3 className="font-bold text-lg text-white">Gender Matching</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Match with Men, Women, or Everyone — your choice, every time.
              </p>
            </div>

            <div className="card-vybe p-6 flex flex-col gap-4">
              <div className="w-11 h-11 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center">
                <VybeShield size={22} />
              </div>
              <h3 className="font-bold text-lg text-white">Safe Space</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Built-in protections keep your experience clean and comfortable.
              </p>
            </div>

            <div className="card-vybe p-6 flex flex-col gap-4 sm:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center">
                  <VybeChat size={22} />
                </div>
                <h3 className="font-bold text-lg text-white">Video & Text Chat</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Talk face-to-face or type it out. Skip, block, or report — you're always in control.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <span>© 2026 VYBE Random Video Chat. All rights reserved.</span>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
          <Link href="/tos" className="hover:text-gray-300 transition-colors">Terms of Use</Link>
          <span className="text-gray-600">Safety Guidelines</span>
        </div>
      </footer>
    </div>
  );
}
