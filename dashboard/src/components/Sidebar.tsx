import React from 'react'

interface Props {
  active: string
}

export function Sidebar({ active }: Props) {
  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col shrink-0">
      <div className="px-5 py-6 border-b border-gray-100">
        <img
          src={`${import.meta.env.BASE_URL}images/Credible_Logo.png.avif`}
          alt="Credible logo"
          className="h-10 w-auto object-contain"
        />
      </div>

      <nav className="flex flex-col gap-1 p-3 mt-2">
        <NavItem label="Home" icon={HomeIcon} active={active === 'home'} />
      </nav>
    </aside>
  )
}

function NavItem({ label, icon: Icon, active }: { label: string; icon: () => React.ReactElement; active: boolean }) {
  return (
    <button
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      }`}
    >
      <Icon />
      {label}
    </button>
  )
}

function HomeIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
    </svg>
  )
}
