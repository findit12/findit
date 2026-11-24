import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

// Frame shared by every page: the header, then the current page in <Outlet />.
export default function Layout() {
  const { token, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // FR-12: number of unread messages, refreshed every 10 seconds and on every page change.
  useEffect(() => {
    if (!token) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () =>
      apiRequest<{ unreadCount: number }>('/conversations/unread-count', { token })
        .then((data) => {
          if (active) setUnread(data.unreadCount);
        })
        .catch(() => {
          if (active) setUnread(0);
        });
    void load();
    const interval = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token, location.pathname]);

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST', token });
    } catch {
      // The server only confirms the logout. Removing the token locally is enough.
    } finally {
      signOut();
      navigate('/login');
    }
  }

  return (
    <div className="page">
      <header>
        <Link to="/">FindIt</Link>
        <nav className="header-links">
          {/* SCRUM-22: the gallery is public, so its link is always shown. */}
          <Link className="link-button" to="/gallery">
            Browse
          </Link>
          {token ? (
            <>
              <Link className="link-button" to="/my-announcements">
                My announcements
              </Link>
              <Link className="link-button" to="/saved-searches">
                Saved searches
              </Link>
              <Link className="link-button" to="/messages">
                Messages
                {unread > 0 && (
                  <span className="unread-badge" aria-label={`${unread} unread`}>
                    {unread}
                  </span>
                )}
              </Link>
              {role === 'admin' && (
                <>
                  <Link className="link-button" to="/admin/statistics">
                    Statistics
                  </Link>
                  <Link className="link-button" to="/admin/reports">
                    Moderation
                  </Link>
                  <Link className="link-button" to="/admin/claims">
                    Claims
                  </Link>
                  <Link className="link-button" to="/admin/reception">
                    Reception
                  </Link>
                  <Link className="link-button" to="/admin/users">
                    Users
                  </Link>
                </>
              )}
              <button className="link-button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link className="link-button" to="/login">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
