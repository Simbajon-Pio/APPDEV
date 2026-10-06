import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ProtectedRoute } from './auth/ProtectedRoute.jsx';
import { StaffLayout } from './components/StaffLayout.jsx';
import { BlotterDetailPage } from './features/blotters/BlotterDetailPage.jsx';
import { BlotterFormPage } from './features/blotters/BlotterFormPage.jsx';
import { BlottersPage } from './features/blotters/BlottersPage.jsx';
import { ResidentReportDetailPage } from './features/reports/ResidentReportDetailPage.jsx';
import { ResidentReportsPage } from './features/reports/ResidentReportsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { PublicReportPage } from './pages/PublicReportPage.jsx';

export default function App() {
  return <Routes>
    <Route path="/report/:slug" element={<PublicReportPage />} />
    <Route path="/login" element={<AuthProvider><LoginPage /></AuthProvider>} />
    <Route path="/" element={<AuthProvider><ProtectedRoute /></AuthProvider>}>
      <Route element={<StaffLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="blotters" element={<BlottersPage />} />
        <Route path="blotters/new" element={<BlotterFormPage />} />
        <Route path="blotters/:id" element={<BlotterDetailPage />} />
        <Route path="resident-reports" element={<ResidentReportsPage />} />
        <Route path="resident-reports/:id" element={<ResidentReportDetailPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
