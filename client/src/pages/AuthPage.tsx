import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

type Mode = 'register' | 'login' | 'forgot' | 'reset';

// Sign in, create an account, forgotten password, new password and email verification.
// Used by the routes /login, /verify and /reset-password.
export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, signIn } = useAuth();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Prevents the same verification link from being sent twice (React runs effects twice in development).
  const verificationStarted = useRef(false);

  const [mode, setMode] = useState<Mode>(location.pathname === '/reset-password' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [verificationState, setVerificationState] = useState<'none' | 'expired' | 'unverified'>('none');

  const resetToken = query.get('token') ?? '';

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
  };

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage('');
    setVerificationState('none');
  };

  // On /verify?token=..., sends the token to the server once.
  useEffect(() => {
    const verificationToken = query.get('token');
    if (!verificationToken || location.pathname !== '/verify' || verificationStarted.current) {
      return;
    }
    verificationStarted.current = true;

    apiRequest(`/auth/verify?token=${encodeURIComponent(verificationToken)}`)
      .then((data) => notify(data.message))
      .catch((error: ApiError) => {
        notify(error.message, 'error');
        setVerificationState(
          error.message.toLowerCase().includes('expired') || error.expired ? 'expired' : 'none',
        );
      });
  }, [query, location.pathname]);

  async function submitAccount(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setVerificationState('none');

    try {
      if (mode === 'register') {
        await apiRequest('/auth/register', { method: 'POST', body: { email, password } });
        notify('Account created. Check your email to verify it.');
      } else if (mode === 'login') {
        const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
        signIn(data.token);
        navigate('/');
      } else if (mode === 'forgot') {
        const data = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
        notify(data.message);
      } else {
        const data = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { token: resetToken, password },
        });
        selectMode('login');
        notify(data.message);
        setPassword('');
        navigate('/login', { replace: true });
      }
    } catch (error) {
      const err = error as ApiError;
      notify(err.message, 'error');
      if (err.unverified || err.message.toLowerCase().includes('verify')) {
        setVerificationState('unverified');
      }
    }
  }

  async function resend() {
    try {
      const data = await apiRequest('/auth/resend-verification', { method: 'POST', body: { email } });
      notify(data.message);
      setVerificationState('none');
    } catch (error) {
      notify((error as Error).message, 'error');
    }
  }

  // A signed-in user has nothing to do here.
  if (token) {
    return <Navigate to="/" replace />;
  }

  const heading =
    mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Reset password' : 'New password';
  const action =
    mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Reset password';

  return (
    <section className="card auth-card">
      <h1>{heading}</h1>

      {mode === 'forgot' && <p className="intro">Enter your school email address.</p>}
      {mode === 'reset' && <p className="intro">Choose a password with at least 8 characters and one number.</p>}

      {(mode === 'login' || mode === 'register') && (
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => selectMode('login')}>
            Sign in
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => selectMode('register')}>
            Create account
          </button>
        </div>
      )}

      <form onSubmit={submitAccount}>
        {mode !== 'reset' && (
          <label>
            School email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}
        {mode !== 'forgot' && (
          <label>
            {mode === 'reset' ? 'New password' : 'Password'}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
        )}
        {mode === 'register' && <small>At least 8 characters and one number.</small>}
        <button className="primary">{action}</button>
      </form>

      {mode === 'login' && (
        <button className="link-button" onClick={() => selectMode('forgot')}>
          Forgot password?
        </button>
      )}
      {(mode === 'forgot' || mode === 'reset') && (
        <button className="link-button" onClick={() => selectMode('login')}>
          Back to sign in
        </button>
      )}
      {(verificationState === 'expired' || verificationState === 'unverified') && (
        <button className="secondary" onClick={resend}>
          Resend verification email
        </button>
      )}

      {message && (
        <p className={`notice ${messageType}`} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
