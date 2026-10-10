import { FormEvent, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

// Home page of a signed-in user. For now, it keeps the old "Found an item?" form unchanged.
export default function HomePage() {
  const { token } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  async function submitFound(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await apiRequest('/announcements/found', { method: 'POST', body: { title, description }, token });
      setMessage('Found item submitted. A confirmation email was sent.');
      setMessageType('success');
      setTitle('');
      setDescription('');
    } catch (error) {
      setMessage((error as Error).message);
      setMessageType('error');
    }
  }

  return (
    <section className="card found-card">
      <h1>Found an item?</h1>
      <p className="intro">Add the details below.</p>
      <form onSubmit={submitFound}>
        <label>
          Item
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <button className="primary">Submit</button>
      </form>
      {message && (
        <p className={`notice ${messageType}`} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
