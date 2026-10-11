import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import NewAnnouncementPage from './pages/NewAnnouncementPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';
import EditAnnouncementPage from './pages/EditAnnouncementPage';
import MyAnnouncementsPage from './pages/MyAnnouncementsPage';

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
