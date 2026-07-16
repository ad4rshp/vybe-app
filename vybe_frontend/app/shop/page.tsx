'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAccessToken, getSavedUser, saveUser } from '../utils/api';
import { ArrowLeft, Sparkles, Zap, Crown, Lock, CreditCard, Loader2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { VybeCoins } from '../components/VybeIcons';

const TOKEN_PACKAGES = [
  { id: 1, amount: 50, priceUSD: '$0.99', priceINR: '₹80', label: 'Starter', icon: VybeCoins, color: 'emerald' },
  { id: 2, amount: 200, priceUSD: '$2.99', priceINR: '₹250', label: 'Popular', icon: Zap, color: 'violet', featured: true },
  { id: 3, amount: 500, priceUSD: '$4.99', priceINR: '₹400', label: 'Premium', icon: Crown, color: 'amber' },
];

export default function ShopPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Payment states
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'STRIPE' | 'RAZORPAY' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const [txDetails, setTxDetails] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = getAccessToken();
    const user = getSavedUser();
    if (!token || !user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);
  }, []);

  const handlePackageClick = (pkg: any) => {
    setErrorMessage('');
    setSelectedPackage(pkg);
    setPaymentProvider(null);
  };

  const handleCheckoutSubmit = async () => {
    if (!selectedPackage || !paymentProvider) return;
    setIsProcessing(true);
    setErrorMessage('');

    try {
      const response = await apiFetch('/payments/checkout/', {
        method: 'POST',
        body: {
          package_id: selectedPackage.id,
          provider: paymentProvider
        }
      });

      if (response.success) {
        // Update user state
        const updatedUser = { ...currentUser, credits: response.credits };
        saveUser(updatedUser);
        setCurrentUser(updatedUser);
        setTxDetails(response);
        
        // Show success animation
        setShowSuccessAnim(true);
        setTimeout(() => {
          setShowSuccessAnim(false);
          setSelectedPackage(null);
          setPaymentProvider(null);
          setTxDetails(null);
        }, 3500);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment simulation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070a13] text-[#f3f4f6] relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-[#090d16]/95 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold tracking-wide flex items-center gap-2 text-white">
            <VybeCoins size={20} className="text-brand" />
            Token Shop
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 border border-brand/20 rounded-full">
            <VybeCoins size={14} className="text-brand" />
            <span className="font-bold text-brand">{currentUser?.credits ?? 0}</span>
            <span className="text-gray-400 text-xs">tokens</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-12 z-10 animate-slide-up">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-3 text-white">
            Get <span className="text-gradient-brand">VYBE Tokens</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Use tokens to unlock gender-filtered matching. Matching with &quot;Everyone&quot; is always free. Gender filters cost <strong className="text-white">5 tokens</strong> per session.
          </p>
        </div>

        {/* Token Package Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {TOKEN_PACKAGES.map((pkg) => {
            const IconComponent = pkg.icon;
            return (
              <div
                key={pkg.id}
                className={`relative rounded-3xl border p-6 flex flex-col items-center text-center transition-all duration-300 ${
                  pkg.featured
                    ? 'bg-brand/5 border-brand/30 shadow-xl shadow-brand/10 scale-105 card-vybe'
                    : 'bg-zinc-900/60 border-white/5 hover:border-white/10 card-vybe'
                }`}
              >
                {pkg.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-brand text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-md animate-pulse">
                    Most Popular
                  </div>
                )}

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  pkg.featured
                    ? 'bg-brand/20 border border-brand/30 text-brand'
                    : 'bg-white/5 border border-white/10 text-gray-300'
                }`}>
                  <IconComponent size={28} className={pkg.featured ? 'text-brand' : 'text-gray-300'} />
                </div>

                <h3 className="text-lg font-bold mb-1 text-white">{pkg.label}</h3>
                <div className="text-3xl font-extrabold mb-1 text-white">
                  {pkg.amount}
                  <span className="text-sm font-medium text-gray-400 ml-1">tokens</span>
                </div>
                <div className="text-brand font-bold text-lg mb-6">{pkg.priceUSD} / {pkg.priceINR}</div>

                {/* Purchase Button */}
                <button
                  onClick={() => handlePackageClick(pkg)}
                  className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 active:scale-[0.98] transition-all relative overflow-hidden"
                >
                  <CreditCard className="w-4 h-4" />
                  Select Package
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Tokens Info */}
        <div className="card-vybe p-8 text-center flex flex-col items-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
            <h3 className="font-bold text-lg text-white">Free Tokens</h3>
          </div>
          <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Every new account starts with <strong className="text-white">100 free tokens</strong>. Payment processing is configured for simulated checkouts during testing.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 border border-brand/20 rounded-full text-brand text-xs font-bold animate-glow">
            <VybeCoins size={14} className="text-brand" />
            Your Balance: {currentUser?.credits ?? 0} tokens
          </div>
        </div>
      </main>

      {/* Payment Selection Modal Overlay */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-white/10 rounded-3xl max-w-md w-full p-6 relative overflow-hidden shadow-2xl animate-scale-in">
            {/* Background Accent glow */}
            <div className="absolute top-[-50%] left-[-50%] w-full h-full rounded-full bg-brand/5 blur-[80px] pointer-events-none" />

            {!showSuccessAnim ? (
              <>
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Secure Token Checkout
                  </h3>
                  <button
                    onClick={() => setSelectedPackage(null)}
                    disabled={isProcessing}
                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary */}
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl mb-6">
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Purchasing</div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-extrabold text-white">
                      {selectedPackage.amount} Tokens
                    </span>
                    <span className="text-sm font-semibold text-brand">
                      {selectedPackage.priceUSD} / {selectedPackage.priceINR}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-2">
                    Credits will be immediately added to account: <span className="text-white font-medium">{currentUser?.username}</span>.
                  </div>
                </div>

                {/* Provider selection */}
                <div className="space-y-3 mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                    Select Payment Gateway:
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Stripe selector */}
                    <button
                      onClick={() => setPaymentProvider('STRIPE')}
                      disabled={isProcessing}
                      className={`p-4 rounded-2xl border text-center font-bold text-sm transition-all flex flex-col items-center justify-center gap-1.5 ${
                        paymentProvider === 'STRIPE'
                          ? 'border-brand bg-brand/5 text-white ring-1 ring-brand/50'
                          : 'border-white/5 bg-zinc-900/40 text-gray-300 hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-xs tracking-wider">GLOBAL PAY</span>
                      <span className="text-base text-sky-400">Stripe</span>
                    </button>

                    {/* Razorpay selector */}
                    <button
                      onClick={() => setPaymentProvider('RAZORPAY')}
                      disabled={isProcessing}
                      className={`p-4 rounded-2xl border text-center font-bold text-sm transition-all flex flex-col items-center justify-center gap-1.5 ${
                        paymentProvider === 'RAZORPAY'
                          ? 'border-brand bg-brand/5 text-white ring-1 ring-brand/50'
                          : 'border-white/5 bg-zinc-900/40 text-gray-300 hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-xs tracking-wider">INDIA PAY</span>
                      <span className="text-base text-indigo-400">Razorpay</span>
                    </button>
                  </div>
                </div>

                {/* Error */}
                {errorMessage && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium mb-4 animate-shake">
                    {errorMessage}
                  </div>
                )}

                {/* Pay Button */}
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={!paymentProvider || isProcessing}
                  className="w-full py-4 bg-brand hover:bg-brand-hover disabled:bg-white/5 disabled:text-gray-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Contacting Gateway...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {paymentProvider
                        ? `Pay ${paymentProvider === 'STRIPE' ? selectedPackage.priceUSD : selectedPackage.priceINR} via ${paymentProvider === 'STRIPE' ? 'Stripe' : 'Razorpay'}`
                        : 'Select a Payment Method'}
                    </>
                  )}
                </button>
              </>
            ) : (
              /* Success Animation */
              <div className="flex flex-col items-center justify-center py-8 text-center animate-scale-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/20 animate-glow">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">Simulated Payment Success!</h3>
                <p className="text-xs text-gray-400 max-w-xs mb-4">
                  {selectedPackage.amount} tokens credited.
                </p>
                <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] text-gray-400 font-mono">
                  Ref: {txDetails?.reference_id}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
