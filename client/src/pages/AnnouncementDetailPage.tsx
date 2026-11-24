import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, photoUrl } from '../api';
import { Announcement, AnnouncementMatchesResponse, isClosable, isEditable } from '../types/announcement';
import type { DiscussionsResponse } from '../types/discussion';
import { useAuth } from '../auth/AuthContext';
import AnnouncementCard from '../components/AnnouncementCard';

// Detail page of one announcement: /announcements/:id.
// The hidden detail is never shown here (NFR-PRIV-01).
export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, userId } = useAuth();

  const notice = (location.state as { notice?: string } | null)?.notice ?? '';

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<Announcement[]>([]);
  // The id of my discussion about this announcement, if I already started one.
  const [myDiscussionId, setMyDiscussionId] = useState<number | null>(null);

  // SCRUM-30: proof written to start a discussion.
  const [proofDescription, setProofDescription] = useState('');
  const [discussionError, setDiscussionError] = useState('');
  const [submittingDiscussion, setSubmittingDiscussion] = useState(false);
  // FR-18: report the announcement.
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportNotice, setReportNotice] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    apiRequest<{ announcement: Announcement }>(`/announcements/${id}`)
      .then((data) => setAnnouncement(data.announcement))
      .catch((err: Error) => setError(err.message));

    apiRequest<AnnouncementMatchesResponse>(`/announcements/${id}/matches`)
      .then((data) => setMatches(data.matches.map((match) => match.announcement)))
      .catch(() => setMatches([]));
  }, [id]);

  // Only a signed-in user has discussions.
  useEffect(() => {
    if (!token) {
      setMyDiscussionId(null);
      return;
    }
    apiRequest<DiscussionsResponse>('/conversations', { token })
      .then((data) => {
        const mine = data.discussions.find((discussion) => discussion.announcementId === Number(id));
        setMyDiscussionId(mine ? mine.discussionId : null);
      })
      .catch(() => setMyDiscussionId(null));
  }, [id, token]);

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

  // SCRUM-21: "I got it back" closes a lost announcement.
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

  // SCRUM-30 (FR-11): sends the proof, then opens the new discussion.
  async function startDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!announcement) {
      return;
    }
    setDiscussionError('');
    setSubmittingDiscussion(true);
    try {
      const data = await apiRequest<{ discussionId: number }>('/conversations', {
        method: 'POST',
        token,
        body: { announcementId: announcement.id, description: proofDescription },
      });
      navigate(`/messages?discussionId=${data.discussionId}`);
    } catch (err) {
      setDiscussionError((err as Error).message);
    } finally {
      setSubmittingDiscussion(false);
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = reportReason.trim();
    if (!announcement || !reason) {
      setReportError('Please enter a reason for reporting this announcement.');
      return;
    }
    setReportError('');
    setReportNotice('');
    setSubmittingReport(true);
    try {
      await apiRequest(`/announcements/${announcement.id}/reports`, { method: 'POST', token, body: { reason } });
      setReportReason('');
      setReportNotice('Report submitted successfully for administrator review.');
    } catch (err) {
      setReportError((err as Error).message);
    } finally {
      setSubmittingReport(false);
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
    return <section className="card">Loading...</section>;
  }

  const isFound = announcement.type === 'found';
  const isAuthor = announcement.authorId === userId;
  const atReception = announcement.currentLocation === 'reception';
  // FR-11: a discussion is possible on a public announcement of someone else, unless the object
  // is at the reception desk (it is claimed there, FR-16).
  const canStartDiscussion = Boolean(token) && !isAuthor && isEditable(announcement) && !atReception;

  return (
    <section className="card wide-card detail">
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}

      <span className={`badge ${announcement.type}`}>{isFound ? 'Found' : 'Lost'}</span>
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

      {/* Only the author sees these buttons. The server checks it again. */}
      {isAuthor && isEditable(announcement) && (
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

      {/* SCRUM-30: my discussion already exists: one per user and announcement. */}
      {token && !isAuthor && myDiscussionId && (
        <p className="notice success">
          You already started a discussion about this announcement.{' '}
          <Link to={`/messages?discussionId=${myDiscussionId}`}>Open the discussion</Link>
        </p>
      )}

      {/* FR-16: an object at the reception desk is claimed there, with the proof. */}
      {!isAuthor && atReception && isEditable(announcement) && (
        <p className="notice">
          This object is kept at the reception desk. To claim it, go to the desk and describe a private detail of the
          object: the staff will check it.
        </p>
      )}

      {/* SCRUM-30 (FR-11): start a discussion with a proof. */}
      {canStartDiscussion && !myDiscussionId && (
        <div className="discussion-section">
          <h2>{isFound ? 'Is it yours?' : 'Did you find it?'}</h2>
          <p>
            {isFound
              ? 'Describe a private detail of the object (a mark, what is inside...). Only the finder reads it, to check that the object is yours.'
              : 'Describe the object you found, with a detail that shows it is this one. Only the owner reads it.'}
          </p>
          {discussionError && (
            <p className="notice error" role="alert">
              {discussionError}
            </p>
          )}
          <form onSubmit={startDiscussion}>
            <label htmlFor="proofDescription">{isFound ? 'Proof of ownership' : 'What you found'}</label>
            <textarea
              id="proofDescription"
              value={proofDescription}
              onChange={(event) => setProofDescription(event.target.value)}
              maxLength={1000}
              rows={5}
              required
            />
            <button className="primary" type="submit" disabled={submittingDiscussion || !proofDescription.trim()}>
              {submittingDiscussion ? 'Sending...' : 'Start a discussion'}
            </button>
          </form>
        </div>
      )}

      {!token && isEditable(announcement) && (
        <p className="intro">
          <Link to="/login">Sign in</Link> to contact {isFound ? 'the finder' : 'the owner'}.
        </p>
      )}

      {/* SCRUM-29: up to 4 similar announcements of the opposite type. */}
      {matches.length > 0 && (
        <div className="similar-section">
          <h2>{announcement.type === 'lost' ? 'Found objects that may be yours' : 'Lost announcements that may match'}</h2>
          <ul className="gallery-grid similar-grid">
            {matches.map((match) => (
              <AnnouncementCard key={match.id} announcement={match} />
            ))}
          </ul>
        </div>
      )}

      {/* FR-18: any signed-in user, except the author, can report the announcement. */}
      {token && !isAuthor && (
        <div className="discussion-section">
          <h2>Report this announcement</h2>
          <p>Let the administrators know why this announcement should be reviewed.</p>
          {reportNotice && (
            <p className="notice success" role="status">
              {reportNotice}
            </p>
          )}
          {reportError && (
            <p className="notice error" role="alert">
              {reportError}
            </p>
          )}
          <form onSubmit={submitReport}>
            <label htmlFor="reportReason">Reason for report</label>
            <textarea
              id="reportReason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Explain why you are reporting this announcement..."
              maxLength={1000}
              rows={4}
              required
            />
            <button className="primary" type="submit" disabled={submittingReport || !reportReason.trim()}>
              {submittingReport ? 'Submitting...' : 'Submit report'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
