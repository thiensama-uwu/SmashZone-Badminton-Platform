import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/shared/ScrollToTop';
import PrivateRoute from './components/PrivateRoute';
import SplashScreen from './components/shared/SplashScreen';
import { useAuth } from './contexts/useAuth';
import { usePushSubscription } from './hooks/usePushSubscription';
import { ThemeProvider } from './contexts/ThemeContext';

/* Layouts — eager load (always needed) */
import PublicLayout from './layouts/PublicLayout';
import AuthLayout from './layouts/AuthLayout';
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';

/* Pages — lazy load for code splitting */
const HomePage = lazy(() => import('./pages/public/HomePage'));
const CourtsListPage = lazy(() => import('./pages/public/CourtsListPage'));
const CourtDetailPage = lazy(() => import('./pages/public/CourtDetailPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const TermsPage = lazy(() => import('./pages/public/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'));
const PoliciesPage = lazy(() => import('./pages/public/PoliciesPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const BookingPage = lazy(() => import('./pages/customer/BookingPage'));
const PaymentPage = lazy(() => import('./pages/customer/PaymentPage'));
const PaymentReturnPage = lazy(() => import('./pages/customer/PaymentReturnPage'));
const HistoryPage = lazy(() => import('./pages/customer/HistoryPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const CourtManagementPage = lazy(() => import('./pages/admin/CourtManagementPage'));
const CourtEditorPage = lazy(() => import('./pages/admin/CourtEditorPage'));
const BookingManagementPage = lazy(() => import('./pages/admin/BookingManagementPage'));
const RefundQueuePage = lazy(() => import('./pages/admin/RefundQueuePage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/* Suspense fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-[3px] border-primary-container/30 border-t-primary-container animate-spin" />
        <span className="text-sm text-on-surface-variant">Đang tải...</span>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  usePushSubscription(isAuthenticated);

  return (
    <ThemeProvider>
      <SplashScreen />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public / Landing */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/courts" element={<CourtsListPage />} />
              <Route path="/courts/:slug" element={<CourtDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Route>

            {/* Auth */}
            <Route element={<AuthLayout />}>
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Customer App — requires customer role */}
            <Route element={<PrivateRoute requiredRoles={['customer']}><CustomerLayout /></PrivateRoute>}>
              <Route path="/customer/booking" element={<BookingPage />} />
              <Route path="/customer/payment" element={<PaymentPage />} />
              <Route path="/customer/payment/return" element={<PaymentReturnPage />} />
              <Route path="/customer/history" element={<HistoryPage />} />
              <Route path="/customer/profile" element={<ProfilePage />} />
            </Route>

            {/* Admin / Staff — requires admin or staff role */}
            <Route element={<PrivateRoute requiredRoles={['admin', 'staff']}><AdminLayout /></PrivateRoute>}>
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/courts" element={<CourtManagementPage />} />
              <Route path="/admin/courts/new" element={<CourtEditorPage />} />
              <Route path="/admin/courts/:id/edit" element={<CourtEditorPage />} />
              <Route path="/admin/bookings" element={<BookingManagementPage />} />
              <Route path="/admin/refunds" element={<RefundQueuePage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
            </Route>

            {/* Admin only — requires admin role */}
            <Route element={<PrivateRoute requiredRoles={['admin']}><AdminLayout /></PrivateRoute>}>
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/users" element={<UserManagementPage />} />
            </Route>

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
