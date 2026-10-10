import { Announcement } from './announcement.entity';

// What anyone can see about an announcement. The hidden detail is never included (NFR-PRIV-01).
// The announcement must be loaded with its category, objectType and place relations.
export function toPublicView(announcement: Announcement) {
  return {
    id: announcement.id,
    type: announcement.type,
    status: announcement.status,
    title: announcement.title,
    category: { id: announcement.category.id, name: announcement.category.name },
    objectType: { id: announcement.objectType.id, name: announcement.objectType.name },
    description: announcement.description,
    brand: announcement.brand,
    color: announcement.color,
    photos: announcement.photos.map((name) => `/uploads/${name}`),
    eventDate: announcement.eventDate,
    place: { id: announcement.place.id, name: announcement.place.name },
    placeDetails: announcement.placeDetails,
    currentLocation: announcement.currentLocation,
    authorId: announcement.authorId,
    createdAt: announcement.createdAt,
    expiresAt: announcement.expiresAt,
  };
}

// What the author sees: the public view plus the hidden detail.
export function toOwnerView(announcement: Announcement) {
  return { ...toPublicView(announcement), hiddenDetail: announcement.hiddenDetail };
}
