import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { Loader2 } from 'lucide-react'

// Initialize font attribute immediately on script load
const savedFont = localStorage.getItem("font_preference") || "roboto";
document.documentElement.setAttribute("data-font", savedFont);

function RootApp() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-primary, #0f172a)", color: "#fff" }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent, #2563eb)" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  // Keying App by currentUser.id guarantees 100% clean state destruction and recreation on user switch!
  return <App key={currentUser.id} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
