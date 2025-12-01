import React, { useState } from 'react';
import Header from './components/Header';
import LiveDashboard from './components/LiveDashboard';
import Auth from './components/Auth';
import { AppTab, UserProfile } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col">
      <Header 
        activeTab={AppTab.DASHBOARD} 
        setActiveTab={() => {}} 
        user={user}
        onLogout={() => setUser(null)}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full flex flex-col">
        {user ? (
          <LiveDashboard />
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <Auth onLogin={(profile) => setUser(profile)} />
          </div>
        )}
      </main>

      <footer className="w-full py-6 text-center border-t border-slate-200 bg-white/80 backdrop-blur-sm mt-auto">
        <p className="text-sm text-slate-500 font-medium">
          Created by <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Logeshragul</span>
        </p>
      </footer>
    </div>
  );
};

export default App;
