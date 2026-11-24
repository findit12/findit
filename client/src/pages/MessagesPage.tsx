import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { Discussion, DiscussionsResponse, Message, MessagesResponse, Proof } from '../types/discussion';

// FR-12: the inbox and the open conversation are refreshed every 5 seconds (10 at most).
const REFRESH_MS = 5000;

// SCRUM-31 and SCRUM-32: my discussions on the left, the selected one on the right.
// The selected discussion is kept in the address (?discussionId=3), so the email links open it.
export default function MessagesPage() {
  const { token, userId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDiscussionId = Number(searchParams.get('discussionId')) || null;

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [proof, setProof] = useState<Proof | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [returning, setReturning] = useState(false);

  const selectedDiscussion = discussions.find((discussion) => discussion.discussionId === selectedDiscussionId) ?? null;

  // My discussions, with their unread counts.
  const loadDiscussions = useCallback(async () => {
    try {
      const data = await apiRequest<DiscussionsResponse>('/conversations', { token });
      setDiscussions(data.discussions);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // The proof and the messages of the selected discussion. The server marks them as read,
  // so the list is loaded again to update the unread counts.
  const loadMessages = useCallback(async () => {
    if (!selectedDiscussionId) {
      setProof(null);
      setMessages([]);
      return;
    }
    try {
      const data = await apiRequest<MessagesResponse>(`/conversations/${selectedDiscussionId}/messages`, { token });
      setProof(data.proof);
      setMessages(data.messages);
      await loadDiscussions();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedDiscussionId, token, loadDiscussions]);

  useEffect(() => {
    void loadDiscussions();
    const interval = window.setInterval(() => void loadDiscussions(), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadDiscussions]);

  useEffect(() => {
    void loadMessages();
    if (!selectedDiscussionId) {
      return;
    }
    const interval = window.setInterval(() => void loadMessages(), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadMessages, selectedDiscussionId]);

  function selectDiscussion(discussionId: number) {
    setSearchParams({ discussionId: String(discussionId) });
    setError('');
    setNotice('');
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDiscussionId || !content.trim()) {
      return;
    }
    setSending(true);
    setError('');
    try {
      await apiRequest(`/conversations/${selectedDiscussionId}/messages`, {
        method: 'POST',
        token,
        body: { content: content.trim() },
      });
      setContent('');
      await loadMessages();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  // FR-17: "Confirm handover" (finder) or "Mark as recovered" (owner). The announcement becomes
  // Returned and leaves the gallery.
  async function markReturned(discussion: Discussion, label: string) {
    if (!window.confirm(`${label}: "${discussion.announcementTitle}" will be marked as returned. Continue?`)) {
      return;
    }
    setReturning(true);
    setError('');
    try {
      await apiRequest(`/conversations/${discussion.discussionId}/return`, { method: 'POST', token });
      setNotice('The object is marked as returned. Thank you for using FindIt!');
      await loadDiscussions();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReturning(false);
    }
  }

  function participantName(discussion: Discussion): string {
    const firstName = discussion.otherParticipant.firstName ?? '';
    const lastName = discussion.otherParticipant.lastName ?? '';
    return `${firstName} ${lastName}`.trim() || 'FindIt user';
  }

  const isActive =
    selectedDiscussion?.announcementStatus === 'Available' || selectedDiscussion?.announcementStatus === 'Open';
  const returnLabel = selectedDiscussion?.myRole === 'owner' ? 'Mark as recovered' : 'Confirm handover';

  return (
    <section className="card wide-card">
      <h1>My messages</h1>

      {error && <p className="notice error">{error}</p>}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}

      <div className="messages-layout">
        <aside className="messages-inbox">
          <h2>Conversations</h2>
          {loading && <p>Loading conversations...</p>}
          {!loading && discussions.length === 0 && <p className="intro">You have no conversations yet.</p>}

          <ul className="my-list">
            {discussions.map((discussion) => (
              <li
                key={discussion.discussionId}
                className={selectedDiscussionId === discussion.discussionId ? 'conversation-selected' : ''}
              >
                <button
                  type="button"
                  className="conversation-button"
                  onClick={() => selectDiscussion(discussion.discussionId)}
                >
                  <strong>{participantName(discussion)}</strong>
                  <span>{discussion.announcementTitle}</span>
                  <small>{discussion.lastMessage?.content ?? 'No messages yet'}</small>
                  {discussion.unreadCount > 0 && <span className="unread-count">{discussion.unreadCount} unread</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="messages-chat">
          {!selectedDiscussion && <p className="intro">Select a conversation to start messaging.</p>}

          {selectedDiscussion && (
            <>
              <div className="chat-header">
                <h2>{participantName(selectedDiscussion)}</h2>
                <p>
                  <Link to={`/announcements/${selectedDiscussion.announcementId}`}>
                    {selectedDiscussion.announcementTitle}
                  </Link>
                  {!isActive && ` · ${selectedDiscussion.announcementStatus}`}
                </p>
                {isActive && !selectedDiscussion.closed && (
                  <button
                    type="button"
                    className="primary handover-button"
                    disabled={returning}
                    onClick={() => markReturned(selectedDiscussion, returnLabel)}
                  >
                    {returning ? 'Saving...' : returnLabel}
                  </button>
                )}
              </div>

              {/* FR-11: the proof that started the discussion, for the author to check. */}
              {proof && (
                <div className="chat-proof">
                  <strong>{proof.senderId === userId ? 'Your proof' : 'Proof sent to start the discussion'}</strong>
                  <p>{proof.content}</p>
                  <small>{new Date(proof.createdAt).toLocaleString()}</small>
                </div>
              )}

              <div className="chat-messages">
                {messages.length === 0 && <p className="intro">No messages yet. Send the first message!</p>}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.isSystem
                        ? 'chat-message system-message'
                        : message.senderId === userId
                          ? 'chat-message own-message'
                          : 'chat-message other-message'
                    }
                  >
                    <p>{message.content}</p>
                    <small>{new Date(message.createdAt).toLocaleString()}</small>
                  </div>
                ))}
              </div>

              {/* FR-14: after a drop-off at the reception, the discussion is closed. */}
              {selectedDiscussion.closed && (
                <p className="notice">
                  This discussion is closed: the object is at the reception desk. Claim it from the announcement page.
                </p>
              )}

              {!selectedDiscussion.closed && (
              <form className="chat-form" onSubmit={sendMessage}>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your message..."
                  maxLength={2000}
                  rows={3}
                  required
                />
                <button type="submit" className="primary" disabled={sending || !content.trim()}>
                  {sending ? 'Sending...' : 'Send message'}
                </button>
              </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
