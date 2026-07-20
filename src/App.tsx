import React, { useEffect, useState } from "react";
import { usePadosiStore } from "./store";
import { Header } from "./components/Header";
import { AuthModal } from "./components/AuthModal";
import { MapContainer } from "./components/MapContainer";
import { ListingDetailModal } from "./components/ListingDetailModal";
import { AddListingModal } from "./components/AddListingModal";
import { ActiveBookingControls } from "./components/ActiveBookingControls";
import { Item, Booking } from "./types";
import { 
  Plus, Calendar, MapPin, Sparkles, User, Info, 
  CheckCircle, ArrowRight, Heart, Trash2, 
  Shield, Zap, CheckCircle2, Star, Users, Leaf, Wrench, HelpCircle, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const {
    currentUser,
    setCurrentUser,
    items,
    setItems,
    bookings,
    setBookings,
    selectedItem,
    setSelectedItem,
    activeBooking,
    setActiveBooking,
    activeTab,
    setActiveTab,
    setDarkMode,
    setOnlineStatus,
    addNotification,
    isOnline,
    notifications,
    setAuthModalOpen,
    mapCenter,
    selectedCategory,
    distanceFilter
  } = usePadosiStore();

  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [activitySubTab, setActivitySubTab] = useState<'lent' | 'borrowed'>('borrowed');

  // Synchronized item filtering matching MapContainer
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const filteredItems = items.filter(item => {
    // Category filter
    if (selectedCategory !== "All" && item.category !== selectedCategory) {
      return false;
    }
    // Distance filter from active mapCenter
    const dist = getDistance(mapCenter[0], mapCenter[1], item.latitude, item.longitude);
    return dist <= distanceFilter;
  });

  // Popular Indian society items commonly requested in housing apartments
  const quickPresets = [
    {
      title: "Heavy Duty A-Frame Steel Ladder",
      description: "6-foot sturdy steel ladder. Extremely handy for cleaning high AC vents, fans, or putting up Diwali lights in balconies.",
      category: "Tools & DIY",
      price: 60,
      deposit: 800,
      imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Sujata 900W Mixer Grinder",
      description: "Heavy-duty mixer with 3 jars. Perfect for grinding fine idli-dosa batter, dry masala powders, or large batches of chutney.",
      category: "Kitchen Appliances",
      price: 150,
      deposit: 1500,
      imageUrl: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "Bosch Rotary Hammer Drill (GSB-13RE)",
      description: "High-impact masonry drill. Essential for hanging heavy portrait frames, installing wall mount TV brackets, or custom curtain rods.",
      category: "Tools & DIY",
      price: 180,
      deposit: 1000,
      imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80"
    },
    {
      title: "High Pressure Car Washer Gun Set",
      description: "1400W portable pressure washer. Ideal for deep cleaning dust/mud from SUVs, bikes, or dirty apartment balcony tiles on Sundays.",
      category: "Tools & DIY",
      price: 200,
      deposit: 2000,
      imageUrl: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&q=80"
    }
  ];

  // Load initial dataset & check profile sessions
  useEffect(() => {
    const initApp = async () => {
      // Apply default light theme class
      setDarkMode(false);

      try {
        // Fetch current user details
        const meResponse = await fetch("/api/users/me");
        if (meResponse.ok) {
          const user = await meResponse.json();
          setCurrentUser(user);

          // Fetch bookings for logged-in user
          const bookingsResponse = await fetch("/api/bookings", {
            headers: { "x-user-id": user.id }
          });
          if (bookingsResponse.ok) {
            const data = await bookingsResponse.json();
            setBookings(data);
          }
        }

        // Fetch item catalog list
        const itemsResponse = await fetch("/api/items");
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData);
        }
      } catch (err) {
        console.warn("Express backend offline or starting up, using mock dataset triggers.");
      }
    };

    initApp();

    // Setup PWA / Online state triggers
    const handleOnline = () => {
      setOnlineStatus(true);
      addNotification("✓ Connection restored. Your society sharing network is live!");
    };
    const handleOffline = () => {
      setOnlineStatus(false);
      addNotification("⚠️ Connection lost. Local storage safe caching is active.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync bookings list whenever user changes
  useEffect(() => {
    const fetchUserBookings = async () => {
      if (!currentUser) return;
      try {
        const res = await fetch("/api/bookings", {
          headers: { "x-user-id": currentUser.id }
        });
        if (res.ok) {
          const data = await res.json();
          setBookings(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUserBookings();
  }, [currentUser, activeTab]);

  // Handle deleting a listing
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to take down this listed resource? It will be removed from your neighbors' discover map.")) return;
    try {
      const res = await fetch(`/api/items/delete/${id}`, {
        method: "POST",
        headers: {
          "x-user-id": currentUser?.id || "user_dev"
        }
      });
      if (res.ok) {
        const itemsResponse = await fetch("/api/items");
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData);
          addNotification("✓ Listing taken down successfully!");
        }
      } else {
        const errData = await res.json();
        addNotification(`❌ Error deleting listing: ${errData.error}`);
      }
    } catch (err: any) {
      addNotification(`❌ Failed to delete item: ${err.message}`);
    }
  };

  // Quick List a preset item directly for the user's society
  const handleQuickList = async (preset: typeof quickPresets[0]) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const res = await fetch("/api/items/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id
        },
        body: JSON.stringify({
          title: preset.title,
          description: preset.description,
          category: preset.category,
          pricePerDay: preset.price,
          deposit: preset.deposit,
          latitude: 12.9352 + (Math.random() - 0.5) * 0.015, // Koramangala spread
          longitude: 77.6245 + (Math.random() - 0.5) * 0.015,
          imageUrl: preset.imageUrl
        })
      });
      if (res.ok) {
        const itemsRes = await fetch("/api/items");
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(data);
          addNotification(`🎉 Successfully listed "${preset.title}" in your society!`);
        }
      }
    } catch (err: any) {
      addNotification(`❌ Failed to quick-list item: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Platform Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-12 relative">
        
        {/* ================= HOME / LANDING PAGE ================= */}
        {activeTab === "home" && (
          <div className="space-y-16 py-4">
            
            {/* Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="lg:col-span-7 space-y-6 text-left"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sage-500/10 border border-sage-500/20 text-sage-500 text-xs font-bold font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  India's Hyperlocal Trust Revolution
                </div>
                
                <h1 className="font-display font-black text-4xl md:text-5xl lg:text-6xl tracking-tight text-zinc-900 dark:text-white leading-none">
                  Lend, Borrow, and
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-800 dark:from-white dark:via-zinc-200 dark:to-zinc-450">
                    Bond with Neighbors.
                  </span>
                </h1>
                
                <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                  Why buy home tools or appliances that sit in your loft 360 days a year? Padosi connects you directly with verified families in your apartment society or gated layout to share resources easily. No high costs, no clutter—just pure neighborly goodwill.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
                  <button
                    onClick={() => setActiveTab('explore')}
                    className="px-6 py-3 bg-sage-500 hover:bg-sage-600 text-white font-display text-sm font-bold rounded-2xl shadow-lg shadow-sage-500/20 hover:shadow-sage-500/35 transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer border-none"
                  >
                    <span>Start Borrowing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('lent')}
                    className="px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-850 font-display text-sm font-bold rounded-2xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <span>Start Lending Items</span>
                    <Plus className="w-4 h-4 text-sage-500" />
                  </button>
                </div>

                {/* Micro highlights */}
                <div className="pt-4 flex items-center gap-6 text-xs text-zinc-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-sage-500" /> Verified Neighbor Profiles
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-zinc-500" /> Direct P2P (Zero Margins)
                  </span>
                </div>
              </motion.div>

              {/* Hero Right Visual Column */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, x: 30 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="lg:col-span-5 relative"
              >
                {/* Decorative floating blurred spots */}
                <div className="absolute -top-10 -left-10 w-48 h-48 bg-sage-500/10 dark:bg-sage-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-zinc-500/10 dark:bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative rounded-3xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 p-4 shadow-xl">
                  {/* Premium Apartment Banner Image */}
                  <div className="h-56 w-full rounded-2xl overflow-hidden relative border border-zinc-100 dark:border-zinc-850">
                    <img 
                      src="https://images.unsplash.com/photo-1545231027-63b3f16260cd?auto=format&fit=crop&w=800&q=80" 
                      alt="Modern high-rise society block"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 text-left">
                      <span className="text-[9px] font-mono font-black tracking-widest text-white bg-zinc-950/60 backdrop-blur-sm px-2 py-0.5 rounded uppercase">
                        Srilaxmi Apartments
                      </span>
                      <h3 className="text-white font-display font-extrabold text-sm mt-1">
                        Active Sharing in Block C & D
                      </h3>
                    </div>
                  </div>

                  {/* Micro list showing successful transactions */}
                  <div className="mt-4 space-y-2.5 text-left">
                    <h4 className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-wider">
                      Recent Activity in Bangalore
                    </h4>
                    
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-850 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-sage-500/10 border border-sage-500/20 text-sage-500 flex items-center justify-center font-display font-bold text-xs shrink-0">
                          S
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">Sharma ji (C-402)</p>
                          <p className="text-[10px] text-zinc-400">Lent high impact hammer drill</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-500 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        ✓ COMPLETED
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-850 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-display font-bold text-xs shrink-0">
                          P
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">Priya Nair (A-1102)</p>
                          <p className="text-[10px] text-zinc-400">Borrowed steel a-frame ladder</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-sage-500 font-extrabold bg-sage-500/10 px-2 py-0.5 rounded-md">
                        ✓ SAVED ₹1,200
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Core Values Section */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="py-6 border-y border-zinc-200/60 dark:border-zinc-800/60 grid grid-cols-1 md:grid-cols-3 gap-8 text-left"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sage-500/10 text-sage-500 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white">Verified Security</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Only verified residents within your specific gated layout or apartment blocks can discover your listed resources. Keeping your items secure and close by.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sage-500/10 text-sage-500 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white">Hyperlocal Connection</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Avoid delivery waits, heavy shipping costs, or complex courier coordination. Coordinate hands-on pickup at the lobby, parking lot, or your neighbor's door.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white">Visual Condition Audit</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Worried about damage or scratches? Automatically compare condition photos taken before and after the borrow cycle to verify things objectively.
                </p>
              </div>
            </motion.div>

            {/* Indian Society Life Scenarios (Bento Grid) */}
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="font-display font-black text-2xl md:text-3xl tracking-tight text-zinc-900 dark:text-white">
                  Designed for Indian Apartment Living
                </h2>
                <p className="text-xs md:text-sm text-zinc-400 max-w-xl mx-auto">
                  Simple household situations where Padosi saves you storage space, money, and time.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Scenario 1 */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left"
                >
                  <div className="h-44 w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80" 
                      alt="Balcony maintenance"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sage-500 bg-sage-500/10 px-2.5 py-0.5 rounded">
                        SUNDAY BALCONY MAKEUP
                      </span>
                      <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white mt-1.5 leading-snug">
                        The Balcony Deep-Clean
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">
                        Hanging beautiful flower baskets, AC duct servicing, or washing off dust from heavy monsoons. Needs an A-frame steel ladder and drill. Why spend ₹3,500 on them to clutter your dry balcony forever?
                      </p>
                    </div>
                    <div className="pt-4 border-t border-dashed border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                      <span>Sharma ji has: Steel Ladder</span>
                      <span className="text-sage-500 font-extrabold cursor-pointer" onClick={() => setActiveTab('explore')}>BORROW →</span>
                    </div>
                  </div>
                </motion.div>

                {/* Scenario 2 */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left"
                >
                  <div className="h-44 w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80" 
                      alt="Society party"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-sage-500 bg-sage-500/10 px-2.5 py-0.5 rounded">
                        HOUSEWARMING POOJA & GET-TOGETHER
                      </span>
                      <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white mt-1.5 leading-snug">
                        Welcoming 15 Relatives
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">
                        Hosting dynamic pooja assemblies, kitty parties, or terrace barbecues. Needs plenty of extra plastic stool seating, folding dining tables, or premium tea kettle dispensers for high counts of guests.
                      </p>
                    </div>
                    <div className="pt-4 border-t border-dashed border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                      <span>Gupta ji has: Folding Chairs</span>
                      <span className="text-sage-500 font-extrabold cursor-pointer" onClick={() => setActiveTab('explore')}>BORROW →</span>
                    </div>
                  </div>
                </motion.div>

                {/* Scenario 3 */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between text-left"
                >
                  <div className="h-44 w-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&q=80" 
                      alt="SUV cleaning"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded">
                        SUNDAY CAR DETAILED CLEANING
                      </span>
                      <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white mt-1.5 leading-snug">
                        Balcony SUV pressure wash
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">
                        Muddy off-road trails in heavy rains can make your SUV dirty. Commercial service centers charge ₹800. A high-pressure washer gun gets it done in 20 minutes in your parking slot. Share the washer!
                      </p>
                    </div>
                    <div className="pt-4 border-t border-dashed border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                      <span>Priya has: Washer Gun Set</span>
                      <span className="text-sage-500 font-extrabold cursor-pointer" onClick={() => setActiveTab('explore')}>BORROW →</span>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>

            {/* Society Karma Leaderboard & Sustainable Impact Tracker */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch text-left">
              {/* Left Column: Sustainable Impact Tracker */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-extrabold uppercase tracking-widest font-mono">
                    <Leaf className="w-3.5 h-3.5" />
                    SOCIETY ECO BALANCE SHEET
                  </div>
                  <h3 className="font-display font-black text-2xl tracking-tight text-zinc-950 dark:text-white leading-none">
                    Hyperlocal Net Zero Goal
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    By sharing appliances, gardening gear, and ladders locally, Srilaxmi Apartments has successfully prevented unnecessary manufacturing overhead, shipping transport, and plastic duplicate packaging.
                  </p>

                  <div className="space-y-3 pt-2">
                    {/* Progress Bar 1 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Carbon Saved (CO₂)</span>
                        <span className="font-mono text-emerald-500">184 kg / 500 kg Goal</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: '36.8%' }} />
                      </div>
                    </div>

                    {/* Progress Bar 2 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1"><Trash2 className="w-3.5 h-3.5 text-red-500" /> Plastic Waste Prevented</span>
                        <span className="font-mono text-emerald-500">42 kg / 100 kg Goal</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: '42%' }} />
                      </div>
                    </div>

                    {/* Progress Bar 3 */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> Total Savings Generated</span>
                        <span className="font-mono text-emerald-500">₹24,500 Saved</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: '49%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-dashed border-zinc-100 dark:border-zinc-800/60 mt-4 flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span>Last recalculated: Real-time</span>
                  <span className="text-emerald-500 font-extrabold">ECO SHARING WORKFLOW ✓</span>
                </div>
              </motion.div>

              {/* Right Column: Society Karma Leaderboard */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-extrabold uppercase tracking-widest font-mono">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      SOCIETY KARMA LEADERBOARD
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">July 2026 Rankings</span>
                  </div>
                  
                  <div className="text-left">
                    <h3 className="font-display font-black text-2xl tracking-tight text-zinc-950 dark:text-white leading-none">
                      Block Neighbors of the Month
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Karma points are automatically gained when lending items on-time, maintaining pristine condition, and helping out neighbors.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {/* User 1 */}
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-850/40 flex items-center justify-between text-xs hover:border-amber-500/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-display font-extrabold text-sm border border-amber-500/20">
                          1
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center font-display font-bold text-zinc-700 shrink-0 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="S" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                            Sharma ji <span className="text-[10px] font-normal text-zinc-400">(C-402)</span>
                          </p>
                          <p className="text-[10px] text-zinc-400">Lent high impact hammer drill, steel ladder</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs font-mono font-black text-amber-500 block">
                          +980 Karma
                        </span>
                        <span className="text-[8px] font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase">
                          🌟 Golden Neighbor
                        </span>
                      </div>
                    </div>

                    {/* User 2 */}
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-850/40 flex items-center justify-between text-xs hover:border-emerald-500/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-display font-extrabold text-sm border border-zinc-300 dark:border-zinc-700">
                          2
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center font-display font-bold text-zinc-700 shrink-0 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80" alt="P" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                            Priya Nair <span className="text-[10px] font-normal text-zinc-400">(A-1102)</span>
                          </p>
                          <p className="text-[10px] text-zinc-400">Shared electric washer gun, AC maintenance set</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs font-mono font-black text-emerald-500 block">
                          +940 Karma
                        </span>
                        <span className="text-[8px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                          🌿 Green Champion
                        </span>
                      </div>
                    </div>

                    {/* User 3 */}
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-850/40 flex items-center justify-between text-xs hover:border-zinc-400/30 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-display font-extrabold text-sm border border-zinc-300 dark:border-zinc-700">
                          3
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center font-display font-bold text-zinc-700 shrink-0 overflow-hidden">
                          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" alt="G" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                            Gupta Family <span className="text-[10px] font-normal text-zinc-400">(D-102)</span>
                          </p>
                          <p className="text-[10px] text-zinc-400">Lent folding dining tables, guest plastic stools</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-xs font-mono font-black text-zinc-600 dark:text-zinc-300 block">
                          +910 Karma
                        </span>
                        <span className="text-[8px] font-mono font-bold text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-full uppercase">
                          🤝 Super Helper
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Indian Tea / Neighborly Trust Tea Corner card banner */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 md:p-10 rounded-3xl bg-zinc-900 text-white relative overflow-hidden text-left shadow-lg border border-zinc-800"
            >
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 md:opacity-40 pointer-events-none">
                <img 
                  src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80" 
                  alt="Neighborly Chai"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-transparent to-transparent" />
              </div>

              <div className="relative z-10 max-w-lg space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-500/20 border border-sage-500/30 text-white text-[10px] font-extrabold uppercase tracking-widest">
                  <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /> Neighborly Chai Connection
                </span>
                <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight leading-none text-white">
                  Build Harmony, One Shared Cup at a Time
                </h3>
                <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
                  Padosi is more than just transactions; it's about re-discovering the age-old community spirit of Indian societies. Share an extra blender or drill, discuss how to maintain balcony plants over hot evening tea, and turn apartment buildings into a warm, sustainable family.
                </p>
                <div className="pt-3">
                  <button 
                    onClick={() => setActiveTab('explore')}
                    className="px-5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-display text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md shadow-zinc-950/20 border-none"
                  >
                    Start Exploring Society map
                  </button>
                </div>
              </div>
            </motion.div>

          </div>
        )}

        {/* ================= PAGE 1: START BORROWING ================= */}
        {activeTab === "explore" && (
          <div className="space-y-8 flex flex-col flex-1">
            
            {/* Elegant Indian Society Hero Card */}
            <motion.div 
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative p-6 md:p-8 rounded-3xl bg-gradient-to-br from-zinc-50 via-zinc-100/50 to-transparent dark:from-zinc-900 dark:via-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden text-left"
            >
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 bg-sage-500/10 dark:bg-sage-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3 max-w-3xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-500/10 border border-sage-500/20 text-sage-500 text-[10px] font-extrabold uppercase tracking-widest font-mono">
                    <Users className="w-3.5 h-3.5" />
                    Trusted Society Resource Sharing
                  </div>
                  
                  <h1 className="font-display font-black text-3xl md:text-4xl lg:text-4xl tracking-tight text-zinc-950 dark:text-white leading-none">
                    Padosi
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-300 font-bold"> - Hyperlocal Resource Sharing</span>
                  </h1>
                  
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                    Why buy things you only use once? Borrow premium ladders, drills, appliances, or party folding chairs directly from verified apartment neighbors. Secure handoffs built on mutual respect and local community trust.
                  </p>
                </div>
                
                {/* Visual stats panel */}
                <div className="grid grid-cols-2 gap-4 w-full lg:w-auto shrink-0 font-display">
                  <div className="p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 text-center shadow-sm">
                    <span className="text-2xl font-mono font-black text-sage-500 block">
                      1,480+
                    </span>
                    <span className="text-[10px] text-zinc-400 block font-bold mt-0.5 uppercase tracking-wider">Active Neighbors</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800/50 text-center shadow-sm">
                    <span className="text-2xl font-mono font-black text-emerald-500 block">
                      ₹35,400+
                    </span>
                    <span className="text-[10px] text-zinc-400 block font-bold mt-0.5 uppercase tracking-wider">Money Saved</span>
                  </div>
                </div>
              </div>
              
              {/* Trust features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-200/60 dark:border-zinc-800/40 pt-5 mt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sage-500/10 text-sage-500 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white leading-none">100% Direct P2P</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Lend and borrow directly. Zero intermediary fees.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sage-500/10 text-sage-500 rounded-xl">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white leading-none">Smart Neighborhood Search</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Use descriptive terms to find matching items instantly.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sage-500/10 text-sage-500 rounded-xl">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white leading-none">Sustainable Living</h4>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Reduce e-waste and support local society bonding.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Split explore experience columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[500px]">
              
              {/* Left Column: Item Grid Catalog */}
              <div className="lg:col-span-5 space-y-4 flex flex-col max-h-[85vh]">
                
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="text-left">
                    <h2 className="font-display font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                      Discover Shared Items
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      High-quality goods listed around your block
                    </p>
                  </div>
                </div>

                {/* Items feed card lists with motion animation */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
                  <AnimatePresence mode="popLayout">
                    {filteredItems.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white/50 dark:bg-zinc-900/10 text-zinc-400"
                      >
                        <Info className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                        <p className="text-xs font-semibold">No nearby items found matching this criteria.</p>
                      </motion.div>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.25 }}
                          whileHover={{ scale: 1.01, x: 3 }}
                          onClick={() => setSelectedItem(item)}
                          className="p-3.5 flex gap-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/60 rounded-2xl hover:border-sage-500 dark:hover:border-sage-500 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md relative overflow-hidden group"
                        >
                          {/* Rating tag overlay on image */}
                          <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-zinc-950/70 backdrop-blur-sm rounded-md text-[8px] font-mono font-black text-amber-400 flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400 stroke-none" />
                              {item.id.charCodeAt(0) % 2 === 0 ? "4.9" : "4.8"}
                            </div>
                          </div>

                          <div className="flex-1 text-left flex flex-col justify-between py-0.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-sage-500 bg-sage-500/10 px-2 py-0.5 rounded-md">
                                  {item.category}
                                </span>
                                <span className="text-[8px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                  VERIFIED
                                </span>
                              </div>
                              
                              <h4 className="font-display font-bold text-xs text-zinc-900 dark:text-white leading-tight group-hover:text-sage-500 transition-colors">
                                {item.title}
                              </h4>
                              
                              <p className="text-[9px] text-zinc-400">
                                Hosted by {item.ownerName} • Society Neighbor
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-dashed border-zinc-100 dark:border-zinc-800/60">
                              <span className="font-display font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">
                                ₹{item.pricePerDay} <span className="text-[9px] font-sans text-zinc-400 font-normal">/ day</span>
                              </span>
                              <span className="flex items-center gap-1 text-[8px] text-zinc-500 dark:text-zinc-300 font-bold bg-zinc-100 dark:bg-zinc-800/40 px-2 py-0.5 rounded-lg">
                                <MapPin className="w-2.5 h-2.5 text-sage-500" />
                                Bangalore
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Column: Map Experience */}
              <div className="lg:col-span-7 flex flex-col min-h-[480px]">
                <MapContainer onSelectItem={(item) => setSelectedItem(item)} />
              </div>

            </div>
          </div>
        )}


        {/* ================= PAGE 2: START LENDING ================= */}
        {activeTab === "lent" && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto w-full space-y-8 text-left"
          >
            {/* Lending banner introduction */}
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-zinc-500/5 via-zinc-700/5 to-transparent border border-zinc-200 dark:border-zinc-800 relative overflow-hidden text-left">
              <div className="absolute right-0 bottom-0 w-64 h-64 bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-500/10 text-sage-500 text-[10px] font-bold uppercase tracking-wider font-mono">
                  <Leaf className="w-3.5 h-3.5" />
                  SOCIETY KARMA ENGINE
                </div>
                <h2 className="font-display font-black text-2xl text-zinc-900 dark:text-white leading-none">
                  Lend Unused Gear & Build Society Trust
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Have things sitting in your storage box like an extra-large folding table, steel ladder, power drill, or heavy iron? List them for neighbors to borrow. It takes 2 minutes and helps create a collaborative, friendly apartment society.
                </p>
                
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (!currentUser) setAuthModalOpen(true);
                      else setAddModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-display text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sage-500/10 cursor-pointer transition-all hover:scale-105 border-none"
                  >
                    <Plus className="w-4 h-4" />
                    List a New Resource
                  </button>
                </div>
              </div>
            </div>

            {/* Quick List Indian Society Presets Grid */}
            <div className="space-y-4">
              <div className="flex flex-col text-left">
                <h3 className="font-display font-extrabold text-base tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
                  Popular Society Items we borrow
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                </h3>
                <p className="text-xs text-zinc-400">
                  Tap any preset below to instantly list it for your neighborhood block in Bangalore.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickPresets.map((preset, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col justify-between hover:border-sage-500/50 transition-all shadow-sm group"
                  >
                    <div className="space-y-2 text-left">
                      <div className="h-28 w-full rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                        <img 
                          src={preset.imageUrl} 
                          alt={preset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="font-display font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-1">
                          {preset.title}
                        </h4>
                        <span className="text-[9px] font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
                          ₹{preset.price}/d
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleQuickList(preset)}
                      className="w-full mt-4 py-1.5 bg-zinc-100 hover:bg-sage-500/10 dark:bg-zinc-800 dark:hover:bg-sage-500/20 text-zinc-700 dark:text-zinc-300 hover:text-sage-500 font-display text-[10px] font-black rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border-none"
                    >
                      <Plus className="w-3 h-3" />
                      Quick List Preset
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* User Active Listings Catalogs */}
            <div className="space-y-4 pt-4">
              <div className="text-left border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h3 className="font-display font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                  Your Active Listings
                </h3>
                <p className="text-xs text-zinc-400">
                  Manage the items you've made available for borrowing in the local society catalog.
                </p>
              </div>

              {currentUser && items.filter(item => item.ownerId === currentUser.id).length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/40">
                  <Wrench className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                  <h4 className="font-display font-bold text-xs text-zinc-500">No active shared listings yet</h4>
                  <p className="text-[10px] text-zinc-400 max-w-sm mx-auto mt-1">
                    You haven't listed any items. Use the "Quick List Presets" above or list a custom item using the "List a New Resource" button to begin!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentUser && items.filter(item => item.ownerId === currentUser.id).map((item) => (
                    <motion.div
                      key={item.id}
                      layoutId={`item-${item.id}`}
                      className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex gap-4 items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded-xl border border-zinc-100 dark:border-zinc-800"
                        />
                        <div className="text-left space-y-0.5">
                          <span className="text-[8px] uppercase tracking-wider text-sage-500 font-bold font-mono">
                            {item.category}
                          </span>
                          <h4 className="font-display font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-tight">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            ₹{item.pricePerDay} / day • Deposit: ₹{item.deposit}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl cursor-pointer transition-colors"
                        title="Delete Listing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        )}


        {/* ================= PAGE 3: MY ACTIVITY ================= */}
        {activeTab === "dashboard" && (
          <div className="max-w-5xl mx-auto w-full space-y-6 text-left animate-fade-in">
            
            {/* Main user profile recap card */}
            {currentUser && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-full border-2 border-sage-500 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-center md:text-left space-y-1">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <h3 className="font-display font-black text-lg text-zinc-900 dark:text-white">
                        {currentUser.name}
                      </h3>
                      {currentUser.trustScore === null && (
                        <span className="px-2 py-0.5 bg-sage-500/10 border border-sage-500/30 text-[9px] font-bold rounded-full text-sage-500">
                          New Neighbor Karma
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">Verified Mobile: {currentUser.phoneNumber}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Member since {new Date(currentUser.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Score visualization panel */}
                <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800/60 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-around">
                  <div className="text-center">
                    <span className="text-lg font-mono font-bold text-zinc-800 dark:text-white">
                      {currentUser.reviewsCount}
                    </span>
                    <span className="text-[9px] block uppercase tracking-wider text-zinc-400 font-bold mt-0.5">Karma Reviews</span>
                  </div>
                  <div className="text-center">
                    <span className="text-lg font-mono font-bold text-zinc-800 dark:text-white">
                      {currentUser.onTimeReturnRate}%
                    </span>
                    <span className="text-[9px] block uppercase tracking-wider text-zinc-400 font-bold mt-0.5">On Time</span>
                  </div>
                  <div className="text-center">
                    <span className="text-lg font-mono font-bold text-red-500">
                      {currentUser.disputeHistoryCount}
                    </span>
                    <span className="text-[9px] block uppercase tracking-wider text-zinc-400 font-bold mt-0.5">Disputes</span>
                  </div>
                </div>
              </div>
            )}

            {/* Booking listings dashboards subtab selectors */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-1 gap-4">
              <button
                onClick={() => {
                  setActivitySubTab('borrowed');
                  setActiveBooking(null);
                }}
                className={`pb-2 px-2 font-display text-xs font-bold relative cursor-pointer ${
                  activitySubTab === 'borrowed'
                    ? 'text-sage-500'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Borrowed Goods Activity
                {activitySubTab === 'borrowed' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500" />
                )}
              </button>
              <button
                onClick={() => {
                  setActivitySubTab('lent');
                  setActiveBooking(null);
                }}
                className={`pb-2 px-2 font-display text-xs font-bold relative cursor-pointer ${
                  activitySubTab === 'lent'
                    ? 'text-sage-500'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Lent Goods Activity
                {activitySubTab === 'lent' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500" />
                )}
              </button>
            </div>

            {/* Dashboard Lists display */}
            {!activeBooking ? (
              <div className="space-y-3">
                {bookings.filter(b => activitySubTab === 'borrowed' ? b.borrowerId === currentUser?.id : b.itemOwnerId === currentUser?.id).length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900/40">
                    <Calendar className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <h4 className="font-display font-bold text-xs text-zinc-500">No active coordination agreements</h4>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-sm mx-auto">
                      {activitySubTab === 'borrowed' 
                        ? "Browse active listings in Start Borrowing and send an request to get started!"
                        : "Your items requested by neighbors will list here. You can chat, confirm, and verify handbacks."}
                    </p>
                  </div>
                ) : (
                  bookings
                    .filter(b => activitySubTab === 'borrowed' ? b.borrowerId === currentUser?.id : b.itemOwnerId === currentUser?.id)
                    .map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => setActiveBooking(booking)}
                        className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 cursor-pointer hover:border-sage-500 transition-all"
                      >
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <img
                            src={booking.itemImageUrl}
                            alt={booking.itemTitle}
                            className="w-12 h-12 object-cover rounded-xl border border-zinc-100 dark:border-zinc-800"
                          />
                          <div className="text-left space-y-0.5">
                            <span className="text-[8px] uppercase tracking-wider text-sage-500 font-black block">
                              Agreement Code: #{booking.id.slice(-5)}
                            </span>
                            <h4 className="font-display font-black text-xs text-zinc-900 dark:text-white leading-tight">
                              {booking.itemTitle}
                            </h4>
                            <p className="text-[10px] text-zinc-400">
                              Dates: {booking.startDate} to {booking.endDate}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-dashed border-zinc-200 dark:border-zinc-800/60">
                          <div className="text-left md:text-right">
                            <span className="text-[8px] text-zinc-400 block font-bold uppercase tracking-wider">Lending Neighbor</span>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {activitySubTab === 'borrowed' ? booking.itemOwnerId : booking.borrowerName}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-850 text-[9px] font-mono font-black text-zinc-700 dark:text-sage-500 uppercase tracking-wider">
                              {booking.status}
                            </span>
                            <ArrowRight className="w-4 h-4 text-sage-500" />
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            ) : (
              /* Active Booking Details Action Workspace */
              <div className="space-y-4">
                <button
                  onClick={() => setActiveBooking(null)}
                  className="px-4 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-display font-semibold rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                >
                  ← Back to activity list
                </button>
                <ActiveBookingControls booking={activeBooking} />
              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer Branding credits */}
      <footer className="py-6 border-t border-zinc-200 dark:border-zinc-800 text-center text-zinc-400 dark:text-zinc-600 text-xs font-display flex flex-col sm:flex-row items-center justify-between px-8 gap-4 select-none mt-auto">
        <span>© 2026 Padosi - A Hyperlocal Resource Sharing Platform. All rights reserved.</span>
        <div className="flex items-center gap-1">
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          <span>Lending and borrowing directly to support beautiful housing societies.</span>
        </div>
      </footer>

      {/* Modals overlays */}
      <AuthModal />
      <ListingDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
      <AddListingModal 
        isOpen={isAddModalOpen} 
        onClose={() => setAddModalOpen(false)} 
      />

    </div>
  );
}
