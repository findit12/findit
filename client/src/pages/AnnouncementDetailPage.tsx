import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import {
  Announcement,
  AnnouncementMatchesResponse,
  isClosable,
  isEditable,
} from '../types/announcement';import { useAuth } from '../auth/AuthContext';

// Detail page of one announcement: /announcements/:id. The hidden detail is never shown here.
export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, userId } = useAuth();
  // A message sent by the previous page, for example after a creation or an edit.
  const notice = (location.state as { notice?: string } | null)?.notice ?? '';

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<Announcement[]>([]);

  
useEffect(() => {
  apiRequest<{ announcement: Announcement }>(`/announcements/${id}`)
    .then((data) => setAnnouncement(data.announcement))
    .catch((err: Error) => setError(err.message));

  apiRequest<{ matches: { score: number; announcement: Announcement }[] }>(
    `/announcements/${id}/matches`,
  )
    .then((data) => setMatches(data.matches.map((match) => match.announcement))
    )
    .catch(() => setMatches([]));
}, [id]);

  async function remove() {
    if (!announcement || !window.confirm(`Delete "${announcement.title}"? It will disappear from FindIt.`)) {
      return;
    }
    try {
      await apiRequest(`/announcements/${announcement.id}`, { method: 'DELETE', token });
      navigate('/my-announcements', { state: { notice: 'Announcement deleted.' } });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // SCRUM-21: "I got it back" closes a lost announcement. Closed is a final status.
  async function close() {
    if (!announcement || !window.confirm(`Close "${announcement.title}"? Do it once you have your object back.`)) {
      return;
    }
    try {
      const data = await apiRequest<{ announcement: Announcement }>(`/announcements/${announcement.id}`, {
        method: 'PATCH',
        token,
        body: { status: 'Closed' },
      });
      setAnnouncement(data.announcement);
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
      {notice && (
        <p className="notice success" role="status">
          {notice}
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

      {/* Only the author sees these buttons. The server checks it again on every request. */}
      {announcement.authorId === userId && isEditable(announcement) && (
        <div className="owner-actions">
          <Link className="secondary button-link" to={`/announcements/${announcement.id}/edit`}>
            Edit
          </Link>
          <button className="secondary danger" onClick={remove}>
            Delete
          </button>
          {isClosable(announcement) && (
            <button className="primary close-button" onClick={close}>
              I got it back: close the announcement
            </button>
          )}
        </div>
      )}
    </section>
  );
}
