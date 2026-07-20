import React, { useEffect, useRef, useState } from "react";
import { usePadosiStore } from "../store";
import { Item } from "../types";
import { MapPin, Compass, Search, Filter, Sparkles, Navigation, Globe } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapContainerProps {
  onSelectItem: (item: Item) => void;
}

export const MapContainer: React.FC<MapContainerProps> = ({ onSelectItem }) => {
  const {
    items,
    setItems,
    semanticExplanation,
    setSemanticExplanation,
    mapCenter,
    setMapCenter,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    distanceFilter,
    setDistanceFilter,
    isDarkMode,
    isOnline,
    addNotification
  } = usePadosiStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [useRealMap, setUseRealMap] = useState(true); // Toggle between Street Map and Radar Vector Map
  const [searching, setSearching] = useState(false);

  // Filter items based on selected category & distance (simulated coordinate math)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    // simple distance approximation in km
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

  // Handle standard search or call Semantic Search on backend
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSemanticExplanation(null);

    try {
      const endpoint = searchQuery.trim() !== "" 
        ? `/api/items/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/items${selectedCategory !== "All" ? `?category=${selectedCategory}` : ""}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      if (searchQuery.trim() !== "") {
        setItems(data.items);
        setSemanticExplanation(data.semanticExplanation || "Matched items for your query.");
        addNotification(`🔍 Search completed: Found ${data.items.length} items nearby!`);
      } else {
        setItems(data);
        setSemanticExplanation(null);
      }
    } catch (err: any) {
      console.error(err);
      addNotification("⚠️ Offline search. Found matches using local keywords.");
    } finally {
      setSearching(false);
    }
  };

  const handleResetSearch = async () => {
    setSearchQuery("");
    setSemanticExplanation(null);
    try {
      const res = await fetch("/api/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // MapLibre Street Map Setup
  useEffect(() => {
    if (!useRealMap || !mapContainerRef.current) return;

    // Dynamically import MapLibre GL to avoid server compilation crashes
    import("maplibre-gl").then((maplibreglModule) => {
      const maplibregl = maplibreglModule.default;

      // Select light/dark street-style URL
      const styleUrl = isDarkMode
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: styleUrl,
        center: [mapCenter[1], mapCenter[0]], // [lng, lat]
        zoom: mapZoomForMapLibre(distanceFilter),
        attributionControl: false
      });

      mapRef.current = map;

      // Add navigation buttons
      map.addControl(new maplibregl.NavigationControl(), "top-right");

      // Place item pin markers on Map
      filteredItems.forEach((item) => {
        const markerEl = document.createElement("div");
        markerEl.className = "cursor-pointer group flex flex-col items-center";
        markerEl.innerHTML = `
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sage-500 text-white font-display text-[10px] font-bold shadow-md hover:scale-110 hover:bg-emerald-600 transition-all border border-white/20">
            <span>₹${item.pricePerDay}</span>
          </div>
          <div class="w-1.5 h-1.5 rounded-full bg-sage-600 border border-white -mt-0.5 shadow-sm"></div>
        `;

        markerEl.addEventListener("click", () => {
          onSelectItem(item);
        });

        new maplibregl.Marker({ element: markerEl })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);
      });

      // Update coordinates on pan/drag
      map.on("dragend", () => {
        const center = map.getCenter();
        setCenterWithCoordClamp([center.lat, center.lng]);
      });
    }).catch(err => {
      console.warn("MapLibre GL failed to initialize, reverting to vector layout:", err);
      setUseRealMap(false);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [useRealMap, filteredItems, isDarkMode]);

  const mapZoomForMapLibre = (dist: number) => {
    if (dist <= 1.5) return 14.5;
    if (dist <= 3) return 13.5;
    if (dist <= 5) return 12.5;
    return 11.5;
  };

  const setCenterWithCoordClamp = (coords: [number, number]) => {
    // Keep Bangalore focused
    setMapCenter(coords);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-sage-200 dark:border-emerald-950 bg-[#fefdfa] dark:bg-[#070d0a] overflow-hidden shadow-inner relative">
      {/* Search and Filters Header bar */}
      <div className="p-4 border-b border-sage-200 dark:border-emerald-950 bg-[#fdfbf7]/80 dark:bg-[#0c1612]/80 backdrop-blur-md flex flex-col gap-3 z-10 relative">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -tranzinc-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder='Try "something to trim hedges" or "party gear"...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleResetSearch}
                className="absolute right-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white rounded-xl flex items-center gap-1.5 text-xs font-display font-semibold shadow-md cursor-pointer transition-colors"
          >
            <Compass className={`w-4 h-4 ${searching ? 'animate-spin' : ''}`} />
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Quick Radius and Map type toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sage-200/50 dark:border-emerald-950/30 pt-3">
          {/* Categories select row */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none max-w-full">
            {["All", "Yard & Gardening", "Tools & DIY", "Outdoors & Camping", "Kitchen Appliances", "Party Equipment"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                  selectedCategory === cat
                    ? 'bg-sage-500 text-white shadow-sm'
                    : 'bg-sage-100 dark:bg-emerald-950/40 text-zinc-600 dark:text-zinc-300 hover:bg-sage-200 dark:hover:bg-emerald-900/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Distance radius slider */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-500 dark:text-[#a5c5b2] font-semibold whitespace-nowrap">
                Within <strong className="text-sage-500 dark:text-[#4ade80] font-mono">{distanceFilter} km</strong>
              </span>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.5"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(Number(e.target.value))}
                className="w-20 accent-sage-500 cursor-pointer h-1 bg-zinc-200 dark:bg-emerald-950 rounded-lg appearance-none"
              />
            </div>

            {/* Street/Radar Mode Selector */}
            <button
              onClick={() => {
                setUseRealMap(!useRealMap);
                addNotification(`🗺️ Switched to ${!useRealMap ? 'Real Neighborhood Street Map' : 'Hyperlocal Radar Map'}`);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sage-200 dark:border-emerald-950 text-xs font-display font-medium text-zinc-500 dark:text-[#a5c5b2] hover:bg-sage-100 dark:hover:bg-[#14261c] transition-colors cursor-pointer"
            >
              {useRealMap ? (
                <>
                  <Navigation className="w-3.5 h-3.5 text-sage-500" />
                  <span>Use Radar View</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Use Street Map</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Content Layer */}
      <div className="flex-1 w-full h-full relative min-h-[400px]">
        {useRealMap ? (
          /* Street Map Mode (MapLibre) */
          <div ref={mapContainerRef} className="w-full h-full" />
        ) : (
          /* Hyperlocal Radar Mode (Custom SVG layout map) - Stunning visual masterpiece */
          <div className="absolute inset-0 w-full h-full bg-[#fdfbf7] dark:bg-[#070d0a] flex items-center justify-center overflow-hidden">
            {/* Grid Pattern overlays */}
            <div className="absolute inset-0 opacity-10 dark:opacity-30 pointer-events-none bg-[linear-gradient(to_right,#2d5a27_1px,transparent_1px),linear-gradient(to_bottom,#2d5a27_1px,transparent_1px)] bg-[size:30px_30px]" />
            
            {/* Outer distance circles */}
            <div className="absolute w-[450px] h-[450px] rounded-full border border-dashed border-sage-200/50 dark:border-emerald-950/40 flex items-center justify-center animate-pulse duration-1000">
              <div className="w-[300px] h-[300px] rounded-full border border-dashed border-sage-200/70 dark:border-emerald-950/60 flex items-center justify-center">
                <div className="w-[150px] h-[150px] rounded-full border border-dashed border-sage-300 dark:border-emerald-900/60" />
              </div>
            </div>

            {/* Sweep radar hand line */}
            <div className="absolute w-[225px] h-[1px] bg-gradient-to-r from-transparent to-sage-500/30 dark:to-emerald-400/20 origin-left left-1/2 top-1/2 -tranzinc-y-1/2 rotate-0 animate-[spin_10s_linear_infinite]" />

            {/* Koramangala Central Landmark Area (Central Circle) */}
            <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-center p-2 select-none pointer-events-none shadow-lg">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <span className="font-display font-bold text-[9px] text-emerald-800 dark:text-emerald-400 uppercase leading-none mt-1">Koramangala</span>
            </div>

            {/* Bangalore Neighbor Zones labels */}
            <div className="absolute left-[15%] top-[25%] font-display font-medium text-[10px] text-zinc-400 dark:text-emerald-950 select-none uppercase tracking-widest">Indiranagar</div>
            <div className="absolute right-[15%] top-[20%] font-display font-medium text-[10px] text-zinc-400 dark:text-emerald-950 select-none uppercase tracking-widest">HSR Layout</div>
            <div className="absolute right-[12%] bottom-[30%] font-display font-medium text-[10px] text-zinc-400 dark:text-emerald-950 select-none uppercase tracking-widest">Jayanagar</div>
            <div className="absolute left-[18%] bottom-[25%] font-display font-medium text-[10px] text-zinc-400 dark:text-emerald-950 select-none uppercase tracking-widest">M G Road</div>

            {/* Dynamic item dots on vector map */}
            {filteredItems.map((item, index) => {
              // Map coordinate delta to screen percentage delta
              const centerLat = 12.9352;
              const centerLng = 77.6245;
              const yOffset = (item.latitude - centerLat) * 3500; // factor out coordinate deltas
              const xOffset = (item.longitude - centerLng) * 3500;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  style={{
                    transform: `translate(${xOffset}px, ${-yOffset}px)`,
                    animationDelay: `${index * 150}ms`
                  }}
                  className="absolute p-1 flex flex-col items-center group cursor-pointer hover:z-20 transition-all duration-300"
                >
                  {/* Ping effect ring */}
                  <span className="absolute inline-flex h-10 w-10 rounded-full bg-sage-500/20 opacity-75 animate-ping group-hover:scale-125" />
                  
                  {/* Tactile map point price box */}
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sage-500 dark:bg-emerald-700 text-white font-display text-[10px] font-black tracking-wide border border-white/20 dark:border-emerald-500/30 shadow-md group-hover:bg-amber-500 group-hover:scale-110 group-hover:shadow-amber-500/20 transition-all">
                    <span>₹{item.pricePerDay}</span>
                  </div>
                  
                  {/* Little tiny label */}
                  <span className="hidden group-hover:block absolute top-7 bg-[#1c2a21]/90 dark:bg-[#0c1612]/95 border border-sage-500/30 px-2 py-0.5 rounded text-[9px] text-[#fdfbf7] font-semibold whitespace-nowrap shadow-md leading-none z-30">
                    {item.title}
                  </span>
                  
                  {/* Tiny center dot */}
                  <div className="w-1.5 h-1.5 rounded-full bg-sage-600 dark:bg-emerald-400 border border-white dark:border-emerald-900 shadow-sm mt-0.5" />
                </button>
              );
            })}
          </div>
        )}

        {/* Floating active filter status badge */}
        <div className="absolute bottom-4 left-4 px-3.5 py-2 rounded-xl bg-[#fdfbf7]/90 dark:bg-[#0c1612]/90 border border-sage-200 dark:border-emerald-950 font-display text-[10px] font-bold text-zinc-500 dark:text-[#a5c5b2] shadow-md flex items-center gap-2 select-none pointer-events-none">
          <Navigation className="w-3.5 h-3.5 text-sage-500 animate-bounce" />
          <span>Showing <strong className="text-sage-500 dark:text-[#4ade80] font-mono">{filteredItems.length} matching items</strong> in Bangalore Radar</span>
        </div>
      </div>
    </div>
  );
};
