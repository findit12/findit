import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
import NewAnnouncementPage from './pages/NewAnnouncementPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import EditAnnouncementPage from './pages/EditAnnouncementPage';
import MyAnnouncementsPage from './pages/MyAnnouncementsPage';
import MySavedSearchesPage from './pages/MySavedSearchesPage';
import MessagesPage from './pages/MessagesPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminStatsPage from './pages/AdminStatsPage';

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
          path="/admin/statistics" element={<RequireAuth><AdminStatsPage /></RequireAuth>} />
        <Route path="/admin/reports"
          element={
            <RequireAuth>
              <AdminReportsPage />
            </RequireAuth>
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
