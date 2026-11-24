import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

// FR-19, NFR-SEC-03: the admin pages are only shown to an administrator. The server checks the
// role again on every admin request (AdminGuard): this wrapper only avoids showing an empty page.
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { role } = useAuth();

  if (role === 'admin') {
    return <>{children}</>;
  }
  return (
    <section className="card">
      {role === null ? <p className="intro">Checking your access...</p> : <p className="notice error">Administrator access required.</p>}
    </section>
  );
}
