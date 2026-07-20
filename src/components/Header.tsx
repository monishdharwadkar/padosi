import React from "react";
import { usePadosiStore } from "../store";
import { Sun, Moon, MapPin, Wifi, WifiOff, RefreshCw, Key, UserCheck, LogOut } from "lucide-react";

export const Header: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    isDarkMode,
    setDarkMode,
    setAuthModalOpen,
    isOnline,
    offlineQueue,
    connectionStatus,
    activeTab,
    setActiveTab,
    clearOfflineQueue,
    addNotification
  } = usePadosiStore();

  const handleSyncOffline = async () => {
    if (!isOnline) {
      addNotification("⚠️ Cannot sync bookings while offline. Try connecting to Wi-Fi!");
      return;
    }

    addNotification("⏳ Synchronizing offline queue with neighborhood backend...");
    try {
      const userId = currentUser?.id || "user_dev";
      
      for (const booking of offlineQueue) {
        const response = await fetch("/api/bookings/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId
          },
          body: JSON.stringify({
            itemId: booking.itemId,
            startDate: booking.startDate,
            endDate: booking.endDate
          })
        });
        
        if (!response.ok) {
          throw new Error(`Sync failed for item "${booking.itemTitle}"`);
        }
      }

      // Success sync
      clearOfflineQueue();
      addNotification("✓ Successfully synced and secured all pending borrow requests!");
      
      // Re-fetch bookings
      const bookingsRes = await fetch("/api/bookings", {
        headers: { "x-user-id": userId }
      });
      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        usePadosiStore.getState().setBookings(data);
      }

    } catch (err: any) {
      console.error(err);
      addNotification(`❌ Error during synchronization: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    addNotification("Signed out. See you soon, neighbor!");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-6">
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-sage-500 flex items-center justify-center text-white font-display font-bold text-xl shadow-md shadow-sage-500/20">
            P
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-black text-base tracking-tight leading-none text-zinc-900 dark:text-white">
              Padosi
            </h1>
            <span className="text-[9px] uppercase tracking-wider font-mono text-sage-500 dark:text-zinc-400 font-extrabold">
              Society Share Platform
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Available on all devices, scrollable on mobile) */}
        <nav className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl max-w-full overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-display transition-all shrink-0 ${
              activeTab === 'home'
                ? 'bg-sage-500 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-display transition-all shrink-0 ${
              activeTab === 'explore'
                ? 'bg-sage-500 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Start Borrowing
          </button>
          <button
            onClick={() => {
              if (!currentUser) setAuthModalOpen(true);
              else setActiveTab('lent');
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-display transition-all shrink-0 ${
              activeTab === 'lent'
                ? 'bg-sage-500 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Start Lending
          </button>
          <button
            onClick={() => {
              if (!currentUser) setAuthModalOpen(true);
              else setActiveTab('dashboard');
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-bold font-display transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-sage-500 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            My Activity
          </button>
        </nav>
      </div>

      {/* Network Status & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Offline Queue Sync Action Button */}
        {offlineQueue.length > 0 && (
          <button
            onClick={handleSyncOffline}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-display text-[10px] font-bold shadow-md shadow-amber-500/20 animate-bounce cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            Sync {offlineQueue.length} Bookings
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!isDarkMode)}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer"
          aria-label="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Auth / Account Profile */}
        {currentUser ? (
          <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-3">
            <div 
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-1.5 cursor-pointer group"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full border border-sage-500 group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
              />
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="font-display font-bold text-xs text-zinc-900 dark:text-white">
                  {currentUser.name}
                </span>
                <span className="text-[8px] font-mono text-zinc-500 dark:text-zinc-400">
                  {currentUser.phoneNumber}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-semibold rounded-xl shadow-md cursor-pointer transition-colors"
          >
            <Key className="w-3.5 h-3.5" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
