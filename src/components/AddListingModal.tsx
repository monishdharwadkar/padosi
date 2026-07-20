import React, { useState, useEffect, useRef } from "react";
import { usePadosiStore } from "../store";
import { X, AlertCircle, HelpCircle, Landmark, MapPin, Navigation, Globe } from "lucide-react";

interface AddListingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddListingModal: React.FC<AddListingModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, addNotification, setItems } = usePadosiStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Yard & Gardening");
  const [pricePerDay, setPricePerDay] = useState<number>(250);
  const [deposit, setDeposit] = useState<number>(1000);
  const [imageUrl, setImageUrl] = useState("");
  
  // Custom coordinate selection on Map
  const [selectedLat, setSelectedLat] = useState<number>(12.9352); // Default Koramangala
  const [selectedLng, setSelectedLng] = useState<number>(77.6245);
  const [useRealMap, setUseRealMap] = useState(true);
  const [mapError, setMapError] = useState(false);

  const modalMapContainerRef = useRef<HTMLDivElement>(null);
  const modalMapRef = useRef<any>(null);
  const modalMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure the DOM elements are fully painted before MapLibre initializes
    const timer = setTimeout(() => {
      if (!useRealMap || !modalMapContainerRef.current) return;

      import("maplibre-gl").then((maplibreglModule) => {
        const maplibregl = maplibreglModule.default;
        const styleUrl = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

        if (modalMapRef.current) {
          modalMapRef.current.remove();
        }

        const map = new maplibregl.Map({
          container: modalMapContainerRef.current!,
          style: styleUrl,
          center: [selectedLng, selectedLat],
          zoom: 13.5,
          attributionControl: false
        });

        modalMapRef.current = map;
        map.addControl(new maplibregl.NavigationControl(), "top-right");

        // Custom Marker Element
        const markerEl = document.createElement("div");
        markerEl.className = "cursor-pointer group flex flex-col items-center";
        markerEl.innerHTML = `
          <div class="flex flex-col items-center select-none pointer-events-none">
            <div class="px-2.5 py-1 rounded-xl bg-sage-500 text-white font-display text-[9px] font-black uppercase tracking-wider shadow-md whitespace-nowrap border border-white/25">
              Handoff Spot
            </div>
            <div class="w-4 h-4 rounded-full bg-sage-600 border border-white flex items-center justify-center shadow-lg -mt-1 scale-110">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `;

        const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
          .setLngLat([selectedLng, selectedLat])
          .addTo(map);

        modalMarkerRef.current = marker;

        // Sync coordinates when dragging the marker
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setSelectedLat(Number(lngLat.lat.toFixed(5)));
          setSelectedLng(Number(lngLat.lng.toFixed(5)));
        });

        // Sync coordinates when clicking the map
        map.on("click", (e) => {
          marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
          setSelectedLat(Number(e.lngLat.lat.toFixed(5)));
          setSelectedLng(Number(e.lngLat.lng.toFixed(5)));
        });
      }).catch((err) => {
        console.warn("Modal MapLibre initialization failed, using high-fidelity vector interface:", err);
        setMapError(true);
        setUseRealMap(false);
      });
    }, 150);

    return () => {
      clearTimeout(timer);
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
        modalMarkerRef.current = null;
      }
    };
  }, [isOpen, useRealMap]);

  const handlePresetPan = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    if (modalMapRef.current) {
      modalMapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
    }
    if (modalMarkerRef.current) {
      modalMarkerRef.current.setLngLat([lng, lat]);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !category || !pricePerDay || !deposit) {
      addNotification("⚠️ Please fill out all required fields.");
      return;
    }

    // Set default beautiful images if none provided
    let finalImg = imageUrl.trim();
    if (!finalImg) {
      const lower = title.toLowerCase();
      if (lower.includes("drill") || lower.includes("saw") || lower.includes("tool")) {
        finalImg = "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80";
      } else if (lower.includes("tent") || lower.includes("camp") || lower.includes("cooler")) {
        finalImg = "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80";
      } else if (lower.includes("coffee") || lower.includes("espresso")) {
        finalImg = "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80";
      } else {
        finalImg = "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80"; // garden fallback
      }
    }

    try {
      const userId = currentUser?.id || "user_dev";
      const response = await fetch("/api/items/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify({
          title,
          description,
          category,
          pricePerDay,
          deposit,
          latitude: selectedLat,
          longitude: selectedLng,
          imageUrl: finalImg
        })
      });

      if (!response.ok) throw new Error("Failed to create item.");
      
      const newItem = await response.json();
      addNotification(`✓ Successfully listed "${newItem.title}" on the neighborhood map!`);
      
      // Re-fetch items
      const itemsRes = await fetch("/api/items");
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data);
      }

      // Reset
      setTitle("");
      setDescription("");
      setPricePerDay(250);
      setDeposit(1000);
      setImageUrl("");
      
      onClose();
    } catch (err: any) {
      addNotification(`❌ Error creating listing: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#fdfbf7] dark:bg-[#0c1612] border border-sage-200 dark:border-emerald-950 p-6 md:p-8 rounded-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-[#14261c] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors animate-fade-in"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Landmark className="w-5 h-5 text-sage-500" />
          <h2 className="font-display font-bold text-xl text-sage-900 dark:text-[#e8efe9]">
            Share a New Resource
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side inputs: 5 cols out of 12 */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                  Item Name / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bosch Electric Hedge Trimmer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe its condition, cords/accessories included, and standard guidelines."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                  Item Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 cursor-pointer"
                >
                  <option>Tools & DIY</option>
                  <option>Yard & Gardening</option>
                  <option>Outdoors & Camping</option>
                  <option>Kitchen Appliances</option>
                  <option>Party Equipment</option>
                  <option>Electronics</option>
                  <option>Sports & Leisure</option>
                  <option>Miscellaneous</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                    Daily Rate (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={pricePerDay}
                    onChange={(e) => setPricePerDay(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                    Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2] mb-1.5">
                  Item Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="Leave empty for beautiful automatic matching"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-900 dark:text-[#e8efe9] text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
            </div>

            {/* Right side interactive map: 7 cols out of 12 */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-sage-700 dark:text-[#a5c5b2]">
                  Select Handoff & Pickup Location
                </span>
                <span className="block text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                  Drag the pin or click on the map below to pinpoint the exact handoff spot, just like in your favorite apps.
                </span>
              </div>

              {/* Quick Jump presets */}
              <div className="flex flex-wrap gap-1.5 py-1">
                <span className="text-[10px] font-bold text-zinc-400 self-center mr-1">Quick Jump:</span>
                {[
                  { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
                  { name: "Indiranagar", lat: 12.9716, lng: 77.6412 },
                  { name: "HSR Layout", lat: 12.9121, lng: 77.6445 },
                  { name: "Jayanagar", lat: 12.9299, lng: 77.5824 }
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetPan(preset.lat, preset.lng)}
                    className="px-2 py-1 rounded-lg bg-sage-100 dark:bg-emerald-950/40 text-[10px] font-display font-bold text-zinc-700 dark:text-zinc-300 hover:bg-sage-200 dark:hover:bg-emerald-900/30 transition-all cursor-pointer"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              {/* Map Canvas */}
              <div className="relative w-full h-[250px] rounded-2xl border border-sage-200 dark:border-emerald-950 overflow-hidden shadow-inner bg-zinc-50 dark:bg-[#070d0a] flex flex-col">
                {useRealMap && !mapError ? (
                  <div ref={modalMapContainerRef} className="w-full h-full" />
                ) : (
                  /* High-fidelity Vector fallback selector grid */
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#fdfbf7] dark:bg-[#070d0a]">
                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(to_right,#2d5a27_1px,transparent_1px),linear-gradient(to_bottom,#2d5a27_1px,transparent_1px)] bg-[size:25px_25px]" />
                    <MapPin className="w-8 h-8 text-sage-500 animate-bounce mb-2" />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Radar Map Grid Active</span>
                    <span className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                      Adjust coordinates using the manual inputs below to verify locations precisely.
                    </span>
                  </div>
                )}

                {/* Coordinates floating indicator */}
                <div className="absolute bottom-3 left-3 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-[#0c1612]/90 backdrop-blur-sm border border-sage-200 dark:border-emerald-950 shadow-md flex items-center gap-1.5 text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-300 pointer-events-none">
                  <Navigation className="w-3 h-3 text-sage-500 animate-pulse" />
                  <span>GPS: {selectedLat}, {selectedLng}</span>
                </div>
              </div>

              {/* Precision Coordinate Fields */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-dashed border-sage-200 dark:border-emerald-950 bg-sage-50/50 dark:bg-[#121f19]/30">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Latitude Coordinate
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={selectedLat}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSelectedLat(val);
                      if (modalMarkerRef.current) modalMarkerRef.current.setLngLat([selectedLng, val]);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-800 dark:text-zinc-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Longitude Coordinate
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={selectedLng}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSelectedLng(val);
                      if (modalMarkerRef.current) modalMarkerRef.current.setLngLat([val, selectedLat]);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-sage-200 dark:border-emerald-950 bg-white dark:bg-[#121f19] text-zinc-800 dark:text-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-sage-200 dark:border-emerald-950/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-sage-200 dark:border-emerald-950 text-zinc-500 dark:text-zinc-400 hover:bg-sage-100 dark:hover:bg-[#14261c] font-display text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-sage-500 hover:bg-sage-600 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-display text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"
            >
              Publish Listing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
