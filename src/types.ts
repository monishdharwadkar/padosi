export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  avatar: string;
  trustScore: number | null; // null = "new to Padosi"
  joinedAt: string;
  reviewsCount: number;
  onTimeReturnRate: number; // percentage
  noShowRate: number; // percentage
  disputeHistoryCount: number;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  ownerTrustScore: number | null;
  pricePerDay: number;
  deposit: number;
  latitude: number;
  longitude: number;
  imageUrl: string;
  availability: { start: string; end: string }[];
  createdAt: string;
}

export type BookingStatus =
  | 'requested'
  | 'approved'
  | 'picked_up'
  | 'returned'
  | 'closed'
  | 'disputed';

export interface Booking {
  id: string;
  itemId: string;
  itemTitle: string;
  itemImageUrl: string;
  itemOwnerId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerAvatar: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  deposit: number;
  status: BookingStatus;
  pickupPhotoOwner: string | null;
  pickupPhotoBorrower: string | null;
  pickupNotes: string | null;
  returnPhotoOwner: string | null;
  returnPhotoBorrower: string | null;
  returnNotes: string | null;
  conditionReport: string | null;
  paymentStatus: 'held' | 'released' | 'claimed' | 'none';
  disputeNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface SearchResult {
  items: Item[];
  semanticExplanation?: string;
}
