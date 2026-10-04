import { FormEvent, useEffect, useMemo, useState } from 'react';

const api = 'http://localhost:3000/api';
type Mode = 'register' | 'login' | 'forgot' | 'reset';

async function request(path: string, method = 'GET', body?: unknown, token?: string) {
  const response = await fetch(`${api}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export default function App() {
  const query = useMemo(() => new URLSearchParams(location.search), []);
  const [mode, setMode] = useState<Mode>(location.pathname === '/reset-password' ? 'reset' : 'login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('findit-token') ?? '');
  const [message, setMessage] = useState(''); const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [verificationState, setVerificationState] = useState<'none' | 'expired'>('none');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const resetToken = query.get('token') ?? '';
  const notify = (text: string, type: 'success' | 'error' = 'success') => { setMessage(text); setMessageType(type); };
  const selectMode = (nextMode: Mode) => { setMode(nextMode); setMessage(''); setVerificationState('none'); };

  useEffect(() => {
    const verificationToken = query.get('token');
    if (!verificationToken || location.pathname === '/reset-password') return;
    request(`/auth/verify?token=${encodeURIComponent(verificationToken)}`).then(data => notify(data.message)).catch(error => { notify(error.message, 'error'); setVerificationState(error.message.includes('expired') ? 'expired' : 'none'); });
  }, [query]);

  async function submitAccount(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try {
      if (mode === 'register') { await request('/auth/register', 'POST', { email, password }); notify('Account created. Check your email to verify it.'); }
      else if (mode === 'login') { const data = await request('/auth/login', 'POST', { email, password }); localStorage.setItem('findit-token', data.token); setToken(data.token); notify('Signed in.'); }
      else if (mode === 'forgot') { const data = await request('/auth/forgot-password', 'POST', { email }); notify(data.message); }
      else { const data = await request('/auth/reset-password', 'POST', { token: resetToken, password }); selectMode('login'); notify(data.message); setPassword(''); }
    } catch (error) { notify((error as Error).message, 'error'); }
  }
  async function resend() { try { const data = await request('/auth/resend-verification', 'POST', { email }); notify(data.message); setVerificationState('none'); } catch (error) { notify((error as Error).message, 'error'); } }
  async function submitFound(event: FormEvent) { event.preventDefault(); setMessage(''); try { await request('/announcements/found', 'POST', { title, description }, token); notify('Found item submitted. A confirmation email was sent.'); setTitle(''); setDescription(''); } catch (error) { notify((error as Error).message, 'error'); } }
  async function logout() { try { await request('/auth/logout', 'POST', undefined, token); } finally { localStorage.removeItem('findit-token'); setToken(''); notify('Signed out.'); } }

  const heading = mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Reset password' : 'New password';
  const action = mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Reset password';
  return <div className="page"><header><a href="/">FindIt</a>{token && <button className="link-button" onClick={logout}>Sign out</button>}</header><main>{!token ? <section className="card auth-card"><h1>{heading}</h1>{mode === 'forgot' && <p className="intro">Enter your school email address.</p>}{mode === 'reset' && <p className="intro">Choose a password with at least 8 characters and one number.</p>}{(mode === 'login' || mode === 'register') && <div className="tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => selectMode('login')}>Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => selectMode('register')}>Create account</button></div>}<form onSubmit={submitAccount}>{mode !== 'reset' && <label>School email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>}{mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>}{mode === 'register' && <small>At least 8 characters and one number.</small>}<button className="primary">{action}</button></form>{mode === 'login' && <button className="link-button" onClick={() => selectMode('forgot')}>Forgot password?</button>}{(mode === 'forgot' || mode === 'reset') && <button className="link-button" onClick={() => selectMode('login')}>Back to sign in</button>}{verificationState === 'expired' && <button className="secondary" onClick={resend}>Resend verification email</button>}{message && <p className={`notice ${messageType}`} role="status">{message}</p>}</section> : <section className="card found-card"><h1>Found an item?</h1><p className="intro">Add the details below.</p><form onSubmit={submitFound}><label>Item<input value={title} onChange={event => setTitle(event.target.value)} required /></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} required /></label><button className="primary">Submit</button></form>{message && <p className={`notice ${messageType}`} role="status">{message}</p>}</section>}</main></div>;
}
