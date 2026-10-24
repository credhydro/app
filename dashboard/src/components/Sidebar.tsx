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
        <NavItem label="Alerts" icon={BellIcon} to="/alerts" active={location.pathname === '/alerts'} />
        <NavItem label="Lights" icon={LightsIcon} to="/lights" active={location.pathname === '/lights'} />
        <NavItem label="pH Dosing" icon={DropletIcon} to="/ph-dosing" active={location.pathname === '/ph-dosing'} />
        <NavItem label="Pump" icon={PumpIcon} to="/pump" active={location.pathname === '/pump'} />
        <NavItem label="Fans" icon={FanIcon} to="/fans" active={location.pathname === '/fans'} />
        <NavItem label="Growth Photos" icon={PhotoIcon} to="/growth-photos" active={location.pathname === '/growth-photos'} />
        <NavItem label="Sensors" icon={SensorIcon} to="/sensors" active={location.pathname === '/sensors'} />
        <NavItem label="Settings" icon={SettingsIcon} to="/settings" active={location.pathname === '/settings'} />
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

export function SensorIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <path d="M8 2.5h4M9 2.5v8.2a3.5 3.5 0 102 0V2.5" />
      <path d="M3 6.5a7 7 0 000 7M17 6.5a7 7 0 010 7" />
    </svg>
  )
}

export function HomeIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
    </svg>
  )
}

export function LightsIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM6.343 5.657a1 1 0 00-1.414-1.414L3.515 5.657a1 1 0 001.414 1.414l1.414-1.414zM15.071 4.243a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414zM10 7a3 3 0 100 6 3 3 0 000-6zM3 11a1 1 0 000 2h1a1 1 0 100-2H3zM16 11a1 1 0 100 2h1a1 1 0 100-2h-1zM5.657 14.343a1 1 0 00-1.414 1.414l1.414 1.414a1 1 0 001.414-1.414l-1.414-1.414zM14.343 15.757a1 1 0 001.414-1.414l-1.414-1.414a1 1 0 00-1.414 1.414l1.414 1.414zM11 16a1 1 0 10-2 0v1a1 1 0 102 0v-1z" />
    </svg>
  )
}

export function DropletIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 2.5c.28 0 .543.128.717.348 1.61 2.03 5.783 7.63 5.783 10.652a6.5 6.5 0 11-13 0c0-3.022 4.173-8.622 5.783-10.652A.917.917 0 0110 2.5zm-3.5 11a.75.75 0 011.5 0 2 2 0 002 2 .75.75 0 010 1.5 3.5 3.5 0 01-3.5-3.5z" clipRule="evenodd" />
    </svg>
  )
}

export function BellIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a6 6 0 00-6 6v3.59l-.71.7A1 1 0 004 14h12a1 1 0 00.71-1.71L16 11.59V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  )
}

export function PumpIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.1A7 7 0 0116.9 8.1a1 1 0 01-1.94.5A5 5 0 006.6 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.06 9.1a1 1 0 011.22.72A5 5 0 0013.4 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.1a7 7 0 01-11.66-2.58 1 1 0 01.72-1.22z" clipRule="evenodd" />
    </svg>
  )
}

export function FanIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM9.2 7.1C8.6 4.6 9.4 2 11.6 2c1.9 0 2.6 2.4 1 4.1-.8.9-2 1.1-3.4 1zM12.9 9.2c2.5-.6 5.1.2 5.1 2.4 0 1.9-2.4 2.6-4.1 1-.9-.8-1.1-2-1-3.4zM10.8 12.9c.6 2.5-.2 5.1-2.4 5.1-1.9 0-2.6-2.4-1-4.1.8-.9 2-1.1 3.4-1zM7.1 10.8C4.6 11.4 2 10.6 2 8.4 2 6.5 4.4 5.8 6.1 7.4c.9.8 1.1 2 1 3.4z" />
    </svg>
  )
}

export function PhotoIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7 3a1 1 0 00-.8.4L5.25 5H4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.25l-.95-1.6A1 1 0 0013 3H7zm3 5a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z" clipRule="evenodd" />
    </svg>
  )
}

export function SettingsIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 01-2.29.95c-1.37-.84-2.94.73-2.1 2.1.54.88.07 2.03-.95 2.29-1.56.38-1.56 2.6 0 2.98 1.02.25 1.49 1.4.95 2.29-.84 1.37.73 2.94 2.1 2.1a1.53 1.53 0 012.29.95c.38 1.56 2.6 1.56 2.98 0a1.53 1.53 0 012.29-.95c1.37.84 2.94-.73 2.1-2.1a1.53 1.53 0 01.95-2.29c1.56-.38 1.56-2.6 0-2.98a1.53 1.53 0 01-.95-2.29c.84-1.37-.73-2.94-2.1-2.1a1.53 1.53 0 01-2.29-.95zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
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
