import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Announcement, isClosable, isEditable } from '../types/announcement';

// Page "My announcements": the list of the announcements of the signed-in user.
export default function MyAnnouncementsPage() {
  const { token, signOut } = useAuth();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? '';

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ announcements: Announcement[] }>('/announcements/mine', { token })
      .then((data) => setAnnouncements(data.announcements))
      .catch((err: ApiError) => {
        if (err.status === 401) signOut();
        setError(err.message);
      });
  }, [token, signOut]);

  async function remove(announcement: Announcement) {
    if (!window.confirm(`Delete "${announcement.title}"? It will disappear from FindIt.`)) {
      return;
    }
    try {
      await apiRequest(`/announcements/${announcement.id}`, { method: 'DELETE', token });
      setAnnouncements((current) => (current ?? []).filter((item) => item.id !== announcement.id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // SCRUM-21: closes a lost announcement and shows its new status in the list.
  async function close(announcement: Announcement) {
    if (!window.confirm(`Close "${announcement.title}"? Do it once you have your object back.`)) {
      return;
    }
    try {
      const data = await apiRequest<{ announcement: Announcement }>(`/announcements/${announcement.id}`, {
        method: 'PATCH',
        token,
        body: { status: 'Closed' },
      });
      setAnnouncements((current) =>
        (current ?? []).map((item) => (item.id === announcement.id ? data.announcement : item)),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card wide-card">
      <h1>My announcements</h1>
      {notice && <p className="notice success">{notice}</p>}
      {error && <p className="notice error">{error}</p>}
      {announcements && announcements.length === 0 && (
        <p className="intro">You have no announcement yet.</p>
      )}

      {announcements && announcements.length > 0 && (
        <ul className="my-list">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <div>
                <div className="my-labels">
                  <span className={`badge ${announcement.type}`}>
                    {announcement.type === 'found' ? 'Found' : 'Lost'}
                  </span>
                  <span className="status">{announcement.status}</span>
                </div>
                <Link className="my-title" to={`/announcements/${announcement.id}`}>
                  {announcement.title}
                </Link>
                <small>
                  {announcement.place.name} · {new Date(`${announcement.eventDate}T00:00:00`).toLocaleDateString()}
                </small>
              </div>
              {isEditable(announcement) && (
                <div className="row-actions">
                  <Link className="link-button" to={`/announcements/${announcement.id}/edit`}>
                    Edit
                  </Link>
                  <button className="link-button danger" onClick={() => remove(announcement)}>
                    Delete
                  </button>
                  {isClosable(announcement) && (
                    <button className="link-button" onClick={() => close(announcement)}>
                      Close
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
