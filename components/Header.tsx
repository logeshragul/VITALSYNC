import React from 'react';
import { Activity, Radio, UserCircle, LogOut } from 'lucide-react';
import { AppTab, UserProfile } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg text-white shadow-md shadow-red-500/20">
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight tracking-tight">VitalSync <span className="text-red-600">Live</span></h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Professional Monitor</p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            
            {user ? (
              <>
                {/* Status Indicator */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 shadow-inner">
                  <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">System Active</span>
                  <Radio size={14} className="text-slate-400 ml-1" />
                </div>

                <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                {/* User Profile */}
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{user.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">Authorized ID: {user.id.slice(-4)}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-600 shadow-sm">
                    <UserCircle size={24} />
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                 <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                 <span>Guest Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
