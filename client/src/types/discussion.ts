// SCRUM-31: Types for conversations and messages.

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

export interface MessagesResponse {
  messages: Message[];
}
