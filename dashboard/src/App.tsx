import { Sidebar } from './components/Sidebar'
import { HomePane } from './components/HomePane'

export default function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="home" />
      <main className="flex-1">
        <HomePane />
      </main>
    </div>
  )
}
