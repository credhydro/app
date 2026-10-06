import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HomeIcon, LightsIcon, DropletIcon, PhotoIcon } from './Sidebar'

export function MobileTabBar() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t border-gray-100 flex items-stretch pb-[env(safe-area-inset-bottom)]">
      <TabItem label="Home" icon={HomeIcon} to="/" active={location.pathname === '/'} />
      <TabItem label="Lights" icon={LightsIcon} to="/lights" active={location.pathname === '/lights'} />
      <TabItem label="pH Dosing" icon={DropletIcon} to="/ph-dosing" active={location.pathname === '/ph-dosing'} />
      <TabItem label="Photos" icon={PhotoIcon} to="/growth-photos" active={location.pathname === '/growth-photos'} />
    </nav>
  )
}

function TabItem({
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
      className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
        active ? 'text-emerald-700' : 'text-gray-400'
      }`}
    >
      <Icon />
      {label}
    </Link>
  )
}
