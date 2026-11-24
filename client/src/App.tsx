import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import NewAnnouncementPage from './pages/NewAnnouncementPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import EditAnnouncementPage from './pages/EditAnnouncementPage';
import MyAnnouncementsPage from './pages/MyAnnouncementsPage';
import MySavedSearchesPage from './pages/MySavedSearchesPage';
import MessagesPage from './pages/MessagesPage';

// The admin pages use AG Grid and Highcharts, which are big: they are loaded only when an
// administrator opens them (React.lazy), so the other pages stay fast.
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminStatsPage = lazy(() => import('./pages/AdminStatsPage'));
const AdminClaimsPage = lazy(() => import('./pages/AdminClaimsPage'));

// FR-19: signed in, administrator, then the page once its code is loaded.
function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <Suspense fallback={<section className="card">Loading...</section>}>{children}</Suspense>
      </RequireAdmin>
    </RequireAuth>
  );
}

// List of the pages of the site: which address shows which component.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/verify" element={<AuthPage />} />
        <Route path="/reset-password" element={<AuthPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />

        <Route
          path="/announcements/new"
          element={
            <RequireAuth>
              <NewAnnouncementPage />
            </RequireAuth>
          }
        />

        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />

        <Route
          path="/announcements/:id/edit"
          element={
            <RequireAuth>
              <EditAnnouncementPage />
            </RequireAuth>
          }
        />

        <Route
          path="/my-announcements"
          element={
            <RequireAuth>
              <MyAnnouncementsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/saved-searches"
          element={
            <RequireAuth>
              <MySavedSearchesPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin/statistics"
          element={
            <AdminRoute>
              <AdminStatsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <AdminRoute>
              <AdminReportsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/claims"
          element={
            <AdminRoute>
              <AdminClaimsPage />
            </AdminRoute>
          }
        />

        {/* SCRUM-31: Protected messaging page. */}
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <MessagesPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
