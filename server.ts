import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { User, Item, Booking, ChatMessage, BookingStatus } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "padosi_db.json");

app.use(express.json({ limit: "20mb" }));

// -----------------------------------------------------------------------------
// Gemini API Lazy Initialization
// -----------------------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------------------
// Robust Gemini Caller with Exponential Backoff Retry Logic
// -----------------------------------------------------------------------------
async function callGeminiWithRetry(
  params: any,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      const ai = getGeminiClient();
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      const errorMsg = error.message || (typeof error === "object" ? JSON.stringify(error) : String(error));
      
      // Check if error is transient (503 Service Unavailable, 429 Rate Limit, UNAVAILABLE status, or network issue)
      const isTransient = 
        error.status === 503 || 
        error.status === 429 ||
        errorMsg.includes("503") ||
        errorMsg.includes("429") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        error.code === 503 ||
        error.code === 429;

      if (isTransient && attempt <= maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Gemini API] Call failed (attempt ${attempt}/${maxRetries}) with error: ${errorMsg}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// -----------------------------------------------------------------------------
// Database State & Persistence
// -----------------------------------------------------------------------------
interface DatabaseSchema {
  users: User[];
  items: Item[];
  bookings: Booking[];
  messages: ChatMessage[];
}

let db: DatabaseSchema = {
  users: [],
  items: [],
  bookings: [],
  messages: [],
};

// Initial beautiful seed data
function seedDatabase() {
  const seedUsers: User[] = [
    {
      id: "user_dev",
      name: "Monish (You)",
      phoneNumber: "+91 98450 19901",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
      trustScore: null, // "New Neighbor" badge
      joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      reviewsCount: 0,
      onTimeReturnRate: 100,
      noShowRate: 0,
      disputeHistoryCount: 0
    },
    {
      id: "user_aisha",
      name: "Aisha Vance",
      phoneNumber: "+91 99001 01442",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      trustScore: 98,
      joinedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      reviewsCount: 24,
      onTimeReturnRate: 100,
      noShowRate: 0,
      disputeHistoryCount: 0
    },
    {
      id: "user_carlos",
      name: "Carlos Mendez",
      phoneNumber: "+91 98860 01773",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      trustScore: 92,
      joinedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      reviewsCount: 12,
      onTimeReturnRate: 94,
      noShowRate: 2,
      disputeHistoryCount: 0
    },
    {
      id: "user_priya",
      name: "Priya Sharma",
      phoneNumber: "+91 97410 01224",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
      trustScore: 88,
      joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      reviewsCount: 8,
      onTimeReturnRate: 90,
      noShowRate: 5,
      disputeHistoryCount: 1
    }
  ];

  const seedItems: Item[] = [
    {
      id: "item_hedge",
      title: "Bosch Electric Hedge Trimmer",
      description: "Powerful 450W electric trimmer, perfect for grooming bushes and trimming wild garden borders. Lightweight and easy to maneuver.",
      category: "Yard & Gardening",
      ownerId: "user_aisha",
      ownerName: "Aisha Vance",
      ownerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      ownerTrustScore: 98,
      pricePerDay: 350,
      deposit: 1500,
      latitude: 12.9385, // Koramangala 3rd Block
      longitude: 77.6210,
      imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80",
      availability: [{ start: "2026-07-01", end: "2026-12-31" }],
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "item_drill",
      title: "DeWalt Cordless Compact Drill Set",
      description: "20V high-performance brushless drill. Includes 2 lithium-ion batteries, a charger, and a rugged carrying case with drill bits.",
      category: "Tools & DIY",
      ownerId: "user_carlos",
      ownerName: "Carlos Mendez",
      ownerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      ownerTrustScore: 92,
      pricePerDay: 250,
      deposit: 1000,
      latitude: 12.9716, // Indiranagar
      longitude: 77.6412,
      imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      availability: [{ start: "2026-07-01", end: "2026-12-31" }],
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "item_tent",
      title: "Coleman 4-Person Waterproof Cabin Tent",
      description: "Super easy 10-minute setup cabin tent. Features rainfly, storage pockets, and welded corners to keep you completely dry outdoors.",
      category: "Outdoors & Camping",
      ownerId: "user_priya",
      ownerName: "Priya Sharma",
      ownerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
      ownerTrustScore: 88,
      pricePerDay: 500,
      deposit: 2500,
      latitude: 12.9121, // HSR Layout
      longitude: 77.6445,
      imageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80",
      availability: [{ start: "2026-07-01", end: "2026-12-31" }],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "item_espresso",
      title: "Breville Barista Express Espresso Machine",
      description: "Create third-wave specialty coffee at home. Built-in grinder, precise PID temperature control, and powerful steam wand for microfoam.",
      category: "Kitchen Appliances",
      ownerId: "user_aisha",
      ownerName: "Aisha Vance",
      ownerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      ownerTrustScore: 98,
      pricePerDay: 800,
      deposit: 5000,
      latitude: 12.9299, // Jayanagar
      longitude: 77.5824,
      imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",
      availability: [{ start: "2026-07-01", end: "2026-12-31" }],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "item_cotton",
      title: "Nostalgia Cotton Candy Maker",
      description: "Retro party pleaser! Works with hard candy, sugar-free candy, or flossing sugar. Includes 2 reusable cones and measuring scoop.",
      category: "Party Equipment",
      ownerId: "user_carlos",
      ownerName: "Carlos Mendez",
      ownerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
      ownerTrustScore: 92,
      pricePerDay: 400,
      deposit: 1500,
      latitude: 12.9312, // Koramangala 5th Block
      longitude: 77.6185,
      imageUrl: "https://images.unsplash.com/photo-1533223129579-65d1c62ee237?auto=format&fit=crop&w=600&q=80",
      availability: [{ start: "2026-07-01", end: "2026-12-31" }],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  db = {
    users: seedUsers,
    items: seedItems,
    bookings: [],
    messages: []
  };
  saveDatabase();
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (e) {
      console.error("Failed to read database file. Re-seeding database.");
      seedDatabase();
    }
  } else {
    seedDatabase();
  }
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

loadDatabase();

// -----------------------------------------------------------------------------
// Pure TypeScript Per-Item Concurrency Lock (Mutex)
// -----------------------------------------------------------------------------
const itemLocks: { [itemId: string]: Promise<void> } = {};
async function acquireLock(itemId: string): Promise<() => void> {
  if (!itemLocks[itemId]) {
    itemLocks[itemId] = Promise.resolve();
  }
  const currentLock = itemLocks[itemId];
  let resolveNext: () => void = () => {};
  const nextLock = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  itemLocks[itemId] = nextLock;

  await currentLock;
  return () => {
    resolveNext();
  };
}

// Overlap Checking
function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && sB < eA;
}

// Trust Score Recomputation
function recalculateTrustScore(userId: string) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return;

  // Find all closed or completed bookings where this user was the borrower
  const userBookings = db.bookings.filter(b => b.borrowerId === userId);
  const finishedBookings = userBookings.filter(b => ['returned', 'closed', 'disputed'].includes(b.status));

  if (finishedBookings.length === 0) {
    user.trustScore = null; // New Neighbor state
    saveDatabase();
    return;
  }

  // Calculate stats
  user.reviewsCount = finishedBookings.length;
  
  const disputes = finishedBookings.filter(b => b.status === 'disputed').length;
  user.disputeHistoryCount = disputes;

  // Let's compute rates
  // Standard simulated on-time return rate (all except those marked delayed or disputed)
  const onTimeCount = finishedBookings.filter(b => !b.disputeNotes?.toLowerCase().includes("late")).length;
  user.onTimeReturnRate = Math.round((onTimeCount / finishedBookings.length) * 100);

  // trustScore algorithm:
  // Base 80.
  // Add proportional points for high on-time returns.
  // Deduct heavily for disputes.
  let score = 80;
  score += (user.onTimeReturnRate - 90) * 1.5; // range +15 to -135
  score -= user.noShowRate * 2;
  score -= disputes * 15;

  user.trustScore = Math.max(30, Math.min(100, Math.round(score)));
  saveDatabase();
}

// -----------------------------------------------------------------------------
// Real-time Push Status (WebSocket Setup)
// -----------------------------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Track active WebSocket clients
const clients = new Map<string, WebSocket>();

wss.on("connection", (ws, request) => {
  const urlParams = new URLSearchParams(request.url?.split("?")[1]);
  const userId = urlParams.get("userId");
  
  if (userId) {
    clients.set(userId, ws);
    console.log(`WebSocket client connected: ${userId}`);
  }

  ws.on("close", () => {
    if (userId) {
      clients.delete(userId);
      console.log(`WebSocket client disconnected: ${userId}`);
    }
  });
});

// Upgrade HTTP to WS
server.on("upgrade", (request, socket, head) => {
  if (request.url?.startsWith("/ws")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Broadcast state update to relevant parties
function notifyBookingUpdate(booking: Booking) {
  const payload = JSON.stringify({ type: "BOOKING_UPDATE", booking });
  
  const borrowerWs = clients.get(booking.borrowerId);
  if (borrowerWs && borrowerWs.readyState === WebSocket.OPEN) {
    borrowerWs.send(payload);
  }

  const ownerWs = clients.get(booking.itemOwnerId);
  if (ownerWs && ownerWs.readyState === WebSocket.OPEN) {
    ownerWs.send(payload);
  }
}

function notifyNewMessage(message: ChatMessage, recipientId: string) {
  const payload = JSON.stringify({ type: "CHAT_MESSAGE", message });
  const recipientWs = clients.get(recipientId);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(payload);
  }
}

// -----------------------------------------------------------------------------
// Express API Router Definitions
// -----------------------------------------------------------------------------

// Auth APIs (Simulating Phone OTP verification)
app.post("/api/auth/otp/send", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: "Phone number required" });
  return res.json({ success: true, message: "Verification OTP code '123456' sent!" });
});

app.post("/api/auth/otp/verify", (req, res) => {
  const { phoneNumber, code } = req.body;
  if (!phoneNumber || !code) {
    return res.status(400).json({ error: "Phone number and verification code are required" });
  }

  if (code !== "123456") {
    return res.status(400).json({ error: "Invalid verification code. Please try '123456'." });
  }

  // Find or create user
  let user = db.users.find(u => u.phoneNumber === phoneNumber);
  if (!user) {
    user = {
      id: "user_" + Math.random().toString(36).substring(2, 9),
      name: `Neighbor #${phoneNumber.slice(-4)}`,
      phoneNumber,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80`,
      trustScore: null, // "New Neighbor" state
      joinedAt: new Date().toISOString(),
      reviewsCount: 0,
      onTimeReturnRate: 100,
      noShowRate: 0,
      disputeHistoryCount: 0
    };
    db.users.push(user);
    saveDatabase();
  }

  return res.json({ user });
});

app.get("/api/users/me", (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});

// Update trust profile manually for testing
app.post("/api/users/profile/update", (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const { name, avatar } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  saveDatabase();
  return res.json(user);
});

// Fetch listings
app.get("/api/items", (req, res) => {
  const { category, q } = req.query;
  let items = db.items;

  if (category && category !== "All") {
    items = items.filter(it => it.category === category);
  }

  return res.json(items);
});

// AI Auto-Suggest Category & Fair Rental Price using Gemini
app.post("/api/items/suggest", async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "Item title is required" });

  try {
    const ai = getGeminiClient();
    const prompt = `You are the AI categorizer and pricing expert for Padosi, a hyperlocal neighborhood item sharing platform in Bangalore, India.
Given this item title and description, you must:
1. Categorize it into one of these exact categories: "Tools & DIY", "Yard & Gardening", "Outdoors & Camping", "Kitchen Appliances", "Party Equipment", "Electronics", "Sports & Leisure", "Miscellaneous".
2. Suggest a fair rental price per day (in INR / Indian Rupees, integers only, typically between ₹100 and ₹1500).
3. Suggest a fair security deposit (in INR / Indian Rupees, typically ₹500 to ₹5000, or a reasonable replacement percentage).
4. Provide a 1-sentence friendly neighborhood-focused explanation of why this price is fair in Bangalore (e.g. comparing it to local retail prices in INR).
5. Suggest an optimized, warm, neighborly title and description to make the listing more attractive to Bangalore residents.

Item Title: "${title}"
Item Description: "${description || 'No description provided.'}"

Return ONLY a JSON object with this EXACT schema:
{
  "category": "string",
  "suggestedPrice": number,
  "suggestedDeposit": number,
  "explanation": "string",
  "optimizedTitle": "string",
  "optimizedDescription": "string"
}`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    console.warn("AI Auto-suggestion fallback triggered. Error:", error.message);
    // Graceful smart rules fallback
    const lowerTitle = title.toLowerCase();
    let category = "Miscellaneous";
    let price = 250;
    let deposit = 1000;
    
    if (lowerTitle.includes("trim") || lowerTitle.includes("lawn") || lowerTitle.includes("garden") || lowerTitle.includes("hedge")) {
      category = "Yard & Gardening";
      price = 350;
      deposit = 1500;
    } else if (lowerTitle.includes("drill") || lowerTitle.includes("saw") || lowerTitle.includes("tool") || lowerTitle.includes("washer")) {
      category = "Tools & DIY";
      price = 250;
      deposit = 1000;
    } else if (lowerTitle.includes("tent") || lowerTitle.includes("camp") || lowerTitle.includes("sleep") || lowerTitle.includes("cooler")) {
      category = "Outdoors & Camping";
      price = 500;
      deposit = 2500;
    } else if (lowerTitle.includes("coffee") || lowerTitle.includes("espresso") || lowerTitle.includes("blender") || lowerTitle.includes("maker")) {
      category = "Kitchen Appliances";
      price = 800;
      deposit = 5000;
    }

    return res.json({
      category,
      suggestedPrice: price,
      suggestedDeposit: deposit,
      explanation: "Auto-suggested based on similar neighborhood item catalogs (AI key offline).",
      optimizedTitle: title,
      optimizedDescription: description || "No description provided."
    });
  }
});

// Reusable smart keyword scoring and filtering function for high search accuracy
function scoreAndFilterItemsByKeywords(items: Item[], query: string): Item[] {
  const stopWords = new Set([
    "something", "to", "a", "an", "the", "for", "with", "want", "borrow",
    "lend", "rent", "need", "in", "at", "on", "of", "and", "or", "but", "is",
    "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
    "does", "did", "i", "you", "he", "she", "it", "we", "they", "my", "your",
    "his", "her", "its", "our", "their", "this", "that", "these", "those",
    "any", "some", "every", "all", "no", "not", "only", "own", "other", "another",
    "please", "can", "could", "would", "should", "will", "shall", "may", "might", "must",
    "how", "where", "when", "why", "who", "whom", "which", "whose", "gear", "item", "items"
  ]);

  // Clean and split query into keywords
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map(kw => kw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim())
    .filter(kw => kw.length > 1 && !stopWords.has(kw));

  // If after filtering stop words we have no keywords, use the full query
  const keywordsToUse = keywords.length > 0 
    ? keywords 
    : [query.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim()].filter(k => k.length > 0);

  if (keywordsToUse.length === 0) {
    return items;
  }

  const scored = items.map(item => {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    const catLower = item.category.toLowerCase();

    keywordsToUse.forEach(kw => {
      // Check partial/full matches inside words
      const matchInTitle = titleLower.includes(kw) || kw.includes(titleLower) || titleLower.split(/\s+/).some(w => w.includes(kw) || kw.includes(w));
      const matchInDesc = descLower.includes(kw) || kw.includes(descLower) || descLower.split(/\s+/).some(w => w.includes(kw) || kw.includes(w));
      const matchInCat = catLower.includes(kw) || kw.includes(catLower) || catLower.split(/\s+/).some(w => w.includes(kw) || kw.includes(w));

      if (matchInTitle) {
        score += 25;
        // Extra points for exact substring or exact word match
        if (titleLower.includes(kw)) {
          score += 15;
        }
        if (new RegExp(`\\b${kw}\\b`, 'i').test(titleLower)) {
          score += 10;
        }
      }

      if (matchInDesc) {
        score += 8;
        if (descLower.includes(kw)) {
          score += 4;
        }
        if (new RegExp(`\\b${kw}\\b`, 'i').test(descLower)) {
          score += 3;
        }
      }

      if (matchInCat) {
        score += 12;
        if (catLower.includes(kw)) {
          score += 6;
        }
      }
    });

    return { item, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// Semantic Search using server-side Gemini
app.get("/api/items/search", async (req, res) => {
  const query = req.query.q as string;
  const items = db.items;

  if (!query || query.trim() === "") {
    return res.json({ items });
  }

  try {
    const ai = getGeminiClient();
    const itemsDataForAI = items.map(it => ({
      id: it.id,
      title: it.title,
      description: it.description,
      category: it.category
    }));

    const prompt = `You are a semantic search engine for "Padosi", a neighborly item sharing app.
A user is searching for: "${query}"
We have the following list of available items in the neighborhood:
${JSON.stringify(itemsDataForAI, null, 2)}

Identify which items from the list are relevant to the user's search query, even if they don't share exact keywords (for example, if they search "something to cut hedges", a "hedge trimmer" or "pruning shears" is highly relevant).
Return a JSON object containing:
1. "matchedIds": A string array of the item IDs that are relevant, ordered by relevance. If none are relevant, return an empty array.
2. "explanation": A friendly, warm 1-sentence summary of what you found and why it matches (e.g. "I found a hedge trimmer and heavy-duty shears to help with your garden grooming!").

Return ONLY a JSON object with this EXACT schema:
{
  "matchedIds": ["string"],
  "explanation": "string"
}`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    const matchedIds = result.matchedIds || [];
    const explanation = result.explanation || "";

    const matchedItems = items.filter(it => matchedIds.includes(it.id));
    if (matchedItems.length === 0) {
      const fallbackItems = scoreAndFilterItemsByKeywords(items, query);
      return res.json({ items: fallbackItems, semanticExplanation: "Local high-accuracy keyword matches found." });
    }

    return res.json({ items: matchedItems, semanticExplanation: explanation });
  } catch (error: any) {
    console.warn("Semantic search failed or Gemini key not set, using text-matching fallback:", error.message);
    const fallbackItems = scoreAndFilterItemsByKeywords(items, query);
    return res.json({ items: fallbackItems, semanticExplanation: "Keyword match fallback (AI offline)." });
  }
});

// Create Item Listing
app.post("/api/items/create", (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { title, description, category, pricePerDay, deposit, latitude, longitude, imageUrl } = req.body;
  
  if (!title || !category || !pricePerDay || !deposit) {
    return res.status(400).json({ error: "Missing required listing fields" });
  }

  const newItem: Item = {
    id: "item_" + Math.random().toString(36).substring(2, 9),
    title,
    description: description || "",
    category,
    ownerId: user.id,
    ownerName: user.name,
    ownerAvatar: user.avatar,
    ownerTrustScore: user.trustScore,
    pricePerDay: Number(pricePerDay),
    deposit: Number(deposit),
    latitude: Number(latitude || 40.6602),
    longitude: Number(longitude || -73.9690),
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
    availability: [{ start: "2026-07-01", end: "2026-12-31" }],
    createdAt: new Date().toISOString()
  };

  db.items.push(newItem);
  saveDatabase();
  return res.json(newItem);
});

// Delete Item Listing
app.post("/api/items/delete/:id", (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const { id } = req.params;
  const itemIndex = db.items.findIndex(i => i.id === id && i.ownerId === userId);
  
  if (itemIndex === -1) {
    return res.status(404).json({ error: "Item not found or you are not authorized to delete it." });
  }

  db.items.splice(itemIndex, 1);
  saveDatabase();
  return res.json({ success: true, message: "Listing deleted successfully." });
});

// Bookings List
app.get("/api/bookings", (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const userBookings = db.bookings.filter(b => b.borrowerId === userId || b.itemOwnerId === userId);
  return res.json(userBookings);
});

// Request Booking
app.post("/api/bookings/create", async (req, res) => {
  const borrowerId = req.headers["x-user-id"] as string || "user_dev";
  const borrower = db.users.find(u => u.id === borrowerId);
  if (!borrower) return res.status(404).json({ error: "Borrower profile not found" });

  const { itemId, startDate, endDate } = req.body;
  if (!itemId || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing booking fields (itemId, startDate, endDate)" });
  }

  const item = db.items.find(it => it.id === itemId);
  if (!item) return res.status(404).json({ error: "Item listing not found" });

  if (item.ownerId === borrowerId) {
    return res.status(400).json({ error: "You cannot borrow your own item!" });
  }

  // Calculate prices
  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const totalPrice = days * item.pricePerDay;

  // CONCURRENCY CONTROL: Acquire a per-item lock before state mutation
  const unlock = await acquireLock(itemId);
  try {
    // Check overlapping approved/confirmed bookings
    const overlap = db.bookings.some(b => 
      b.itemId === itemId && 
      ['approved', 'picked_up', 'returned'].includes(b.status) &&
      datesOverlap(b.startDate, b.endDate, startDate, endDate)
    );

    if (overlap) {
      return res.status(409).json({ error: "This item has already been successfully booked for overlapping dates." });
    }

    const newBooking: Booking = {
      id: "booking_" + Math.random().toString(36).substring(2, 9),
      itemId,
      itemTitle: item.title,
      itemImageUrl: item.imageUrl,
      itemOwnerId: item.ownerId,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      borrowerAvatar: borrower.avatar,
      startDate,
      endDate,
      totalPrice,
      deposit: item.deposit,
      status: "requested",
      pickupPhotoOwner: null,
      pickupPhotoBorrower: null,
      pickupNotes: null,
      returnPhotoOwner: null,
      returnPhotoBorrower: null,
      returnNotes: null,
      conditionReport: null,
      paymentStatus: "none",
      disputeNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.bookings.push(newBooking);
    saveDatabase();
    
    // Send automated greeting message
    const welcomeMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substring(2, 9),
      bookingId: newBooking.id,
      senderId: item.ownerId,
      content: `Hey ${borrower.name}! Thanks for requesting my ${item.title}. Let me review the dates and approve the booking.`,
      createdAt: new Date().toISOString()
    };
    db.messages.push(welcomeMsg);
    saveDatabase();

    notifyBookingUpdate(newBooking);

    return res.status(201).json(newBooking);
  } finally {
    unlock(); // Always release the lock
  }
});

// Perform Booking Action (State Machine + Concurrency Check on Approval)
app.post("/api/bookings/:id/action", async (req, res) => {
  const userId = req.headers["x-user-id"] as string || "user_dev";
  const { id } = req.params;
  const { action, notes, photo } = req.body;

  const booking = db.bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const isOwner = booking.itemOwnerId === userId;
  const isBorrower = booking.borrowerId === userId;

  if (!isOwner && !isBorrower) {
    return res.status(403).json({ error: "You are not a party in this booking." });
  }

  // Acquire critical lock for the booking item during the state change!
  const unlock = await acquireLock(booking.itemId);
  try {
    const freshBooking = db.bookings.find(b => b.id === id)!;

    if (action === "approve") {
      if (!isOwner) return res.status(403).json({ error: "Only item owners can approve requests." });
      if (freshBooking.status !== "requested") return res.status(400).json({ error: "Booking is not in requested state." });

      // Re-verify overlap at confirmation time
      const overlap = db.bookings.some(b => 
        b.itemId === freshBooking.itemId && 
        b.id !== freshBooking.id &&
        ['approved', 'picked_up', 'returned'].includes(b.status) &&
        datesOverlap(b.startDate, b.endDate, freshBooking.startDate, freshBooking.endDate)
      );

      if (overlap) {
        freshBooking.status = "closed";
        freshBooking.disputeNotes = "Rejected automatically due to date collision.";
        saveDatabase();
        notifyBookingUpdate(freshBooking);
        return res.status(409).json({ error: "This request collides with an already approved booking." });
      }

      freshBooking.status = "approved";
      freshBooking.paymentStatus = "held"; // Hold deposit
      freshBooking.updatedAt = new Date().toISOString();
      saveDatabase();
      
      // Auto notification message
      const approveMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: freshBooking.id,
        senderId: freshBooking.itemOwnerId,
        content: `Booking approved! A deposit hold of $${freshBooking.deposit} has been locked. Let's arrange pickup.`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(approveMsg);
      saveDatabase();

      notifyBookingUpdate(freshBooking);
      return res.json(freshBooking);
    }

    if (action === "pickup") {
      if (freshBooking.status !== "approved") return res.status(400).json({ error: "Booking is not in approved state." });
      
      if (isOwner) {
        freshBooking.pickupPhotoOwner = photo || null;
      }
      if (isBorrower) {
        freshBooking.pickupPhotoBorrower = photo || null;
        freshBooking.pickupNotes = notes || null;
      }

      // If either side uploaded photos, we transition to picked_up (to keep flow smooth and forgiving)
      freshBooking.status = "picked_up";
      freshBooking.updatedAt = new Date().toISOString();
      saveDatabase();

      const pickupMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: freshBooking.id,
        senderId: userId,
        content: `Item handoff complete! ${isBorrower ? 'Borrower' : 'Owner'} uploaded handoff condition verification.`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(pickupMsg);
      saveDatabase();

      notifyBookingUpdate(freshBooking);
      return res.json(freshBooking);
    }

    if (action === "return") {
      if (freshBooking.status !== "picked_up") return res.status(400).json({ error: "Booking is not active." });

      if (isOwner) {
        freshBooking.returnPhotoOwner = photo || null;
        freshBooking.returnNotes = notes || null;
      }
      if (isBorrower) {
        freshBooking.returnPhotoBorrower = photo || null;
      }

      freshBooking.status = "returned";
      freshBooking.updatedAt = new Date().toISOString();
      saveDatabase();

      const returnMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: freshBooking.id,
        senderId: userId,
        content: `Item returned! ${isOwner ? 'Owner' : 'Borrower'} verified return handback. Checking condition...`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(returnMsg);
      saveDatabase();

      notifyBookingUpdate(freshBooking);
      return res.json(freshBooking);
    }

    if (action === "close") {
      if (freshBooking.status !== "returned") return res.status(400).json({ error: "Booking is not yet returned." });

      freshBooking.status = "closed";
      freshBooking.paymentStatus = "released"; // Release deposit
      freshBooking.updatedAt = new Date().toISOString();
      saveDatabase();

      const closeMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: freshBooking.id,
        senderId: freshBooking.itemOwnerId,
        content: "Awesome sharing experience! Booking settled successfully. Deposit released back to borrower.",
        createdAt: new Date().toISOString()
      };
      db.messages.push(closeMsg);
      saveDatabase();

      // Recalculate trust scores!
      recalculateTrustScore(freshBooking.borrowerId);
      recalculateTrustScore(freshBooking.itemOwnerId);

      notifyBookingUpdate(freshBooking);
      return res.json(freshBooking);
    }

    if (action === "dispute") {
      freshBooking.status = "disputed";
      freshBooking.paymentStatus = "held"; // keep hold for audit
      freshBooking.disputeNotes = notes || "Dispute raised during item inspection.";
      freshBooking.updatedAt = new Date().toISOString();
      saveDatabase();

      const disputeMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: freshBooking.id,
        senderId: userId,
        content: `⚠️ A condition dispute has been raised: "${notes}"`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(disputeMsg);
      saveDatabase();

      recalculateTrustScore(freshBooking.borrowerId);
      recalculateTrustScore(freshBooking.itemOwnerId);

      notifyBookingUpdate(freshBooking);
      return res.json(freshBooking);
    }

    return res.status(400).json({ error: "Invalid booking state machine action." });
  } finally {
    unlock();
  }
});

// AI Visual Comparison Trigger (Can be initiated on Returned state)
app.post("/api/bookings/:id/compare-condition", async (req, res) => {
  const { id } = req.params;
  const booking = db.bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const pickupPhoto = booking.pickupPhotoBorrower || booking.pickupPhotoOwner;
  const returnPhoto = booking.returnPhotoBorrower || booking.returnPhotoOwner;

  if (!pickupPhoto || !returnPhoto) {
    return res.status(400).json({ error: "Both pickup and return photos are required for automated comparison." });
  }

  try {
    const ai = getGeminiClient();
    
    // Format photo base64 payloads
    const cleanBase64 = (dataUrl: string) => {
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      return match ? { mimeType: `image/${match[1]}`, data: match[2] } : { mimeType: "image/jpeg", data: dataUrl };
    };

    const pPhoto = cleanBase64(pickupPhoto);
    const rPhoto = cleanBase64(returnPhoto);

    const prompt = `You are the trust & safety AI inspector for "Padosi", a neighborhood item sharing platform.
Compare the pickup condition photo (Image 1) and the return condition photo (Image 2) of a shared item.
Analyze if there are any new damages, visible scratches, severe dirt, broken parts, or missing components in the return photo compared to the pickup photo.
Provide a clear, neighborly, objective assessment. If everything looks identical or in good shape, state that clearly.
Format your response as a JSON object:
{
  "damageDetected": boolean,
  "confidenceScore": number, // 0-100
  "report": "string", // 2-3 sentences outlining the comparison details
  "recommendedAction": "string" // e.g. "Release full deposit" or "Hold deposit for dispute review"
}`;

    const response = await callGeminiWithRetry({
      model: "gemini-3.5-flash",
      contents: [
        { inlineData: { data: pPhoto.data, mimeType: pPhoto.mimeType } },
        { inlineData: { data: rPhoto.data, mimeType: rPhoto.mimeType } },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const reportData = JSON.parse(response.text || "{}");
    booking.conditionReport = reportData.report;
    
    if (reportData.damageDetected && reportData.confidenceScore > 65) {
      booking.status = "disputed";
      booking.paymentStatus = "held";
      booking.disputeNotes = `AI Condition Monitor flagged potential damage: ${reportData.report}`;
      
      const alertMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: booking.id,
        senderId: "system",
        content: `⚠️ Automated Visual Scan Alert: Potential damage detected. Booking flagged for review. Report: ${reportData.report}`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(alertMsg);
    } else {
      const positiveMsg: ChatMessage = {
        id: "msg_" + Math.random().toString(36).substring(2, 9),
        bookingId: booking.id,
        senderId: "system",
        content: `✓ Automated Visual Scan Complete: No major structural or aesthetic damages detected. Recommended: ${reportData.recommendedAction}`,
        createdAt: new Date().toISOString()
      };
      db.messages.push(positiveMsg);
    }
    
    saveDatabase();
    notifyBookingUpdate(booking);

    return res.json({ report: reportData, booking });
  } catch (error: any) {
    console.warn("Condition comparison failed or Gemini offline:", error.message);
    const report = "Manual review recommended. Visual AI was offline or unable to process the images.";
    booking.conditionReport = report;
    saveDatabase();
    return res.json({
      report: {
        damageDetected: false,
        confidenceScore: 0,
        report,
        recommendedAction: "Review photos manually"
      },
      booking
    });
  }
});

// Chat Messages API
app.get("/api/messages/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const bookingMsgs = db.messages.filter(m => m.bookingId === bookingId);
  return res.json(bookingMsgs);
});

app.post("/api/messages", (req, res) => {
  const senderId = req.headers["x-user-id"] as string || "user_dev";
  const { bookingId, content } = req.body;

  if (!bookingId || !content) return res.status(400).json({ error: "Missing fields" });

  const booking = db.bookings.find(b => b.id === bookingId);
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const recipientId = booking.borrowerId === senderId ? booking.itemOwnerId : booking.borrowerId;

  const newMsg: ChatMessage = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    bookingId,
    senderId,
    content,
    createdAt: new Date().toISOString()
  };

  db.messages.push(newMsg);
  saveDatabase();

  notifyNewMessage(newMsg, recipientId);

  return res.json(newMsg);
});

// -----------------------------------------------------------------------------
// Core Concurrency Testing Harness
// -----------------------------------------------------------------------------
app.post("/api/test/concurrency", async (req, res) => {
  // Let's create a test item
  const testItem: Item = {
    id: "item_test_concurrency",
    title: "Heavy Duty Lawn Aerator",
    description: "High concurrency testing item.",
    category: "Yard & Gardening",
    ownerId: "user_aisha",
    ownerName: "Aisha Vance",
    ownerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    ownerTrustScore: 98,
    pricePerDay: 20,
    deposit: 100,
    latitude: 40.6602,
    longitude: -73.9690,
    imageUrl: "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80",
    availability: [{ start: "2026-07-01", end: "2026-12-31" }],
    createdAt: new Date().toISOString()
  };

  // Replace or push the testing item
  db.items = db.items.filter(it => it.id !== testItem.id);
  db.items.push(testItem);

  // Clean old bookings for this test item
  db.bookings = db.bookings.filter(b => b.itemId !== testItem.id);
  saveDatabase();

  const startDate = "2026-08-10";
  const endDate = "2026-08-15";

  // Simulate 5 completely parallel booking requests using Promises
  const simulateRequest = async (simulatedUser: string): Promise<{ user: string; status: number; body: any }> => {
    try {
      // Mock Express Request logic inline to trigger locks & overlapping checks
      const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
      const totalPrice = days * testItem.pricePerDay;

      const unlock = await acquireLock(testItem.id);
      try {
        // Overlap verification
        const overlap = db.bookings.some(b => 
          b.itemId === testItem.id && 
          ['approved', 'picked_up', 'returned'].includes(b.status) &&
          datesOverlap(b.startDate, b.endDate, startDate, endDate)
        );

        if (overlap) {
          return { user: simulatedUser, status: 409, body: { error: "Date overlap conflict detected!" } };
        }

        // Create approved booking directly to simulate first-come first-served confirmation
        const booking: Booking = {
          id: `booking_test_${simulatedUser}`,
          itemId: testItem.id,
          itemTitle: testItem.title,
          itemImageUrl: testItem.imageUrl,
          itemOwnerId: testItem.ownerId,
          borrowerId: simulatedUser,
          borrowerName: `Concurrent Guest ${simulatedUser}`,
          borrowerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
          startDate,
          endDate,
          totalPrice,
          deposit: testItem.deposit,
          status: "approved", // auto approved to trigger overlapping locks
          pickupPhotoOwner: null,
          pickupPhotoBorrower: null,
          pickupNotes: null,
          returnPhotoOwner: null,
          returnPhotoBorrower: null,
          returnNotes: null,
          conditionReport: null,
          paymentStatus: "held",
          disputeNotes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.bookings.push(booking);
        saveDatabase();
        return { user: simulatedUser, status: 201, body: booking };
      } finally {
        unlock();
      }
    } catch (e: any) {
      return { user: simulatedUser, status: 500, body: { error: e.message } };
    }
  };

  // Fire 5 completely overlapping requests concurrently
  const results = await Promise.all([
    simulateRequest("user_carlos"),
    simulateRequest("user_priya"),
    simulateRequest("user_dev"),
    simulateRequest("user_guest1"),
    simulateRequest("user_guest2")
  ]);

  // Clean testing items & database after reporting
  const successfulRequests = results.filter(r => r.status === 201);
  const conflictedRequests = results.filter(r => r.status === 409);

  return res.json({
    message: "Concurrency collision stress-test completed.",
    results,
    summary: {
      totalSimulatedRequests: results.length,
      succeeded: successfulRequests.length,
      rejectedWithConflict: conflictedRequests.length,
      safeAssertionPassed: successfulRequests.length === 1 && conflictedRequests.length === 4
    }
  });
});

// -----------------------------------------------------------------------------
// Vite Configuration / Static Assets Serving
// -----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Padosi Server running on http://localhost:${PORT}`);
  });
}

startServer();
