import React, { useState } from "react";
import { usePadosiStore } from "../store";
import { X, Phone, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setAuthModalOpen, setCurrentUser, addNotification } = usePadosiStore();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send OTP");

      setStep('otp');
      addNotification(`📱 Simulated OTP sent to ${phoneNumber}. Code is [123456]`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code: otpCode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to verify OTP");

      setCurrentUser(data.user);
      addNotification(`✓ Welcome to Padosi, ${data.user.name}!`);
      setAuthModalOpen(false);
      // Reset
      setPhoneNumber("");
      setOtpCode("");
      setStep('phone');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#fdfbf7] dark:bg-[#0c1612] border border-sage-200 dark:border-emerald-950 p-6 md:p-8 rounded-2xl shadow-2xl relative">
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-[#14261c] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sage-500 flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-3 shadow-md">
            P
          </div>
          <h2 className="font-display font-bold text-xl text-sage-900 dark:text-[#e8efe9]">
            Neighbor Verification
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Secure hyperlocal sign-in. Verified phone numbers build listing trust.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-950 px-3 py-2 rounded-xl mb-4 text-xs text-red-600 dark:text-red-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="tel"
                  placeholder="+1 555-0199"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-display font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-sage-500/10 cursor-pointer transition-all"
            >
              {loading ? "Sending..." : "Request OTP Code"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900 px-3 py-2 rounded-xl flex gap-2 items-center text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>We sent a simulated OTP code. Type <strong className="font-mono bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded text-xs">123456</strong> below!</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                Enter 6-Digit OTP Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full px-4 py-2.5 text-center tracking-[1em] font-mono rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-1/3 py-2.5 border border-sage-200 dark:border-emerald-950 hover:bg-sage-100 dark:hover:bg-[#14261c] text-zinc-600 dark:text-zinc-300 font-display font-semibold text-sm rounded-xl cursor-pointer transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 py-2.5 bg-sage-500 hover:bg-sage-600 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-display font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
