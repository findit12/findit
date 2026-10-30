import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import type {
  Discussion,
  DiscussionsResponse,
  Message,
  MessagesResponse,
} from '../types/discussion';

export default function MessagesPage() {
  const { token, userId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedDiscussionId = Number(searchParams.get('discussionId')) || null;

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedDiscussion =
    discussions.find(
      (discussion) => discussion.discussionId === selectedDiscussionId,
    ) ?? null;

  // Load the signed-in user's conversations.
  const loadDiscussions = useCallback(async () => {
    try {
      const data = await apiRequest<DiscussionsResponse>(
        '/announcements/discussions',
        { token },
      );

      setDiscussions(data.discussions);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load messages. The backend also marks incoming messages as read.
  const loadMessages = useCallback(async () => {
    if (!selectedDiscussionId) {
      setMessages([]);
      return;
    }

    try {
      const data = await apiRequest<MessagesResponse>(
        `/announcements/discussions/${selectedDiscussionId}/messages`,
        { token },
      );

      setMessages(data.messages);
      await loadDiscussions();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [selectedDiscussionId, token, loadDiscussions]);

  // Load conversations when the page opens.
  useEffect(() => {
    void loadDiscussions();

    const interval = window.setInterval(() => {
      void loadDiscussions();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadDiscussions]);

  // Load the selected conversation and refresh it every five seconds.
  useEffect(() => {
    void loadMessages();

    if (!selectedDiscussionId) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadMessages();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadMessages, selectedDiscussionId]);

  // Select a conversation from the inbox.
  function selectDiscussion(discussionId: number) {
    setSearchParams({ discussionId: String(discussionId) });
    setError('');
  }

  // Send a new message.
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDiscussionId || !content.trim()) {
      return;
    }

    setSending(true);
    setError('');

    try {
      await apiRequest(
        `/announcements/discussions/${selectedDiscussionId}/messages`,
        {
          method: 'POST',
          token,
          body: { content: content.trim() },
        },
      );

      setContent('');
      await loadMessages();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function participantName(discussion: Discussion): string {
    const firstName = discussion.otherParticipant.firstName ?? '';
    const lastName = discussion.otherParticipant.lastName ?? '';

    return `${firstName} ${lastName}`.trim() || 'FindIt user';
  }

  return (
    <section className="card wide-card">
      <h1>My messages</h1>

      {error && <p className="notice error">{error}</p>}

      <div className="messages-layout">
        <aside className="messages-inbox">
          <h2>Conversations</h2>

          {loading && <p>Loading conversations...</p>}

          {!loading && discussions.length === 0 && (
            <p className="intro">You have no conversations yet.</p>
          )}

          <ul className="my-list">
            {discussions.map((discussion) => (
              <li
                key={discussion.discussionId}
                className={
                  selectedDiscussionId === discussion.discussionId
                    ? 'conversation-selected'
                    : ''
                }
              >
                <button
                  type="button"
                  className="conversation-button"
                  onClick={() => selectDiscussion(discussion.discussionId)}
                >
                  <strong>{participantName(discussion)}</strong>

                  <span>{discussion.announcementTitle}</span>

                  <small>
                    {discussion.lastMessage?.content ??
                      'No messages yet'}
                  </small>

                  {discussion.unreadCount > 0 && (
                    <span className="unread-count">
                      {discussion.unreadCount} unread
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="messages-chat">
          {!selectedDiscussion && (
            <p className="intro">
              Select a conversation to start messaging.
            </p>
          )}

          {selectedDiscussion && (
            <>
              <div className="chat-header">
                <h2>{participantName(selectedDiscussion)}</h2>
                <p>{selectedDiscussion.announcementTitle}</p>
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <p className="intro">
                    No messages yet. Send the first message!
                  </p>
                )}

                {messages.map((message) => {
                  const ownMessage = message.senderId === userId;

                  return (
                    <div
                      key={message.id}
                      className={
                        ownMessage
                          ? 'chat-message own-message'
                          : 'chat-message other-message'
                      }
                    >
                      <p>{message.content}</p>
                      <small>
                        {new Date(message.createdAt).toLocaleString()}
                      </small>
                    </div>
                  );
                })}
              </div>

              <form className="chat-form" onSubmit={sendMessage}>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write your message..."
                  maxLength={2000}
                  rows={3}
                  required
                />

                <button
                  type="submit"
                  className="primary"
                  disabled={sending || !content.trim()}
                >
                  {sending ? 'Sending...' : 'Send message'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}