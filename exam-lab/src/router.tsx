import { createHashRouter, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Banks from './pages/Banks';
import ImportPage from './pages/ImportPage';
import Configure from './pages/Configure';
import ExamPage from './pages/ExamPage';
import Results from './pages/Results';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/banks', element: <Banks /> },
      { path: '/import', element: <ImportPage /> },
      { path: '/configure', element: <Configure /> },
      { path: '/results/:id', element: <Results /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '/exam/:id', element: <ExamPage /> }, // outside Layout: no dashboard navigation during an exam
  { path: '*', element: <Navigate to="/" replace /> },
]);
