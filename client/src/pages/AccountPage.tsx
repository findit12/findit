import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import type { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';

// FR-25 and NFR-PRIV-03: the signed-in user deletes their own account (GDPR right to erasure).
// The server anonymizes the account: personal data erased, public announcements archived,
// saved searches removed, and the login is refused afterwards.
export default function AccountPage() {
  const { token, userId, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function deleteAccount() {
    if (userId === null) {
      setError('Sign in again to delete your account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/users/' + userId, { method: 'DELETE', token });
      signOut();
      navigate('/login');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 401) {
        signOut();
        navigate('/login');
        return;
      }
      setError(apiError.message);
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>My account</h1>
      <h2>Delete my account</h2>
      <p className="intro">You can ask for the deletion of your account and your personal data at any time.</p>
      <ul>
        <li>Your name and email address are erased and you can no longer sign in.</li>
        <li>Your announcements that are still public are archived.</li>
        <li>Your saved searches are removed.</li>
        <li>This cannot be undone.</li>
      </ul>
      {error && <p className="notice error">{error}</p>}
      {!confirming ? (
        <button className="danger" onClick={() => setConfirming(true)}>
          Delete my account
        </button>
      ) : (
        <div className="owner-actions" role="alertdialog" aria-label="Confirm the deletion of your account">
          <p>
            <strong>Do you really want to delete your account?</strong>
          </p>
          <button className="danger" onClick={deleteAccount} disabled={busy}>
            {busy ? 'Deleting...' : 'Yes, delete my account'}
          </button>
          <button onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
