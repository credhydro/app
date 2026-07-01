import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DevicePicker } from './DevicePicker'
import { TrialPicker } from './TrialPicker'
import { MonthPicker } from './MonthPicker'

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  return (
    <aside className="hidden md:flex w-56 min-h-screen bg-white border-r border-gray-100 flex-col shrink-0">
      <div className="px-5 py-6 border-b border-gray-100">
        <img
          src={`${import.meta.env.BASE_URL}images/Credible_Logo.png.avif`}
          alt="Credible logo"
          className="h-10 w-auto object-contain"
        />
      </div>

      <nav className="flex flex-col gap-1 p-3 mt-2">
        <NavItem label="Home" icon={HomeIcon} to="/" active={location.pathname === '/'} />
        <NavItem label="Lights" icon={LightsIcon} to="/lights" active={location.pathname === '/lights'} />
      </nav>

      <div className="mt-auto flex flex-col gap-2 p-3 border-t border-gray-100">
        {profile?.is_admin && <DevicePicker />}
        <TrialPicker />
        <MonthPicker />
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  label,
  icon: Icon,
  to,
  active,
}: {
  label: string
  icon: () => React.ReactElement
  to: string
  active: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      }`}
    >
      <Icon />
      {label}
    </Link>
  )
}

function HomeIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
    </svg>
  )
}

function LightsIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM6.343 5.657a1 1 0 00-1.414-1.414L3.515 5.657a1 1 0 001.414 1.414l1.414-1.414zM15.071 4.243a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414zM10 7a3 3 0 100 6 3 3 0 000-6zM3 11a1 1 0 000 2h1a1 1 0 100-2H3zM16 11a1 1 0 100 2h1a1 1 0 100-2h-1zM5.657 14.343a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414zM14.343 15.757a1 1 0 001.414-1.414l-1.414-1.414a1 1 0 00-1.414 1.414l1.414 1.414zM11 16a1 1 0 10-2 0v1a1 1 0 102 0v-1z" />
    </svg>
  )
}

function SignOutIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  )
}
