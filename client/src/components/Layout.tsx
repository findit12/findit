import { Link, Outlet, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth/AuthContext';

// Frame shared by every page: the header, then the current page in <Outlet />.
export default function Layout() {
  const { token, signOut } = useAuth();
  const navigate = useNavigate();

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
        {token && (
          <nav className="header-links">
            <Link className="link-button" to="/my-announcements">
              My announcements
            </Link>
            <Link className="link-button" to="/saved-searches">
              Saved searches
            </Link>
            <Link className="link-button" to="/messages">
              Messages
            </Link>
            <button className="link-button" onClick={logout}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
