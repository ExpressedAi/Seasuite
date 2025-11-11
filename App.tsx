import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import MemoryPage from './pages/MemoryPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import ThreadsPage from './pages/ThreadsPage';
import HrmrPage from './pages/HrmrPage';
import PerformersPage from './pages/PerformersPage';
import MemoryOnboardingPage from './pages/MemoryOnboardingPage';
import TeamInteractionsPage from './pages/TeamInteractionsPage';
import BrandIntelligencePage from './pages/BrandIntelligencePage';
import ClientProfilesPage from './pages/ClientProfilesPage';
import PrivateDMsPage from './pages/PrivateDMsPage';
import ProgressionPage from './pages/ProgressionPage';
import { ToastContainer, useToast } from './components/Toast';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const [isTransitioning, setIsTransitioning] = React.useState(false);

    React.useEffect(() => {
        setIsTransitioning(true);
        const timer = setTimeout(() => setIsTransitioning(false), 150);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    return (
        <div
            className={`transition-opacity duration-150 ${
                isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
        >
            {children}
        </div>
    );
};

const AppContent: React.FC = () => {
    const { toasts, dismiss } = useToast();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const location = useLocation();

    // Close sidebar on route change (mobile)
    React.useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Close sidebar when clicking outside (mobile)
    const sidebarRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (window.innerWidth < 768 && isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSidebarOpen]);

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden fixed top-4 left-4 z-50 bg-[#202123] p-3 rounded-lg shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
            >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isSidebarOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-30"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div ref={sidebarRef}>
                <Sidebar isOpen={isSidebarOpen} />
            </div>

            <main className="flex-1 overflow-y-auto flex flex-col">
                <PageTransition>
                    <Routes>
                        <Route path="/" element={<ChatPage />} />
                        <Route path="/memory" element={<MemoryPage />} />
                        <Route path="/journal" element={<CalendarPage />} />
                        <Route path="/graph" element={<KnowledgeGraphPage />} />
                        <Route path="/threads" element={<ThreadsPage />} />
                        <Route path="/hrmr" element={<HrmrPage />} />
                        <Route path="/performers" element={<PerformersPage />} />
                        <Route path="/team" element={<TeamInteractionsPage />} />
                        <Route path="/memory-onboarding" element={<MemoryOnboardingPage />} />
                        <Route path="/brand" element={<BrandIntelligencePage />} />
                        <Route path="/clients" element={<ClientProfilesPage />} />
                        <Route path="/private-dms" element={<PrivateDMsPage />} />
                        <Route path="/progress" element={<ProgressionPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </PageTransition>
            </main>
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <div className="flex h-screen bg-[#26282B] text-white overflow-hidden">
                <AppContent />
            </div>
        </Router>
    );
};

export default App;
