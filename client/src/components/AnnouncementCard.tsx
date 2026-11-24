import { Link } from 'react-router-dom';
import { photoUrl } from '../api';
import type { Announcement } from '../types/announcement';

// "2026-10-10" -> "10/10/2026" (written by hand to avoid time zone shifts).
function formatDate(day: string): string {
  return day.split('-').reverse().join('/');
}

// One announcement as a card: used by the gallery (SCRUM-22) and by the "similar announcements"
// of a detail page (SCRUM-29). Only public fields are used.
export default function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const isFound = announcement.type === 'found';
  const firstPhoto = announcement.photos[0];
  return (
    <li>
      <Link className="gallery-item" to={`/announcements/${announcement.id}`}>
        {firstPhoto ? (
          <img className="gallery-photo" src={photoUrl(firstPhoto)} alt={announcement.title} loading="lazy" />
        ) : (
          <div className="gallery-photo gallery-no-photo">No photo</div>
        )}
        <div className="gallery-body">
          <span className={`gallery-badge ${isFound ? 'badge-found' : 'badge-lost'}`}>
            {isFound ? 'Found' : 'Lost'}
          </span>
          <h2>{announcement.title}</h2>
          <p>
            {announcement.category.name} · {announcement.objectType.name}
          </p>
          <p>{announcement.place.name}</p>
          <p>{formatDate(announcement.eventDate)}</p>
        </div>
      </Link>
    </li>
  );
}
