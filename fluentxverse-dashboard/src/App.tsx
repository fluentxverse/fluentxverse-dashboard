import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { SessionExpiredModal } from './Components/Common/SessionExpiredModal';
import { OfflineBanner } from './Components/Common/OfflineBanner';
import { ToastProvider } from './Components/Toast/Toast';

import { Header } from './components/Header';
import DashboardPage from './pages/DashboardPage';
import InterviewSchedulePage from './pages/InterviewSchedulePage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminsPage } from './pages/AdminsPage';
import TutorsPage from './pages/TutorsPage';
import StudentsPage from './pages/StudentsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InboxPage from './pages/InboxPage';
import LoginPage from './pages/LoginPage';
import TicketsPage from './pages/TicketsPage';

function TicketingPaused() {
  const location = useLocation();
  useEffect(() => { location.route('/', true); }, []);
  return null;
}
import SessionsPage from './pages/SessionsPage';
import RecordingsPage from './pages/RecordingsPage';
import LessonMaterialMakerPage from './pages/LessonMaterialMakerPage';
import LessonMaterialViewPage from './pages/LessonMaterialViewPage';
import CeoOrientationPage from './pages/CeoOrientationPage';
import PlatformOverviewPage from './pages/PlatformOverviewPage';
import ConversationalSkillsEditorPage from './pages/ConversationalSkillsEditorPage';
import ConversationalSkillsPreview from './pages/ConversationalSkillsPreview';
import ConversationalSkillsVisualEditor from './pages/ConversationalSkillsVisualEditor';
import DailyDispatchEditorPage from './pages/DailyDispatchEditorPage';
import DailyDispatchPreviewPage from './pages/DailyDispatchPreviewPage';
import DailyDispatchArchivePage from './pages/DailyDispatchArchivePage';
import DailyDispatchStudentPage from './pages/DailyDispatchStudentPage';
import YoungLearnersEditorPage from './pages/YoungLearnersEditorPage';
import YoungLearnersVisualEditor from './pages/YoungLearnersVisualEditor';
import YoungLearnersPreview from './pages/YoungLearnersPreview';
import DiscussionQuestionsEditorPage from './pages/DiscussionQuestionsEditorPage';
import DiscussionQuestionsVisualEditor from './pages/DiscussionQuestionsVisualEditor';
import BusinessEnglishEditorPage from './pages/BusinessEnglishEditorPage';
import BusinessEnglishPreview from './pages/BusinessEnglishPreview';
import BusinessEnglishVisualEditor from './pages/BusinessEnglishVisualEditor';
import AdminTasksPage from './pages/AdminTasksPage';
import TestingPage from './pages/TestingPage';
import LessonOperationsPage from './pages/LessonOperationsPage';
import OperationsLessonPage from './pages/OperationsLessonPage';
import OperationsAccountPage from './pages/OperationsAccountPage';

// Loading spinner component
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

// Protected layout wrapper
const ProtectedLayout = ({ children }: { children: any }) => {
  const { isAuthenticated, loading } = useAuthContext();
  const { path } = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = useCallback(() => {
    setNavigationOpen(false);
    document.getElementById('admin-navigation-toggle')?.focus();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar open={navigationOpen} onClose={closeNavigation} />
      <div className="dashboard-main">
        <Header navigationOpen={navigationOpen} onToggleNavigation={() => setNavigationOpen(value => !value)} />
        <main className="dashboard-content">
          {/* Replace the DOM boundary as well as the router's cached route tree. */}
          <div key={path} className="dashboard-route" data-route={path}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Main app content with routing
const AppContent = () => {
  const { isAuthenticated, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Interview room is fullscreen, no sidebar/header
  const path = location.path || location.url || window.location.pathname;
  const search = (() => {
    try {
      return window.location.search || '';
    } catch {
      return '';
    }
  })();
  const searchParams = (() => {
    try {
      return new URLSearchParams(search);
    } catch {
      return new URLSearchParams();
    }
  })();

  // Public lesson material view (used by server-hosted index.html redirect)
  if (path.startsWith('/lesson-material-maker') && (searchParams.has('previewToken') || searchParams.has('src'))) {
    return (
      <Router>
        <Route path="/lesson-material-maker" component={LessonMaterialMakerPage} />
      </Router>
    );
  }

  // Standalone preview page - no layout wrapper
  if (path.startsWith('/conversational-skills-preview')) {
    return (
      <Router>
        <Route path="/conversational-skills-preview/:id" component={ConversationalSkillsPreview} />
      </Router>
    );
  }

  // Standalone visual editor - no layout wrapper (fullscreen)
  if (path.startsWith('/conversational-skills-visual-editor')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/conversational-skills-visual-editor/:id" component={ConversationalSkillsVisualEditor} />
      </Router>
    );
  }

  // Daily Dispatch preview page - standalone (new tab)
  if (path.startsWith('/daily-dispatch-preview') || path.startsWith('/daily-dispatch/preview')) {
    return (
      <Router>
        <Route path="/daily-dispatch-preview/:id" component={DailyDispatchPreviewPage} />
        <Route path="/daily-dispatch/preview/:id" component={DailyDispatchPreviewPage} />
      </Router>
    );
  }

  // Daily Dispatch archive page - standalone
  if (path.startsWith('/daily-dispatch/archives')) {
    return (
      <Router>
        <Route path="/daily-dispatch/archives/:month" component={DailyDispatchArchivePage} />
      </Router>
    );
  }

  // Daily Dispatch student view - standalone (no tutor guides/answers)
  if (path.startsWith('/daily-dispatch/student')) {
    return (
      <Router>
        <Route path="/daily-dispatch/student/:id" component={DailyDispatchStudentPage} />
      </Router>
    );
  }

  // Young Learners preview page - standalone (kid-friendly view)
  if (path.startsWith('/young-learners-preview')) {
    return (
      <Router>
        <Route path="/young-learners-preview/:id" component={YoungLearnersPreview} />
      </Router>
    );
  }

  // Young Learners visual editor - standalone (fullscreen)
  if (path.startsWith('/young-learners-visual-editor')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/young-learners-visual-editor/:id" component={YoungLearnersVisualEditor} />
      </Router>
    );
  }

  // Business English visual editor - standalone (fullscreen)
  if (path.startsWith('/business-english-visual-editor')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/business-english-visual-editor/:id" component={BusinessEnglishVisualEditor} />
      </Router>
    );
  }

  // Business English preview page - standalone
  if (path.startsWith('/business-english-preview')) {
    return (
      <Router>
        <Route path="/business-english-preview/:id" component={BusinessEnglishPreview} />
      </Router>
    );
  }

  // Discussion Questions visual editor - standalone (fullscreen)
  if (path.startsWith('/discussion-questions-visual-editor')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/discussion-questions-visual-editor/:id" component={DiscussionQuestionsVisualEditor} />
      </Router>
    );
  }

  if (path.startsWith('/interview-room')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/interview-room/:interviewId?" component={InterviewRoomPage} />
      </Router>
    );
  }

  return (
    <ProtectedLayout>
      <Router>
        <Route path="/" component={DashboardPage} />
        <Route path="/interviews" component={InterviewSchedulePage} />
        <Route path="/applications" component={ApplicationsPage} />
        <Route path="/tutors" component={TutorsPage} />
        <Route path="/students" component={StudentsPage} />
        <Route path="/sessions" component={SessionsPage} />
        <Route path="/recordings" component={RecordingsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/inbox" component={InboxPage} />
        <Route path="/tasks" component={AdminTasksPage} />
        <Route path="/testing" component={TestingPage} />
        <Route path="/lesson-operations" component={LessonOperationsPage} />
        <Route path="/lesson-operations/:id" component={OperationsLessonPage} />
        <Route path="/operations/people/:role/:id" component={OperationsAccountPage} />
        <Route path="/payments" component={LessonOperationsPage} />
        <Route path="/tickets" component={import.meta.env.VITE_ENABLE_TICKETING === 'true' ? TicketsPage : TicketingPaused} />
        <Route path="/lesson-material-maker" component={LessonMaterialMakerPage} />
        <Route path="/conversational-skills-editor" component={ConversationalSkillsEditorPage} />
        <Route path="/conversational-skills-preview/:id" component={ConversationalSkillsPreview} />
        <Route path="/daily-dispatch" component={DailyDispatchEditorPage} />
        <Route path="/daily-dispatch-preview/:id" component={DailyDispatchPreviewPage} />
        <Route path="/young-learners-editor" component={YoungLearnersEditorPage} />
        <Route path="/discussion-questions-editor" component={DiscussionQuestionsEditorPage} />
        <Route path="/business-english-editor" component={BusinessEnglishEditorPage} />
        <Route path="/business-english-preview/:id" component={BusinessEnglishPreview} />
        <Route path="/lesson-material-view" component={LessonMaterialViewPage} />
        <Route path="/ceo-orientation" component={CeoOrientationPage} />
        <Route path="/platform-overview" component={PlatformOverviewPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admins" component={AdminsPage} />
      </Router>
    </ProtectedLayout>
  );
};

export function App() {
  return (
    <LocationProvider>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          <AppContent />
          <SessionExpiredModal />
        </ToastProvider>
      </AuthProvider>
    </LocationProvider>
  );
}
