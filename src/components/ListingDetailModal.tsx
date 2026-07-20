import React, { useState } from "react";
import { usePadosiStore } from "../store";
import { Item } from "../types";
import { X, Calendar, Wallet, ShieldAlert, Sparkles, AlertTriangle, CheckCircle } from "lucide-react";
import { TrustScoreGauge } from "./TrustScoreGauge";

interface ListingDetailModalProps {
  item: Item | null;
  onClose: () => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({ item, onClose }) => {
  const { currentUser, setAuthModalOpen, isOnline, queueOfflineBooking, addNotification, addBooking } = usePadosiStore();
  
  // Default dates: tomorrow to day after
  const getTomorrow = (offset = 1) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getTomorrow(1));
  const [endDate, setEndDate] = useState(getTomorrow(2));
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!item) return null;

  const isOwner = currentUser?.id === item.ownerId;

  // Compute price
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const totalDays = isNaN(startMs) || isNaN(endMs) || endMs <= startMs 
    ? 1 
    : Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
  
  const totalPrice = totalDays * item.pricePerDay;

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }

    if (totalDays <= 0 || startDate === endDate) {
      setError("Return date must be at least 1 day after pickup date.");
      return;
    }

    setBookingLoading(true);

    // -------------------------------------------------------------------------
    // Offline-Tolerant Queueing Pattern
    // -------------------------------------------------------------------------
    if (!isOnline) {
      // Simulate/Save booking request in the offline Zustand queue!
      queueOfflineBooking({
        itemId: item.id,
        startDate,
        endDate,
        itemTitle: item.title
      });

      addNotification(`⏳ Borrow request for "${item.title}" queued in offline sync cache.`);
      setSuccess(true);
      setBookingLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/bookings/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({
          itemId: item.id,
          startDate,
          endDate
        })
      });

      const data = await response.json();
      
      if (response.status === 409) {
        throw new Error("Date overlap conflict! This resource has already been approved for overlapping dates.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit booking request.");
      }

      addBooking(data);
      addNotification(`✓ Borrow request sent for "${item.title}"!`);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 rounded-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Success confirmation */}
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-sage-500/10 border border-sage-500/20 text-sage-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="font-display font-black text-xl text-zinc-900 dark:text-white mb-2">
              {!isOnline ? "Queued Offline" : "Borrow Request Sent!"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-6">
              {!isOnline
                ? `Padosi secured your request locally. Once your device gets back online, we'll automatically sync your booking with owner ${item.ownerName}!`
                : `We requested to borrow "${item.title}" from ${item.ownerName}. You can coordinate handback times and pick up dates in the active activity workspace.`}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-sage-500 hover:bg-sage-600 text-white rounded-xl font-display text-xs font-semibold cursor-pointer transition-colors"
            >
              Back to Discover
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Image & Details */}
            <div className="space-y-4">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-48 object-cover rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-md"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="inline-block px-2.5 py-1 rounded-full bg-sage-500/10 text-[10px] font-bold text-sage-500 uppercase tracking-wider mb-2">
                  {item.category}
                </span>
                <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white leading-tight">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mt-2">
                  {item.description}
                </p>
              </div>

              {/* Security limits block */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/50 dark:border-zinc-850 flex items-center gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Wallet className="w-4 h-4 text-sage-500" />
                <span>Direct sharing between neighbors. No commercial escrow fees required.</span>
              </div>
            </div>

            {/* Right Column: Owner Trust & Booking Calendar */}
            <div className="flex flex-col justify-between space-y-4">
              
              {/* Owner Trust Header card */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src={item.ownerAvatar}
                    alt={item.ownerName}
                    className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left">
                    <span className="text-[10px] text-zinc-400 block leading-none font-medium uppercase tracking-wider">Owner Neighbor</span>
                    <span className="font-display font-bold text-xs text-zinc-900 dark:text-white mt-1 block">
                      {item.ownerName}
                    </span>
                  </div>
                </div>
                
                {/* Visual score gauge */}
                <TrustScoreGauge score={item.ownerTrustScore} size="sm" />
              </div>

              {/* Date selection & Calculation form */}
              <form onSubmit={handleBooking} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-950 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Offline warning */}
                {!isOnline && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-950 text-[11px] text-amber-700 dark:text-amber-400 flex gap-2 items-center leading-none">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Offline Sync Mode. Securing local request cache.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400 mb-1">
                      Borrow Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -tranzinc-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="date"
                        min={getTomorrow(1)}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white text-xs focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400 mb-1">
                      Return Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -tranzinc-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="date"
                        min={startDate || getTomorrow(2)}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white text-xs focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Bill calculations */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl space-y-2 text-xs text-zinc-600 dark:text-zinc-300 font-sans">
                  <div className="flex justify-between">
                    <span>Lending Rate:</span>
                    <span>₹{item.pricePerDay} / day</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sharing Period:</span>
                    <span className="font-mono">{totalDays} day{totalDays > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-900 dark:text-white border-t border-dashed border-zinc-200 dark:border-zinc-800/60 pt-2 text-sm font-display">
                    <span>Total Contribution:</span>
                    <span>₹{totalPrice}</span>
                  </div>
                </div>

                {isOwner ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-800/40 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 text-center">
                    This is your own listing. You can view borrow requests under My Activity.
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    {bookingLoading ? "Confirming..." : !currentUser ? "Sign In to Borrow" : "Request to Borrow Item"}
                  </button>
                )}
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
