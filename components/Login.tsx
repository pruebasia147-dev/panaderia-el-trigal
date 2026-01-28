import React from 'react';
import { User } from '../types';
import { Store, ShieldCheck, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const handleSellerLogin = () => {
    onLogin({ id: 'u1', name: 'Vendedor Turno Mañana', role: 'seller' });
  };

  const handleAdminLogin = () => {
    onLogin({ id: 'a1', name: 'Gerente General', role: 'admin' });
  };

  return (
    <div className="min-h-screen bg-bakery-100 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-bakery-600 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white text-bakery-600 mb-4">
            <Store size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">Panadería El Trigal</h1>
          <p className="text-bakery-100 mt-2">Sistema de Punto de Venta</p>
        </div>

        <div className="p-8 space-y-6">
          <p className="text-center text-gray-600 font-medium">Seleccione su perfil de acceso</p>
          
          <button
            onClick={handleSellerLogin}
            className="w-full flex items-center p-4 bg-orange-50 border-2 border-orange-200 rounded-xl hover:bg-orange-100 hover:border-orange-300 transition-all group"
          >
            <div className="bg-orange-100 p-3 rounded-full text-orange-600 group-hover:scale-110 transition-transform">
              <UserIcon size={24} />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-bold text-gray-800">Soy Vendedor</h3>
              <p className="text-sm text-gray-500">Acceso a Caja y Despacho</p>
            </div>
          </button>

          <button
            onClick={handleAdminLogin}
            className="w-full flex items-center p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:bg-gray-100 hover:border-gray-300 transition-all group"
          >
            <div className="bg-gray-200 p-3 rounded-full text-gray-600 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <div className="ml-4 text-left">
              <h3 className="text-lg font-bold text-gray-800">Soy Administrador</h3>
              <p className="text-sm text-gray-500">Gestión de Inventario y Finanzas</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;