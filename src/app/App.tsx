import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { useApi } from './api';
import { Login } from './pages/Login';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { ProjectView } from './pages/ProjectView';
import { AppShell } from './AppShell';
import { HistoryProvider } from './history';
import { Preloader } from './components/ui';

export function App() {
  const { data: me, error, loading } = useApi<{ email: string; is_admin: boolean }>('/api/auth/me');
  const navigate = useNavigate();
  const location = useLocation();

  // Hooks harus selalu dipanggil dengan urutan yang sama, jadi useEffect
  // ditaruh sebelum early return.
  useEffect(() => {
    // Tunggu /api/auth/me selesai sebelum memutuskan redirect
    if (loading) return;
    if ((error || !me) && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [loading, error, me, location.pathname, navigate]);

  // Tunggu response dari /api/auth/me selesai sebelum render apa pun
  if (loading) return <Preloader />;

  if (!me) return <Login />;

  // Pengaturan hanya untuk admin; member yang membuka /settings dikembalikan ke chat.
  return (
    <HistoryProvider>
      <AppShell me={me}>
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/profil" element={<Profile me={me} />} />
          <Route path="/settings" element={me.is_admin ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HistoryProvider>
  );
}
