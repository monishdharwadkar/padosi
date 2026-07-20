import { create } from "zustand";
import { User, Item, Booking, ChatMessage } from "./types";

interface OfflineBooking {
  itemId: string;
  startDate: string;
  endDate: string;
  itemTitle: string;
}

interface PadosiState {
  currentUser: User | null;
  items: Item[];
  semanticExplanation: string | null;
  bookings: Booking[];
  messages: ChatMessage[];
  selectedItem: Item | null;
  activeBooking: Booking | null;
  
  // Search & Map State
  mapCenter: [number, number]; // [lat, lng]
  mapZoom: number;
  selectedCategory: string;
  searchQuery: string;
  distanceFilter: number; // in km

  // UI state
  isDarkMode: boolean;
  isAuthModalOpen: boolean;
  activeTab: 'home' | 'explore' | 'dashboard' | 'lent' | 'borrowed' | 'concurrency-test';
  
  // Real-time notifications & system status
  isOnline: boolean;
  offlineQueue: OfflineBooking[];
  socket: WebSocket | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  notifications: string[];

  // Actions
  setCurrentUser: (user: User | null) => void;
  setItems: (items: Item[]) => void;
  setSemanticExplanation: (exp: string | null) => void;
  setBookings: (bookings: Booking[]) => void;
  addBooking: (booking: Booking) => void;
  updateBookingInState: (booking: Booking) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  setSelectedItem: (item: Item | null) => void;
  setActiveBooking: (booking: Booking | null) => void;
  
  // Filter actions
  setMapCenter: (coords: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  setDistanceFilter: (distance: number) => void;
  
  // Theme & tab actions
  setDarkMode: (dark: boolean) => void;
  setAuthModalOpen: (open: boolean) => void;
  setActiveTab: (tab: 'home' | 'explore' | 'dashboard' | 'lent' | 'borrowed' | 'concurrency-test') => void;
  
  // Network & Sync Actions
  setOnlineStatus: (status: boolean) => void;
  queueOfflineBooking: (booking: OfflineBooking) => void;
  clearOfflineQueue: () => void;
  addNotification: (text: string) => void;
  clearNotifications: () => void;

  // Real-time connection management
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const usePadosiStore = create<PadosiState>((set, get) => ({
  currentUser: null,
  items: [],
  semanticExplanation: null,
  bookings: [],
  messages: [],
  selectedItem: null,
  activeBooking: null,

  // Bangalore (Koramangala) default center
  mapCenter: [12.9352, 77.6245],
  mapZoom: 13.5,
  selectedCategory: "All",
  searchQuery: "",
  distanceFilter: 3.5, // Default 3.5 km radius around center

  isDarkMode: false, // Default to clean light and white mode!
  isAuthModalOpen: false,
  activeTab: 'home',

  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineQueue: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('padosi_offline_queue') || '[]') : [],
  socket: null,
  connectionStatus: 'disconnected',
  notifications: [],

  setCurrentUser: (user) => {
    set({ currentUser: user });
    if (user) {
      get().connectWebSocket();
    } else {
      get().disconnectWebSocket();
    }
  },
  setItems: (items) => set({ items }),
  setSemanticExplanation: (semanticExplanation) => set({ semanticExplanation }),
  setBookings: (bookings) => set({ bookings }),
  addBooking: (booking) => set((state) => ({ bookings: [booking, ...state.bookings] })),
  updateBookingInState: (booking) => set((state) => ({
    bookings: state.bookings.map(b => b.id === booking.id ? booking : b),
    activeBooking: state.activeBooking?.id === booking.id ? booking : state.activeBooking
  })),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setSelectedItem: (selectedItem) => set({ selectedItem }),
  setActiveBooking: (activeBooking) => set({ activeBooking }),

  setMapCenter: (mapCenter) => set({ mapCenter }),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDistanceFilter: (distanceFilter) => set({ distanceFilter }),

  setDarkMode: (isDarkMode) => {
    set({ isDarkMode });
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
  setAuthModalOpen: (isAuthModalOpen) => set({ isAuthModalOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setOnlineStatus: (isOnline) => set({ isOnline }),
  
  queueOfflineBooking: (booking) => {
    set((state) => {
      const newQueue = [...state.offlineQueue, booking];
      localStorage.setItem('padosi_offline_queue', JSON.stringify(newQueue));
      return { offlineQueue: newQueue };
    });
  },
  
  clearOfflineQueue: () => {
    localStorage.removeItem('padosi_offline_queue');
    set({ offlineQueue: [] });
  },

  addNotification: (text) => set((state) => ({ notifications: [text, ...state.notifications].slice(0, 10) })),
  clearNotifications: () => set({ notifications: [] }),

  connectWebSocket: () => {
    const { currentUser, socket } = get();
    if (!currentUser || socket) return;

    set({ connectionStatus: 'connecting' });
    
    // Compute WebSocket URL relative to application host
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${currentUser.id}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      set({ socket: ws, connectionStatus: 'connected' });
      get().addNotification("✓ Live neighborhood status link active");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "BOOKING_UPDATE") {
          const updated: Booking = data.booking;
          get().updateBookingInState(updated);
          get().addNotification(`🔔 Booking status updated: "${updated.itemTitle}" is now [${updated.status}]`);
        } else if (data.type === "CHAT_MESSAGE") {
          const msg: ChatMessage = data.message;
          const { activeBooking } = get();
          if (activeBooking && activeBooking.id === msg.bookingId) {
            get().addMessage(msg);
          }
          get().addNotification(`💬 New neighbor message in chat!`);
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    ws.onclose = () => {
      set({ socket: null, connectionStatus: 'disconnected' });
    };

    ws.onerror = () => {
      set({ socket: null, connectionStatus: 'disconnected' });
    };
  },

  disconnectWebSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, connectionStatus: 'disconnected' });
    }
  }
}));
