import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import { Announcement } from '../types/announcement';

// Detail page of one announcement: /announcements/:id. The hidden detail is never shown here.
export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const justCreated = (location.state as { created?: boolean } | null)?.created ?? false;

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ announcement: Announcement }>(`/announcements/${id}`)
      .then((data) => setAnnouncement(data.announcement))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <section className="card">
        <p className="notice error">{error}</p>
      </section>
    );
  }
  if (!announcement) {
    return <section className="card">Loading…</section>;
  }

  return (
    <section className="card wide-card detail">
      {justCreated && (
        <p className="notice success" role="status">
          Your announcement is published. A confirmation email is on its way.
        </p>
      )}

      <span className={`badge ${announcement.type}`}>{announcement.type === 'found' ? 'Found' : 'Lost'}</span>
      <h1>{announcement.title}</h1>
      <p className="intro">
        {announcement.category.name} · {announcement.objectType.name}
      </p>

      {announcement.photos.length > 0 && (
        <div className="detail-photos">
          {announcement.photos.map((path, index) => (
            <img key={path} src={photoUrl(path)} alt={`${announcement.title}, photo ${index + 1}`} />
          ))}
        </div>
      )}

      <p className="description">{announcement.description}</p>

      <dl className="facts">
        <dt>Date</dt>
        <dd>{new Date(`${announcement.eventDate}T00:00:00`).toLocaleDateString()}</dd>
        <dt>Place</dt>
        <dd>
          {announcement.place.name}
          {announcement.placeDetails ? `, ${announcement.placeDetails}` : ''}
        </dd>
        {announcement.brand && (
          <>
            <dt>Brand</dt>
            <dd>{announcement.brand}</dd>
          </>
        )}
        {announcement.color && (
          <>
            <dt>Color</dt>
            <dd>{announcement.color}</dd>
          </>
        )}
        {announcement.currentLocation && (
          <>
            <dt>Now</dt>
            <dd>{announcement.currentLocation === 'finder' ? 'Kept by the finder' : 'At the reception desk'}</dd>
          </>
        )}
        <dt>Status</dt>
        <dd>{announcement.status}</dd>
      </dl>
    </section>
  );
}
