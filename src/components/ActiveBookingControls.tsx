import React, { useState, useEffect, useRef } from "react";
import { usePadosiStore } from "../store";
import { Booking, ChatMessage } from "../types";
import { 
  CheckCircle, Clock, ShieldCheck, AlertCircle, Camera, MessageSquare, 
  Send, AlertTriangle, ShieldAlert, Sparkles, Scale, RefreshCw, Landmark 
} from "lucide-react";
import { TrustScoreGauge } from "./TrustScoreGauge";

interface ActiveBookingControlsProps {
  booking: Booking;
}

export const ActiveBookingControls: React.FC<ActiveBookingControlsProps> = ({ booking }) => {
  const { currentUser, addNotification, updateBookingInState } = usePadosiStore();
  const [loading, setLoading] = useState(false);
  const [aiComparing, setAiComparing] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMsgText, setNewMsgText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Condition upload states (represented as visual base64 mocks)
  const [photoPayload, setPhotoPayload] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const isOwner = currentUser?.id === booking.itemOwnerId;
  const isBorrower = currentUser?.id === booking.borrowerId;

  // Fetch chat messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/messages/${booking.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMessages();
    
    // Poll for messages in case websocket drops
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [booking.id]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen to incoming messages in real-time if they belong to active booking
  useEffect(() => {
    const storeMsgs = usePadosiStore.getState().messages;
    const bookingMsgs = storeMsgs.filter(m => m.bookingId === booking.id);
    if (bookingMsgs.length > 0) {
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const filtered = bookingMsgs.filter(m => !existingIds.has(m.id));
        return [...prev, ...filtered];
      });
    }
  }, [usePadosiStore.getState().messages]);

  const handleAction = async (action: string, customPhoto?: string, customNotes?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser?.id || "user_dev"
        },
        body: JSON.stringify({
          action,
          photo: customPhoto || photoPayload,
          notes: customNotes || notesText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to perform booking state action.");

      updateBookingInState(data);
      addNotification(`✓ Booking updated: status transitioned to [${data.status}]`);
      
      // Reset upload inputs
      setPhotoPayload(null);
      setNotesText("");
    } catch (err: any) {
      addNotification(`❌ Error updating booking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Trigger server-side visual photo condition comparison!
  const triggerAiVisualInspection = async () => {
    setAiComparing(true);
    try {
      addNotification("⏳ Automated visual comparison is scanning pickup & return frames side-by-side...");
      const response = await fetch(`/api/bookings/${booking.id}/compare-condition`, {
        method: "POST"
      });

      if (!response.ok) throw new Error("Inspection failed.");
      const data = await response.json();

      updateBookingInState(data.booking);
      addNotification("✓ Condition verification completed. Report generated in logs.");
    } catch (err: any) {
      addNotification(`❌ Visual scan error: ${err.message}`);
    } finally {
      setAiComparing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgText.trim()) return;

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser?.id || "user_dev"
        },
        body: JSON.stringify({
          bookingId: booking.id,
          content: newMsgText
        })
      });

      if (response.ok) {
        const msg = await response.json();
        setMessages(prev => [...prev, msg]);
        setNewMsgText("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simulated base64 photo uploader helper
  const handlePhotoMock = (stage: 'pickup' | 'return') => {
    // Generate beautiful inline high-contrast mock photos
    const mockPhotos = {
      pickup_drill: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&q=80",
      return_drill_clean: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&q=80",
      return_drill_scratched: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80" // different image to trigger visual AI!
    };

    const selectedPhoto = stage === 'pickup' 
      ? mockPhotos.pickup_drill 
      : Math.random() > 0.4 ? mockPhotos.return_drill_clean : mockPhotos.return_drill_scratched;

    setPhotoPayload(selectedPhoto);
    addNotification(`📸 Verification photo captured via camera context (${stage} verification)`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-left">
      
      {/* State Machine Status & Actions Columns */}
      <div className="lg:col-span-2 space-y-4">
        
        {/* State Machine Step visual bar */}
        <div className="p-4 bg-sage-50 dark:bg-[#121f19] border border-sage-200 dark:border-emerald-950/60 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display font-black text-xs uppercase tracking-wider text-sage-500 dark:text-[#4ade80]">
              Rental Handoff State Machine
            </span>
            <span className="px-2.5 py-1 rounded-full bg-sage-200 dark:bg-emerald-950 text-[10px] font-mono font-bold uppercase text-sage-700 dark:text-[#4ade80]">
              {booking.status}
            </span>
          </div>

          {/* Stepper bubbles */}
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-0 right-0 top-1/2 -tranzinc-y-1/2 h-0.5 bg-sage-200 dark:bg-emerald-950 z-0" />
            
            {['requested', 'approved', 'picked_up', 'returned', 'closed'].map((step, idx) => {
              const stages = ['requested', 'approved', 'picked_up', 'returned', 'closed', 'disputed'];
              const currentIdx = stages.indexOf(booking.status);
              const isActive = step === booking.status;
              const isCompleted = stages.indexOf(step) < currentIdx;

              return (
                <div key={step} className="flex flex-col items-center z-10 relative">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
                    isActive 
                      ? 'bg-sage-500 text-white ring-4 ring-sage-500/20' 
                      : isCompleted 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-white dark:bg-[#0c1612] border border-sage-200 dark:border-emerald-950 text-zinc-400'
                  }`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span className="text-[8px] font-display font-medium uppercase tracking-wider mt-1 text-zinc-500 dark:text-zinc-400">
                    {step.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Details Container */}
        <div className="p-6 bg-white dark:bg-[#121e18] border border-sage-200 dark:border-emerald-950/60 rounded-2xl shadow-sm">
          
          {/* Requested State */}
          {booking.status === "requested" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="w-5 h-5 shrink-0" />
                <h4 className="font-display font-bold text-sm">Waiting for Owner Confirmation</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Borrower requested this item for dates <strong className="font-mono text-sage-900 dark:text-white">{booking.startDate} to {booking.endDate}</strong>. 
                Owner must approve to secure dates for direct neighbor-to-neighbor sharing.
              </p>

              {isOwner && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold shadow-md cursor-pointer transition-colors"
                  >
                    Confirm & Approve Request
                  </button>
                  <button
                    onClick={() => handleAction("dispute", undefined, "Booking request declined by owner.")}
                    disabled={loading}
                    className="px-4 py-2 border border-sage-200 dark:border-emerald-950 text-zinc-500 dark:text-zinc-400 hover:bg-sage-100 dark:hover:bg-[#14261c] font-display text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Decline Request
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Approved State */}
          {booking.status === "approved" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <h4 className="font-display font-bold text-sm">Escrow Escorted! Ready for Neighborhood Pickup</h4>
              </div>
              
              <div className="p-3.5 bg-sage-50 dark:bg-emerald-950/20 rounded-xl border border-sage-200 dark:border-emerald-950/40 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="flex justify-between items-center font-semibold">
                  <span className="flex items-center gap-1">
                    <Landmark className="w-4 h-4 text-sage-500" />
                    Sharing Arrangement
                  </span>
                  <span className="text-emerald-600 font-mono font-bold">DIRECT HANDBACK</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Coordinate directly for handoff. No escrow or intermediate holds required!
                </p>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-sage-200 dark:border-emerald-950 bg-sage-50/50 dark:bg-emerald-950/10 space-y-3">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-sage-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  Item Condition Handoff Verification
                </span>
                
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  To protect your dispute liability, capture a visual photo of the item during handoff. Both owner and borrower can submit.
                </p>

                {photoPayload ? (
                  <div className="relative w-36 h-24 rounded-lg overflow-hidden border border-sage-500 shadow-md">
                    <img src={photoPayload} alt="Mock capture" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotoPayload(null)} className="absolute top-1 right-1 bg-black/60 p-1 rounded text-white text-[9px] font-bold">X</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePhotoMock('pickup')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage-500 text-sage-600 dark:text-emerald-400 font-display text-[11px] font-bold hover:bg-sage-500/10 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Snap Handoff Photo
                  </button>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAction("pickup")}
                    disabled={loading}
                    className="w-full py-2 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    Confirm Handoff Complete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Picked Up State */}
          {booking.status === "picked_up" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sage-500 dark:text-[#4ade80]">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <h4 className="font-display font-bold text-sm">Lending Session Active</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                The borrower currently has the item. Make sure to complete your chores and return it on time by <strong className="font-mono text-sage-900 dark:text-white">{booking.endDate}</strong>!
              </p>

              <div className="p-4 rounded-xl border border-dashed border-sage-200 dark:border-emerald-950 bg-sage-50/50 dark:bg-[#121f19]/40 space-y-3">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-sage-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  Return Handoff Condition Photos
                </span>
                
                <p className="text-[11px] text-zinc-500">
                  Verify the handback condition. Snap a photo of the item as you return/receive it.
                </p>

                {photoPayload ? (
                  <div className="relative w-36 h-24 rounded-lg overflow-hidden border border-sage-500 shadow-md">
                    <img src={photoPayload} alt="Mock capture" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotoPayload(null)} className="absolute top-1 right-1 bg-black/60 p-1 rounded text-white text-[9px] font-bold">X</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handlePhotoMock('return')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage-500 text-sage-600 dark:text-emerald-400 font-display text-[11px] font-bold hover:bg-sage-500/10 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Snap Return Photo
                  </button>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAction("return")}
                    disabled={loading}
                    className="w-full py-2 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                  >
                    Confirm Return Handback
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Returned State */}
          {booking.status === "returned" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <h4 className="font-display font-bold text-sm">Item Returned: Verification Phase</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                The item has been returned back to the owner. You can trigger an automated visual comparison audit to inspect differences and verify condition.
              </p>

              {/* Automated Visual Verification comparison board */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/5 to-sage-500/5 border border-emerald-500/20 dark:border-emerald-950 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-display font-bold text-[10px] uppercase tracking-wider text-sage-700 dark:text-[#4ade80] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                    Automated Visual Verification
                  </span>
                  
                  {booking.pickupPhotoBorrower && booking.returnPhotoBorrower && !booking.conditionReport && (
                    <button
                      onClick={triggerAiVisualInspection}
                      disabled={aiComparing}
                      className="px-2.5 py-1 bg-sage-500 text-white font-display text-[10px] font-bold rounded hover:bg-sage-600 cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${aiComparing ? 'animate-spin' : ''}`} />
                      Run Visual Compare
                    </button>
                  )}
                </div>

                {/* Display comparison photos if uploaded */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-bold">1. Handoff Photo</span>
                    {booking.pickupPhotoBorrower ? (
                      <img src={booking.pickupPhotoBorrower} className="w-full h-20 object-cover rounded-lg border border-sage-200 dark:border-emerald-950" />
                    ) : (
                      <div className="w-full h-20 bg-zinc-100 dark:bg-emerald-950/20 rounded-lg flex items-center justify-center text-[10px] text-zinc-400">No Photo</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-bold">2. Return Photo</span>
                    {booking.returnPhotoBorrower ? (
                      <img src={booking.returnPhotoBorrower} className="w-full h-20 object-cover rounded-lg border border-sage-200 dark:border-emerald-950" />
                    ) : (
                      <div className="w-full h-20 bg-zinc-100 dark:bg-emerald-950/20 rounded-lg flex items-center justify-center text-[10px] text-zinc-400">No Photo</div>
                    )}
                  </div>
                </div>

                {aiComparing && (
                  <div className="py-2 flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Comparing photo pixels for differences...</span>
                  </div>
                )}

                {booking.conditionReport ? (
                  <div className="p-3 bg-white dark:bg-[#0c1612] rounded-xl border border-emerald-500/15 dark:border-emerald-950/80 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">Visual Audit Report:</span>
                    {booking.conditionReport}
                  </div>
                ) : (
                  !booking.pickupPhotoBorrower && (
                    <p className="text-[10px] text-zinc-400 italic text-center">
                      Capture verification photos during pickup/return to run Visual Contrast Audit.
                    </p>
                  )
                )}
              </div>

              {isOwner && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAction("close")}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold shadow-md cursor-pointer transition-colors"
                  >
                    Approve & Finalize Sharing
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt("Describe the damage/dispute reason:");
                      if (reason) handleAction("dispute", undefined, reason);
                    }}
                    disabled={loading}
                    className="px-4 py-2 border border-terracotta-500 text-terracotta-500 hover:bg-red-500/10 font-display text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Raise Condition Dispute
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Closed State */}
          {booking.status === "closed" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-6 h-6 shrink-0" />
                <h4 className="font-display font-black text-sm">Sharing Complete! Settle and Settled</h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Both neighbors verified correct conditions and completed the handbacks directly. Rating finalized, and scores recalculated!
              </p>

              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                <span className="font-semibold">Sharing Arrangement:</span>
                <span className="font-mono font-bold">SUCCESSFULLY COMPLETED</span>
              </div>
            </div>
          )}

          {/* Disputed State */}
          {booking.status === "disputed" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="w-5 h-5 shrink-0 animate-bounce" />
                <h4 className="font-display font-black text-sm text-red-600 dark:text-red-400">Sharing Dispute: Condition Review Active</h4>
              </div>
              
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-950/60 rounded-xl text-xs text-red-700 dark:text-red-400 space-y-1">
                <span className="font-bold block uppercase tracking-wider text-[10px]">Dispute Notes:</span>
                <p>{booking.disputeNotes}</p>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Neighbors are reviewing visual condition contrast logs directly to reach a resolution.
              </p>

              {isOwner && (
                <button
                  onClick={() => handleAction("close")}
                  disabled={loading}
                  className="w-full py-2 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Resolve dispute and finalize sharing anyway
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Booking Live Chat Messages column */}
      <div className="flex flex-col h-[450px] border border-sage-200 dark:border-emerald-950/60 rounded-2xl bg-[#fdfbf7] dark:bg-[#121f19]/30 overflow-hidden shadow-sm">
        
        {/* Chat Title header */}
        <div className="px-4 py-3 border-b border-sage-200 dark:border-emerald-950/60 bg-sage-50 dark:bg-[#121f19] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sage-500" />
          <div className="flex flex-col text-left">
            <span className="font-display font-bold text-xs text-sage-900 dark:text-[#e8efe9]">Neighbor Chat</span>
            <span className="text-[8px] uppercase tracking-wider text-zinc-400 font-bold">Active Connection</span>
          </div>
        </div>

        {/* Chat Bubbles List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-1 px-4">
              <MessageSquare className="w-8 h-8 text-zinc-300 animate-pulse" />
              <p className="text-[10px] font-sans">No messages yet. Send a friendly note to arrange handoff location!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSender = msg.senderId === currentUser?.id;
              const isSystem = msg.senderId === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="inline-block px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-950/60 text-[9px] text-amber-700 dark:text-amber-400 font-semibold rounded-lg font-mono leading-relaxed">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-sm text-left ${
                    isSender 
                      ? 'bg-sage-500 text-[#fdfbf7] rounded-tr-none' 
                      : 'bg-white dark:bg-[#121e18] border border-sage-200 dark:border-emerald-950 text-zinc-800 dark:text-zinc-200 rounded-tl-none'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <span className={`text-[8px] block text-right mt-1 font-mono uppercase ${isSender ? 'text-white/60' : 'text-zinc-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Send message text box form */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-sage-200 dark:border-emerald-950/60 bg-sage-50 dark:bg-[#121f19] flex gap-2">
          <input
            type="text"
            placeholder="Type a neighborly coordinate message..."
            value={newMsgText}
            onChange={(e) => setNewMsgText(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-xs focus:outline-none"
          />
          <button
            type="submit"
            className="p-2 bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md cursor-pointer transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>

    </div>
  );
};
