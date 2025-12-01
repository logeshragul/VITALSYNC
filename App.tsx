import React from 'react';
import Header from './components/Header';
import LiveDashboard from './components/LiveDashboard';
import { AppTab } from './types';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Header activeTab={AppTab.DASHBOARD} setActiveTab={() => {}} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <LiveDashboard />
      </main>
    </div>
  );
};

export default App;