
import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChatIcon, MemoryIcon, CalendarIcon, SettingsIcon, GraphIcon, BirdIcon, ArchiveIcon, GradeIcon, StageIcon, PlusIcon, TeamIcon, BrandIcon, ClientIcon, PrivateDMIcon, ProgressionIcon } from './icons/Icons';

interface SidebarProps {
  isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false }) => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
      isActive
        ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/10 text-white shadow-lg shadow-blue-500/10 border-l-2 border-blue-500'
        : 'text-gray-400 hover:bg-gray-700/50 hover:text-white hover:translate-x-1'
    }`;

  return (
    <div
      className={`
        w-64 bg-[#202123] p-4 flex flex-col border-r border-black/20 shadow-xl
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-40
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-center gap-2 text-gray-200 group cursor-pointer transition-transform hover:scale-105">
            <BirdIcon className="w-7 h-7 transition-transform group-hover:rotate-12" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Seasuite
            </h1>
        </div>
      </div>
      <nav className="flex flex-col gap-1.5 overflow-y-auto flex-1">
        <NavLink to="/" className={navLinkClass}>
          <ChatIcon />
          <span>Chat</span>
        </NavLink>
        <NavLink to="/memory" className={navLinkClass}>
          <MemoryIcon />
          <span>Memory</span>
        </NavLink>
        <NavLink to="/journal" className={navLinkClass}>
          <CalendarIcon />
          <span>Journal</span>
        </NavLink>
        <NavLink to="/threads" className={navLinkClass}>
          <ArchiveIcon className="h-6 w-6" />
          <span>Threads</span>
        </NavLink>
        <NavLink to="/brand" className={navLinkClass}>
          <BrandIcon className="h-6 w-6" />
          <span>Brand</span>
        </NavLink>
        <NavLink to="/clients" className={navLinkClass}>
          <ClientIcon className="h-6 w-6" />
          <span>Clients</span>
        </NavLink>
        <NavLink to="/hrmr" className={navLinkClass}>
          <GradeIcon className="h-6 w-6" />
          <span>HRMR</span>
        </NavLink>
        <NavLink to="/performers" className={navLinkClass}>
          <StageIcon className="h-6 w-6" />
          <span>Performers</span>
        </NavLink>
        <NavLink to="/team" className={navLinkClass}>
          <TeamIcon className="h-6 w-6" />
          <span className="text-sm">Team Interactions</span>
        </NavLink>
        <NavLink to="/private-dms" className={navLinkClass}>
          <PrivateDMIcon className="h-6 w-6" />
          <span>Private DMs</span>
        </NavLink>
        <NavLink to="/progress" className={navLinkClass}>
          <ProgressionIcon className="h-6 w-6" />
          <span>Progression</span>
        </NavLink>
        <NavLink to="/memory-onboarding" className={navLinkClass}>
          <PlusIcon className="h-6 w-6" />
          <span>Onboarding</span>
        </NavLink>
        <NavLink to="/graph" className={navLinkClass}>
          <GraphIcon />
          <span>Graph</span>
        </NavLink>
      </nav>
      <div className="mt-4">
        <NavLink to="/settings" className={navLinkClass}>
          <SettingsIcon />
          <span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
