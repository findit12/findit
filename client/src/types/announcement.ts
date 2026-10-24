// Shapes of the data exchanged with the API, and small rules about them.
// The names follow the SDD and the server code.

export type AnnouncementType = 'found' | 'lost';
export type CurrentLocation = 'finder' | 'reception';
export type AnnouncementStatus =
  | 'Available'
  | 'Open'
  | 'Returned'
  | 'Closed'
  | 'Hidden'
  | 'Deleted'
  | 'Archived';

// Answer of GET /api/reference-data: the lists of the form.
export interface NamedItem {
  id: number;
  name: string;
}
export interface CategoryOption extends NamedItem {
  objectTypes: NamedItem[];
}
export interface ReferenceData {
  categories: CategoryOption[];
  places: NamedItem[];
}

// An announcement as the API sends it. hiddenDetail is only present for the author.
export interface Announcement {
  id: number;
  type: AnnouncementType;
  status: AnnouncementStatus;
  title: string;
  category: NamedItem;
  objectType: NamedItem;
  description: string;
  brand: string | null;
  color: string | null;
  photos: string[];
  eventDate: string;
  place: NamedItem;
  placeDetails: string | null;
  currentLocation: CurrentLocation | null;
  authorId: number;
  createdAt: string;
  expiresAt: string;
  hiddenDetail?: string | null;
}

// Values typed in the form, before they are sent.
export interface AnnouncementFormValues {
  type: AnnouncementType;
  title: string;
  categoryId: string;
  objectTypeId: string;
  description: string;
  brand: string;
  color: string;
  eventDate: string;
  placeId: string;
  placeDetails: string;
  currentLocation: CurrentLocation | '';
  hiddenDetail: string;
}

// An announcement can be changed only while it is active (same rule as the server).
export function isEditable(announcement: Announcement): boolean {
  return announcement.status === 'Available' || announcement.status === 'Open';
}

// SCRUM-21: only an open lost announcement can be closed by its author.
export function isClosable(announcement: Announcement): boolean {
  return announcement.type === 'lost' && announcement.status === 'Open';
}

// Answer of GET /api/announcements (SCRUM-22): one page of the public gallery.
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface AnnouncementPage {
  announcements: Announcement[];
  meta: PageMeta;
}

// SCRUM-27: a search saved by the signed-in user (answer of GET /api/saved-searches).
// A criterion that is null means "no filter on this".
export interface SavedSearch {
  id: number;
  categoryId: number | null;
  objectTypeId: number | null;
  placeId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  q: string | null;
  createdAt: string;
}
// SCRUM-29: public matches returned by GET /announcements/:id/matches.
export interface AnnouncementMatch {
  score: number;
  announcement: Announcement;
}

export interface AnnouncementMatchesResponse {
  matches: AnnouncementMatch[];
}

