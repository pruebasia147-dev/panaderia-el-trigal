
import React, { useEffect, useState } from 'react';
import Login from './components/Login';
import SellerView from './components/SellerView';
import AdminDashboard from './components/AdminDashboard';
import { db } from './services/db';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        await db.init();
      } catch (e) {
        console.error("Error conectando a BD", e);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 flex-col gap-4">
         <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
        <div className="text-orange-800 font-bold text-lg animate-pulse">
          Conectando con la Nube...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return <SellerView user={user} onLogout={handleLogout} />;
};

export default App;
