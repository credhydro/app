import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { Sidebar } from './components/Sidebar'
import { HomePane } from './components/HomePane'

function Dashboard() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="home" />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}images/Credible_Logo.png.avif`}
            alt="Credible logo"
            className="h-8 w-auto object-contain"
          />
        </header>
        <main className="flex-1">
          <HomePane />
        </main>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-gray-50" />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
