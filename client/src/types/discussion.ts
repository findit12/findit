// SCRUM-30 to SCRUM-32: types of the discussions and messages (answers of /api/conversations).
import type { AnnouncementStatus, AnnouncementType } from './announcement';

export interface DiscussionParticipant {
  id: number;
  firstName: string | null;
  lastName: string | null;
}

export interface LastMessage {
  content: string;
  senderId: number;
  createdAt: string;
}

export interface Discussion {
  discussionId: number;
  announcementId: number;
  announcementTitle: string;
  announcementType: AnnouncementType;
  announcementStatus: AnnouncementStatus;
  // FR-17: "owner" sees "Mark as recovered", "finder" sees "Confirm handover".
  myRole: 'owner' | 'finder';
  otherParticipant: DiscussionParticipant;
  lastMessage: LastMessage | null;
  unreadCount: number;
  createdAt: string;
}

export interface DiscussionsResponse {
  discussions: Discussion[];
}

export interface Message {
  id: number;
  discussionId: number;
  senderId: number;
  content: string;
  createdAt: string;
  readAt: string | null;
}

// The proof written to start the discussion (FR-11): read by the author to check it.
export interface Proof {
  content: string;
  senderId: number;
  createdAt: string;
}

export interface MessagesResponse {
  proof: Proof;
  messages: Message[];
}
