// SCRUM-53 (FR-16): a claim on an object held at the reception (answers of /api/claims).
export interface Claim {
  id: number;
  announcementId: number;
  claimantId: number;
  proof: string;
  status: 'pending' | 'accepted' | 'declined';
  reviewedAt: string | null;
  createdAt: string;
}
