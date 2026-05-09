import { Sidebar } from './components/Sidebar'
import { HomePane } from './components/HomePane'

export default function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="home" />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header — hidden on md+ where sidebar is visible */}
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
