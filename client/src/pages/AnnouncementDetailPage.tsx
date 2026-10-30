
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import {
  Announcement,
  AnnouncementMatchesResponse,
  isClosable,
  isEditable,
} from '../types/announcement';
import { useAuth } from '../auth/AuthContext';

// Detail page of one announcement: /announcements/:id.
// The hidden detail is never shown here.
export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, userId } = useAuth();

  const notice = (location.state as { notice?: string } | null)?.notice ?? '';

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<Announcement[]>([]);

  // Jira task: proof of ownership and discussion submission.
  const [proofDescription, setProofDescription] = useState('');
  const [discussionError, setDiscussionError] = useState('');
  const [discussionNotice, setDiscussionNotice] = useState('');
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);

  useEffect(() => {
    apiRequest<{ announcement: Announcement }>(`/announcements/${id}`)
      .then((data) => setAnnouncement(data.announcement))
      .catch((err: Error) => setError(err.message));

    apiRequest<AnnouncementMatchesResponse>(`/announcements/${id}/matches`)
      .then((data) =>
        setMatches(data.matches.map((match) => match.announcement)),
      )
      .catch(() => setMatches([]));
  }, [id]);

  async function remove() {
    if (
      !announcement ||
      !window.confirm(
        `Delete "${announcement.title}"? It will disappear from FindIt.`,
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/announcements/${announcement.id}`, {
        method: 'DELETE',
        token,
      });
      navigate('/my-announcements', {
        state: { notice: 'Announcement deleted.' },
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // SCRUM-21: "I got it back" closes a lost announcement.
  async function close() {
    if (
      !announcement ||
      !window.confirm(
        `Close "${announcement.title}"? Do it once you have your object back.`,
      )
    ) {
      return;
    }

    try {
      const data = await apiRequest<{ announcement: Announcement }>(
        `/announcements/${announcement.id}`,
        {
          method: 'PATCH',
          token,
          body: { status: 'Closed' },
        },
      );
      setAnnouncement(data.announcement);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Jira task: submit private proof of ownership and start a discussion.
  async function startDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!announcement || !token) {
      setDiscussionError('Please sign in to start a discussion.');
      return;
    }

    setDiscussionError('');
    setDiscussionNotice('');
    setSubmittingDiscussion(true);

    try {
      await apiRequest(
        `/announcements/${announcement.id}/discussions`,
        {
          method: 'POST',
          token,
          body: { description: proofDescription },
        },
      );

      setProofDescription('');
      setDiscussionNotice(
        'Your discussion has been started. The finder has been notified.',
      );
    } catch (err) {
      setDiscussionError((err as Error).message);
    } finally {
      setSubmittingDiscussion(false);
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

  const canStartDiscussion =
    Boolean(token) &&
    announcement.type === 'found' &&
    announcement.status === 'Available' &&
    announcement.authorId !== userId;

  return (
    <section className="card wide-card detail">
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}

      <span className={`badge ${announcement.type}`}>
        {announcement.type === 'found' ? 'Found' : 'Lost'}
      </span>

      <h1>{announcement.title}</h1>

      <p className="intro">
        {announcement.category.name} · {announcement.objectType.name}
      </p>

      {announcement.photos.length > 0 && (
        <div className="detail-photos">
          {announcement.photos.map((path, index) => (
            <img
              key={path}
              src={photoUrl(path)}
              alt={`${announcement.title}, photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      <p className="description">{announcement.description}</p>

      <dl className="facts">
        <dt>Date</dt>
        <dd>
          {new Date(
            `${announcement.eventDate}T00:00:00`,
          ).toLocaleDateString()}
        </dd>

        <dt>Place</dt>
        <dd>
          {announcement.place.name}
          {announcement.placeDetails
            ? `, ${announcement.placeDetails}`
            : ''}
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
            <dd>
              {announcement.currentLocation === 'finder'
                ? 'Kept by the finder'
                : 'At the reception desk'}
            </dd>
          </>
        )}

        <dt>Status</dt>
        <dd>{announcement.status}</dd>
      </dl>

      {/* Only the author sees these buttons. The server checks it again. */}
      {announcement.authorId === userId && isEditable(announcement) && (
        <div className="owner-actions">
          <Link
            className="secondary button-link"
            to={`/announcements/${announcement.id}/edit`}
          >
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

      {/* Jira task: only another signed-in user can submit a claim. */}
      {canStartDiscussion && (
        <div className="discussion-section">
          <h2>Claim this object</h2>

          <p>
            Provide a private detail that helps the finder verify that
            the object belongs to you.
          </p>

          {discussionNotice && (
            <p className="notice success" role="status">
              {discussionNotice}
            </p>
          )}

          {discussionError && (
            <p className="notice error" role="alert">
              {discussionError}
            </p>
          )}

          <form onSubmit={startDiscussion}>
            <label htmlFor="proofDescription">
              Proof of ownership
            </label>

            <textarea
              id="proofDescription"
              value={proofDescription}
              onChange={(event) =>
                setProofDescription(event.target.value)
              }
              placeholder="Describe a unique detail that proves this object belongs to you..."
              maxLength={1000}
              rows={5}
              required
            />

            <button
              className="primary"
              type="submit"
              disabled={
                submittingDiscussion || !proofDescription.trim()
              }
            >
              {submittingDiscussion
                ? 'Submitting...'
                : 'Start discussion'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
