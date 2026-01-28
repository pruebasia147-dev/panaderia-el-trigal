
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { AppSettings, Client, Product, Sale } from '../types';
import SalesAnalytics from './SalesAnalytics';
import ClientCRM from './ClientCRM';
import { 
  LayoutDashboard, Package, Users, Settings, LogOut, 
  TrendingUp, DollarSign, Edit, Menu, X, Plus, BarChart3, 
  Wallet, ArrowUpRight, CalendarClock, Activity, Calculator, Trash2,
  AlertCircle, CalendarDays, Coins, Warehouse, PieChart, Save, Upload
} from 'lucide-react';

interface AdminProps {
  onLogout: () => void;
}

// --- Types for Simulation ---
interface SimProduct extends Product {
    simDailyQty: number; // Estimated daily sales volume
}

interface SimExpense {
    id: string;
    name: string;
    amount: number;
    frequency: 'daily' | 'weekly' | 'monthly';
}

const AdminDashboard: React.FC<AdminProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'inventory' | 'clients' | 'simulation' | 'settings'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 0 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Simple edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // New State for Profit Detail Modal
  const [showProfitDetail, setShowProfitDetail] = useState(false);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    // getSettings es ahora async, asi que lo añadimos al Promise.all correctamente
    const [p, c, s, st] = await Promise.all([
      db.getProducts(),
      db.getClients(),
      db.getSales(),
      db.getSettings()
    ]);
    setProducts(p);
    setClients(c);
    setSales(s);
    setSettings(st);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleUpdateExchange = async (rate: number) => {
    const newSettings = { ...settings, exchangeRate: rate };
    setSettings(newSettings);
    await db.saveSettings(newSettings); // Added await
  };

  const handleSaveProduct = async (product: Product) => {
    await db.updateProduct(product);
    setEditingProduct(null);
    loadData();
  };

  const handleSaveClient = async (client: Client) => {
    await db.updateClient(client);
    setEditingClient(null);
    loadData();
  };

  const handleNavClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  // --- Backup Functions ---
  const handleDownloadBackup = async () => {
      const json = await db.getDatabaseDump();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_el_trigal_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          const json = event.target?.result as string;
          if (json) {
              const success = await db.restoreDatabase(json);
              if (success) {
                  alert('¡Base de datos restaurada con éxito! La página se recargará.');
                  window.location.reload();
              }
              // Error alert is handled inside db.restoreDatabase
          }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Financial & Projection Logic ---
  const calculateFinancials = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Helper to calc profit for a set of sales
    const getProfit = (saleList: Sale[]) => {
      let cost = 0;
      let revenue = 0;
      saleList.forEach(sale => {
        revenue += sale.totalAmount;
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          // Estimate cost based on current product cost (or 70% of price if product deleted)
          const itemCost = product ? product.cost * item.quantity : (item.subtotal * 0.7);
          cost += itemCost;
        });
      });
      return revenue - cost;
    };

    // 1. Daily Stats
    const todaySales = sales.filter(s => new Date(s.date) >= startOfToday);
    const todayRevenue = todaySales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayProfit = getProfit(todaySales);

    // 2. Monthly Stats
    const monthSales = sales.filter(s => new Date(s.date) >= startOfMonth);
    const monthRevenue = monthSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const monthProfit = getProfit(monthSales);

    // 3. Projections
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const avgDailyRevenue = monthRevenue / daysPassed;
    const projectedRevenue = monthRevenue + (avgDailyRevenue * (daysInMonth - daysPassed));

    // 4. Assets & Liabilities (Professional Additions)
    const totalDebt = clients.reduce((sum, c) => sum + c.debt, 0);
    const inventoryValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const lowStockCount = products.filter(p => p.stock <= 20).length;

    return { 
        todayRevenue, 
        todayProfit, 
        todayCount: todaySales.length,
        monthRevenue, 
        monthProfit, 
        projectedRevenue,
        totalDebt,
        inventoryValue,
        lowStockCount,
        todaySales // Pass this for the modal
    };
  };

  const financials = calculateFinancials();

  // --- Logic for Daily Profit Breakdown ---
  const getDailyProfitBreakdown = () => {
      const breakdown: Record<string, { 
          name: string, 
          qty: number, 
          revenue: number, 
          totalCost: number, 
          avgUnitPrice: number,
          unitCost: number 
      }> = {};

      financials.todaySales.forEach(sale => {
          sale.items.forEach(item => {
              const prod = products.find(p => p.id === item.productId);
              // Use current cost if available, else estimate
              const unitCost = prod ? prod.cost : (item.unitPrice * 0.6); 

              if (!breakdown[item.productId]) {
                  breakdown[item.productId] = {
                      name: item.productName,
                      qty: 0,
                      revenue: 0,
                      totalCost: 0,
                      avgUnitPrice: 0,
                      unitCost: unitCost
                  };
              }
              
              breakdown[item.productId].qty += item.quantity;
              breakdown[item.productId].revenue += item.subtotal;
              breakdown[item.productId].totalCost += (unitCost * item.quantity);
          });
      });

      // Convert to array and calculate unit averages
      return Object.values(breakdown).map(item => ({
          ...item,
          avgUnitPrice: item.revenue / item.qty,
          profit: item.revenue - item.totalCost
      })).sort((a,b) => b.profit - a.profit);
  };

  const profitBreakdown = getDailyProfitBreakdown();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
        <span className="font-bold text-lg text-bakery-600">Admin Panel</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 transform 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:relative md:translate-x-0
      `}>
        <div className="p-8 hidden md:block">
          <h1 className="text-2xl font-extrabold text-bakery-600 tracking-tight">El Trigal</h1>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-1">Panel Administrativo</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-20 md:mt-0">
          {[
            { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
            { id: 'analytics', label: 'Reportes Detallados', icon: BarChart3 },
            { id: 'simulation', label: 'Simulador (Nuevo)', icon: Calculator },
            { id: 'clients', label: 'Clientes CRM', icon: Users },
            { id: 'inventory', label: 'Inventario', icon: Package },
            { id: 'settings', label: 'Ajustes', icon: Settings },
          ].map((item) => (
             <button 
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                  activeTab === item.id 
                    ? 'bg-bakery-50 text-bakery-700 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? "text-bakery-500" : "text-gray-400"} /> 
                {item.label}
              </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 mb-16 md:mb-0">
          <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors w-full px-4 py-3 rounded-xl hover:bg-red-50 font-medium">
            <LogOut size={20} /> Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pt-20 md:pt-8 w-full max-w-[1600px] mx-auto scroll-smooth">
        {/* Same Dashboard UI as before, content omitted for brevity as it is unchanged logic-wise, just hooked to new data */}
        {/* ... The rest of your existing Dashboard UI code ... */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                    <p className="text-gray-500 mt-1">Resumen ejecutivo del negocio.</p>
                </div>
                <div className="hidden sm:block text-right">
                    <p className="text-sm font-bold text-bakery-600 bg-bakery-50 px-3 py-1 rounded-full border border-bakery-100">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
            </div>
            
            {/* --- Section 1: Today's Pulse --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Today Sales */}
                 <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Activity size={80}/></div>
                    <div>
                        <div className="flex items-center gap-2 text-bakery-400 mb-1">
                            <Activity size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Ventas de Hoy</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayRevenue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm text-gray-400 mt-1">{financials.todayCount} operaciones cerradas</p>
                    </div>
                 </div>

                 {/* Today Profit (CLICKABLE) */}
                 <div 
                    onClick={() => setShowProfitDetail(true)}
                    className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between h-48 group cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all"
                 >
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Wallet size={80}/></div>
                     <div>
                        <div className="flex items-center gap-2 text-emerald-100 mb-1">
                            <Wallet size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Ganancia Neta (Hoy)</span>
                        </div>
                        <h3 className="text-4xl font-bold tracking-tight">${financials.todayProfit.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                        <div className="flex items-center justify-between mt-1">
                             <p className="text-sm text-emerald-100 opacity-90">Margen real descontando costos</p>
                             <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-white/30 transition-colors">
                                <PieChart size={12} /> Ver Desglose
                             </span>
                        </div>
                    </div>
                 </div>
            </div>

            {/* --- Section 2: Month Overview & Projection --- */}
            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Rendimiento Mensual</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div 
                        onClick={() => setActiveTab('analytics')}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:border-bakery-200 group"
                    >
                        <div className="flex justify-between items-start">
                            <p className="text-gray-500 text-xs font-bold uppercase mb-2 group-hover:text-bakery-600 transition-colors">Acumulado Mes</p>
                            <ArrowUpRight size={16} className="text-gray-300 group-hover:text-bakery-500"/>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">${financials.monthRevenue.toLocaleString('es-US', {minimumFractionDigits: 0})}</p>
                    </div>
                    <div 
                        onClick={() => setActiveTab('analytics')}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:border-emerald-200 group"
                    >
                        <div className="flex justify-between items-start">
                            <p className="text-gray-500 text-xs font-bold uppercase mb-2 group-hover:text-emerald-600 transition-colors">Ganancia Mes</p>
                            <ArrowUpRight size={16} className="text-gray-300 group-hover:text-emerald-500"/>
                        </div>
                        <p className="text-3xl font-bold text-emerald-600">${financials.monthProfit.toLocaleString('es-US', {minimumFractionDigits: 0})}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-20 h-20 bg-bakery-50 rounded-bl-full"></div>
                        <p className="text-bakery-600 text-xs font-bold uppercase mb-2 relative z-10">Proyección Cierre</p>
                        <p className="text-3xl font-bold text-gray-900 relative z-10">${financials.projectedRevenue.toLocaleString('es-US', {maximumFractionDigits: 0})}</p>
                    </div>
                </div>
            </div>

            {/* --- Section 3: Professional Financial Metrics (Accounts Receivable & Assets) --- */}
            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Activos y Finanzas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Cuentas por Cobrar */}
                    <div 
                        onClick={() => setActiveTab('clients')}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group cursor-pointer hover:shadow-md hover:border-red-100 transition-all"
                    >
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 group-hover:text-red-500 transition-colors">Cuentas por Cobrar</p>
                            <h3 className="text-3xl font-bold text-red-600">${financials.totalDebt.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                            <p className="text-xs text-gray-400 mt-1">Capital pendiente de cobro</p>
                        </div>
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Coins size={24} />
                        </div>
                    </div>
                    
                    {/* Valor de Inventario */}
                    <div 
                        onClick={() => setActiveTab('inventory')}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group cursor-pointer hover:shadow-md hover:border-blue-100 transition-all"
                    >
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 group-hover:text-blue-500 transition-colors">Valor en Inventario</p>
                            <h3 className="text-3xl font-bold text-blue-900">${financials.inventoryValue.toLocaleString('es-US', {minimumFractionDigits: 2})}</h3>
                            <p className="text-xs text-gray-400 mt-1">Costo total mercancía en stock</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                            <Warehouse size={24} />
                        </div>
                    </div>

                    {/* Stock Alerts */}
                    <div 
                        onClick={() => setActiveTab('inventory')}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group cursor-pointer hover:shadow-md transition-all"
                    >
                        <div>
                            <p className="text-gray-500 text-xs font-bold uppercase mb-1">Alertas de Stock</p>
                            <h3 className={`text-3xl font-bold ${financials.lowStockCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {financials.lowStockCount}
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">Productos por agotarse</p>
                        </div>
                        <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${financials.lowStockCount > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                            <AlertCircle size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Section 4: Modern Chart --- */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Tendencia de Ingresos</h3>
                        <p className="text-sm text-gray-500">Comportamiento de ventas últimos 14 días</p>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                        <span className="w-2 h-2 rounded-full bg-bakery-500"></span>
                        <span className="text-xs font-bold text-gray-600">Ventas Diarias</span>
                    </div>
                </div>
                <div className="h-72 w-full">
                    <ModernSplineChart sales={sales} days={14} />
                </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
            <SalesAnalytics sales={sales} products={products} />
        )}

        {activeTab === 'simulation' && (
            <SimulationPanel products={products} />
        )}

        {activeTab === 'inventory' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Inventario</h2>
                <p className="text-gray-500">Gestión de productos y precios.</p>
              </div>
              <button 
                onClick={() => setEditingProduct({ id: crypto.randomUUID(), name: 'Nuevo Producto', priceRetail: 0, priceWholesale: 0, cost: 0, stock: 0, category: 'General' })}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
              >
                <Plus size={18} /> Nuevo Producto
              </button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="p-5">Producto</th>
                      <th className="p-5">Categoría</th>
                      <th className="p-5">Costo</th>
                      <th className="p-5">P. Detal</th>
                      <th className="p-5">P. Mayor</th>
                      <th className="p-5">Stock</th>
                      <th className="p-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-sm">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-5 font-bold text-gray-800">{p.name}</td>
                        <td className="p-5 text-gray-500">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">{p.category}</span>
                        </td>
                        <td className="p-5 text-gray-500">${p.cost.toFixed(2)}</td>
                        <td className="p-5 text-green-600 font-bold">${p.priceRetail.toFixed(2)}</td>
                        <td className="p-5 text-blue-600 font-bold">${p.priceWholesale.toFixed(2)}</td>
                        <td className="p-5">
                          <span className={`px-2 py-1 rounded-md font-bold text-xs ${p.stock < 20 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {p.stock} uds
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <button onClick={() => setEditingProduct(p)} className="text-gray-400 hover:text-bakery-600 p-2 transition-colors"><Edit size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
           <div className="h-full flex flex-col">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 flex-none">
                 <div>
                    <h2 className="text-2xl font-bold text-gray-900">Clientes CRM</h2>
                    <p className="text-gray-500 text-sm">Gestión inteligente de cartera.</p>
                 </div>
                 <button 
                    onClick={() => setEditingClient({ id: crypto.randomUUID(), name: '', businessName: '', debt: 0, creditLimit: 0, address: '' })}
                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                  >
                    <Plus size={18} /> Nuevo Cliente
                  </button>
               </div>
               
               {/* Advanced CRM Component with Data Refresh Callback */}
               <ClientCRM 
                    clients={clients} 
                    sales={sales} 
                    products={products}
                    onEditClient={setEditingClient} 
                    onRefreshData={loadData}
               />
            </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl w-full animate-in fade-in duration-500 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuración</h2>
                <p className="text-gray-500">Ajustes generales del sistema.</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-3">Tasa de Cambio (Bs/USD)</label>
              <div className="flex gap-4">
                <input 
                  type="number" 
                  className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-bakery-500 focus:border-bakery-500 outline-none transition-all font-mono text-lg bg-white"
                  value={settings.exchangeRate}
                  onChange={(e) => handleUpdateExchange(parseFloat(e.target.value))}
                />
                <button className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200">
                  Actualizar Tasa
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4">Esta tasa se usará para calcular los precios en Bolívares en el punto de venta y reportes.</p>
            </div>

            {/* BACKUP SECTION */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Save size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Respaldo y Seguridad</h3>
                        <p className="text-xs text-gray-500">Opciones de exportación.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                        onClick={handleDownloadBackup}
                        className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                    >
                        <Save size={32} className="text-gray-400 group-hover:text-blue-600 mb-2" />
                        <span className="font-bold text-gray-700">Descargar Copia JSON</span>
                        <span className="text-xs text-gray-400 text-center mt-1">Guardar datos localmente</span>
                    </button>

                    <button 
                        onClick={() => alert("La restauración debe hacerse por base de datos en la nube.")}
                        className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:bg-gray-50 cursor-not-allowed opacity-60"
                    >
                        <Upload size={32} className="text-gray-400 mb-2" />
                        <span className="font-bold text-gray-700">Restaurar Datos</span>
                        <span className="text-xs text-gray-400 text-center mt-1">Deshabilitado en modo Cloud</span>
                    </button>
                </div>
            </div>
          </div>
        )}
      </main>

      {/* PROFIT DETAIL MODAL - Unchanged ... */}
      {showProfitDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Wallet className="text-emerald-600" /> Reporte de Rentabilidad Diaria
                        </h2>
                        <p className="text-sm text-gray-500">Desglose de ganancias por producto vendido hoy.</p>
                    </div>
                    <button onClick={() => setShowProfitDetail(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="px-6 py-4 font-bold bg-white">Producto</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Cantidad</th>
                                <th className="px-6 py-4 font-bold text-center bg-white">Costo Unit. (Ref)</th>
                                <th className="px-6 py-4 font-bold text-center bg-white text-emerald-600">Ganancia Unit.</th>
                                <th className="px-6 py-4 font-bold text-right bg-white">Venta Total</th>
                                <th className="px-6 py-4 font-bold text-right bg-white text-emerald-700">Ganancia Neta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {profitBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-400">
                                        No hay ventas registradas hoy.
                                    </td>
                                </tr>
                            ) : (
                                profitBreakdown.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 px-2 py-1 rounded-md font-bold text-gray-700">{item.qty}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            ${item.unitCost.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-emerald-600 bg-emerald-50/10">
                                            +${(item.avgUnitPrice - item.unitCost).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-600">
                                            ${item.revenue.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600 bg-emerald-50/30">
                                            +${item.profit.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 bg-gray-900 text-white rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-20">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Resumen del Día</p>
                        <p className="text-sm opacity-80">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-400">${financials.todayProfit.toFixed(2)}</p>
                        <p className="text-xs text-emerald-200">Ganancia Neta Total</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-6 text-gray-900">
              {editingProduct.id ? 'Editar Producto' : 'Crear Producto'}
            </h3>
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Nombre</label>
                <input className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-bakery-400 outline-none bg-white text-gray-900" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Costo ($)</label>
                <input 
                    type="number" 
                    className="w-full border border-gray-300 p-3 rounded-xl bg-white text-gray-900" 
                    value={editingProduct.cost} 
                    onChange={e => setEditingProduct({...editingProduct, cost: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Stock Actual</label>
                <input 
                    type="number" 
                    className="w-full border border-gray-300 p-3 rounded-xl bg-white text-gray-900" 
                    value={editingProduct.stock} 
                    onChange={e => setEditingProduct({...editingProduct, stock: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1 block">Precio Detal ($)</label>
                <input 
                    type="number" 
                    className="w-full border-2 border-green-100 p-3 rounded-xl focus:border-green-500 outline-none bg-white text-gray-900" 
                    value={editingProduct.priceRetail} 
                    onChange={e => setEditingProduct({...editingProduct, priceRetail: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1 block">Precio Mayor ($)</label>
                <input 
                    type="number" 
                    className="w-full border-2 border-blue-100 p-3 rounded-xl focus:border-blue-500 outline-none bg-white text-gray-900" 
                    value={editingProduct.priceWholesale} 
                    onChange={e => setEditingProduct({...editingProduct, priceWholesale: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setEditingProduct(null)} className="px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleSaveProduct(editingProduct)} className="px-5 py-3 bg-bakery-600 text-white rounded-xl font-bold hover:bg-bakery-700 transition-colors shadow-lg shadow-orange-200">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-6 text-gray-900">
               {editingClient.id ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Nombre del Negocio</label>
                <input className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-bakery-400 outline-none bg-white text-gray-900" value={editingClient.businessName} onChange={e => setEditingClient({...editingClient, businessName: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Persona de Contacto</label>
                <input className="w-full border border-gray-300 p-3 rounded-xl bg-white text-gray-900" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Deuda Inicial ($)</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 p-3 rounded-xl bg-white text-gray-900" 
                    value={editingClient.debt} 
                    onChange={e => setEditingClient({...editingClient, debt: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Límite Crédito ($)</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 p-3 rounded-xl bg-white text-gray-900" 
                    value={editingClient.creditLimit} 
                    onChange={e => setEditingClient({...editingClient, creditLimit: e.target.value === '' ? ('' as any) : parseFloat(e.target.value)})} 
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setEditingClient(null)} className="px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Cancelar</button>
              <button onClick={() => handleSaveClient(editingClient)} className="px-5 py-3 bg-bakery-600 text-white rounded-xl font-bold hover:bg-bakery-700 transition-colors shadow-lg shadow-orange-200">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ... SimulationPanel and ModernSplineChart remain unchanged ...
// They are just helper components that don't call DB directly or were already receiving props.
// Re-declaring just in case to ensure file integrity in XML, but logically they are fine.

const SimulationPanel: React.FC<{ products: Product[] }> = ({ products }) => {
    // Local State for Simulation
    const [simProducts, setSimProducts] = useState<SimProduct[]>([]);
    const [expenses, setExpenses] = useState<SimExpense[]>([]);
    const [newExpenseName, setNewExpenseName] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseFreq, setNewExpenseFreq] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [workingDays, setWorkingDays] = useState<number>(26); // Default: Mon-Sat

    // Initialize Sim Products from Real Products
    useEffect(() => {
        setSimProducts(products.map(p => ({...p, simDailyQty: 0})));
    }, [products]);

    // Update simulation value
    const updateSimProduct = (id: string, field: keyof SimProduct, value: any) => {
        setSimProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    // Add Expense
    const addExpense = () => {
        if (!newExpenseName || !newExpenseAmount) return;
        const expense: SimExpense = {
            id: crypto.randomUUID(),
            name: newExpenseName,
            amount: parseFloat(newExpenseAmount),
            frequency: newExpenseFreq
        };
        setExpenses([...expenses, expense]);
        setNewExpenseName('');
        setNewExpenseAmount('');
    };

    const removeExpense = (id: string) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    // --- Calculations ---
    const calculateTotals = () => {
        // 1. Product Revenue & Cost (Daily Operational)
        let dailyRevenue = 0;
        let dailyCOGS = 0; // Cost of Goods Sold

        simProducts.forEach(p => {
            const qty = p.simDailyQty || 0;
            if (qty > 0) {
                dailyRevenue += p.priceRetail * qty;
                dailyCOGS += p.cost * qty;
            }
        });

        const dailyGrossProfit = dailyRevenue - dailyCOGS;

        // 2. Expenses (TOTAL MONTHLY NORMALIZED)
        let totalMonthlyExpenses = 0;
        
        expenses.forEach(e => {
            if (e.frequency === 'daily') totalMonthlyExpenses += (e.amount * workingDays);
            else if (e.frequency === 'weekly') totalMonthlyExpenses += (e.amount * 4.33); 
            else if (e.frequency === 'monthly') totalMonthlyExpenses += e.amount;
        });

        // 3. Monthly Projections
        const monthlyRevenue = dailyRevenue * workingDays;
        const monthlyCOGS = dailyCOGS * workingDays;
        const monthlyGrossProfit = monthlyRevenue - monthlyCOGS;
        const monthlyNetProfit = monthlyGrossProfit - totalMonthlyExpenses;

        return {
            dailyRevenue,
            dailyCOGS,
            dailyGrossProfit, // Without expenses
            
            // Monthly Totals
            monthlyRevenue,
            monthlyCOGS,
            totalMonthlyExpenses,
            monthlyNetProfit,

            margin: monthlyRevenue > 0 ? (monthlyNetProfit / monthlyRevenue) * 100 : 0
        };
    };

    const totals = calculateTotals();

    return (
        <div className="flex flex-col xl:flex-row gap-6 h-full animate-in fade-in duration-500">
            {/* Left Column: Configuration */}
            <div className="w-full xl:w-2/3 flex flex-col gap-6">
                
                {/* 0. Global Settings */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><CalendarDays size={18}/> Días Laborables</h3>
                        <p className="text-xs text-gray-500">¿Cuántos días abres al mes?</p>
                    </div>
                    <div className="flex items-center gap-3">
                         <div className="flex bg-gray-100 p-1 rounded-lg">
                             <button onClick={() => setWorkingDays(22)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${workingDays === 22 ? 'bg-white shadow text-bakery-600' : 'text-gray-500 hover:text-gray-900'}`}>L-V (22)</button>
                             <button onClick={() => setWorkingDays(26)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${workingDays === 26 ? 'bg-white shadow text-bakery-600' : 'text-gray-500 hover:text-gray-900'}`}>L-S (26)</button>
                             <button onClick={() => setWorkingDays(30)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${workingDays === 30 ? 'bg-white shadow text-bakery-600' : 'text-gray-500 hover:text-gray-900'}`}>30 Días</button>
                         </div>
                         <div className="relative w-20">
                             <input 
                                type="number" 
                                className="w-full p-2 border border-gray-300 rounded-lg text-center font-bold focus:border-bakery-500 outline-none bg-white text-gray-900"
                                value={workingDays}
                                onChange={e => setWorkingDays(Math.max(1, Math.min(31, parseInt(e.target.value) || 0)))}
                             />
                             <span className="absolute -bottom-4 left-0 w-full text-[9px] text-center text-gray-400">Personalizado</span>
                         </div>
                    </div>
                </div>

                {/* 1. Products Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <div>
                             <h3 className="font-bold text-gray-900 flex items-center gap-2"><Package size={18}/> Estimación de Ventas</h3>
                             <p className="text-xs text-gray-500">Ajusta el volumen diario estimado para calcular ingresos.</p>
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-0">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0 border-b border-gray-100 z-10">
                                <tr>
                                    <th className="px-5 py-3 bg-white">Producto</th>
                                    <th className="px-5 py-3 bg-white w-24">Costo ($)</th>
                                    <th className="px-5 py-3 bg-white w-24">Precio ($)</th>
                                    <th className="px-5 py-3 bg-white text-center w-32">Venta Diaria (Und)</th>
                                    <th className="px-5 py-3 bg-white text-right">Ganancia Bruta</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {simProducts.map(p => {
                                    const profit = (p.priceRetail - p.cost) * (p.simDailyQty || 0);
                                    return (
                                        <tr key={p.id} className={p.simDailyQty > 0 ? 'bg-orange-50/30' : ''}>
                                            <td className="px-5 py-3 font-medium text-gray-800">{p.name}</td>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:ring-1 focus:ring-bakery-400 outline-none transition-all"
                                                    value={p.cost}
                                                    onChange={e => updateSimProduct(p.id, 'cost', e.target.value === '' ? ('' as any) : parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input 
                                                    type="number" 
                                                    className="w-20 p-1 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:ring-1 focus:ring-bakery-400 outline-none transition-all"
                                                    value={p.priceRetail}
                                                    onChange={e => updateSimProduct(p.id, 'priceRetail', e.target.value === '' ? ('' as any) : parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <input 
                                                    type="number" 
                                                    className={`w-20 p-1.5 border rounded text-center font-bold outline-none focus:ring-2 focus:ring-bakery-400 transition-all ${p.simDailyQty > 0 ? 'border-bakery-400 bg-white' : 'bg-gray-50 border-gray-300'}`}
                                                    value={p.simDailyQty}
                                                    onChange={e => updateSimProduct(p.id, 'simDailyQty', e.target.value === '' ? ('' as any) : parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right font-bold text-bakery-700">
                                                ${profit.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. Expenses Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><DollarSign size={18}/> Gastos Operativos</h3>
                        <p className="text-xs text-gray-500">Agrega gastos fijos. <span className="font-bold">Nota:</span> Los gastos diarios se multiplicarán por {workingDays} días.</p>
                    </div>
                    <div className="p-5">
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <input 
                                type="text" 
                                placeholder="Nombre (ej. Alquiler, Luz)" 
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-bakery-500 bg-white text-gray-900"
                                value={newExpenseName}
                                onChange={e => setNewExpenseName(e.target.value)}
                            />
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                                <input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="w-32 p-2 pl-6 border border-gray-300 rounded-lg text-sm outline-none focus:border-bakery-500 bg-white text-gray-900"
                                    value={newExpenseAmount}
                                    onChange={e => setNewExpenseAmount(e.target.value)}
                                />
                            </div>
                            <select 
                                className="p-2 border border-gray-300 rounded-lg text-sm outline-none bg-white text-gray-900"
                                value={newExpenseFreq}
                                onChange={(e) => setNewExpenseFreq(e.target.value as any)}
                            >
                                <option value="daily">Diario</option>
                                <option value="weekly">Semanal</option>
                                <option value="monthly">Mensual</option>
                            </select>
                            <button 
                                onClick={addExpense}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                            >
                                Agregar
                            </button>
                        </div>

                        {expenses.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-4 border-2 border-dashed border-gray-100 rounded-xl">No hay gastos registrados aún.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {expenses.map(exp => (
                                    <div key={exp.id} className="bg-red-50 text-red-700 border border-red-100 px-3 py-2 rounded-lg flex items-center gap-3 text-sm">
                                        <div>
                                            <span className="font-bold block">{exp.name}</span>
                                            <span className="text-xs opacity-80">${exp.amount} / {exp.frequency === 'daily' ? 'día' : exp.frequency === 'weekly' ? 'sem' : 'mes'}</span>
                                        </div>
                                        <button onClick={() => removeExpense(exp.id)} className="text-red-400 hover:text-red-700"><Trash2 size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Results Dashboard */}
            <div className="w-full xl:w-1/3">
                <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-2xl sticky top-6">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Calculator className="text-bakery-400"/> Resultados
                    </h2>

                    {/* Daily Operational Card (simplified) */}
                    <div className="bg-white/10 rounded-2xl p-4 mb-4 border border-white/5">
                        <h4 className="text-xs font-bold text-bakery-400 uppercase tracking-widest mb-3">Día Operativo Típico</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-300">
                                <span>Ingreso Bruto</span>
                                <span className="text-white font-medium">${totals.dailyRevenue.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>Ganancia Bruta</span>
                                <span className="text-emerald-300 font-medium">+${totals.dailyGrossProfit.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Card (The Real Deal) */}
                    <div className="bg-gradient-to-br from-bakery-600 to-bakery-800 rounded-2xl p-5 mb-6 shadow-lg">
                        <div className="flex justify-between items-start mb-4 border-b border-white/20 pb-2">
                             <h4 className="text-xs font-bold text-bakery-200 uppercase tracking-widest">Proyección Mensual</h4>
                             <div className="flex items-center gap-1 text-xs bg-black/20 px-2 py-0.5 rounded">
                                <CalendarClock size={12}/> {workingDays} Días
                             </div>
                        </div>
                        
                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between text-bakery-100">
                                <span>Ventas Totales</span>
                                <span>${totals.monthlyRevenue.toFixed(0)}</span>
                            </div>
                             <div className="flex justify-between text-bakery-100">
                                <span>Costos Producción</span>
                                <span>-${totals.monthlyCOGS.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between text-bakery-100 font-bold">
                                <span>Gastos Fijos/Var.</span>
                                <span>-${totals.totalMonthlyExpenses.toFixed(0)}</span>
                            </div>
                        </div>

                        <div className="text-center py-2 bg-black/20 rounded-xl">
                            <p className="text-xs text-bakery-200 mb-1">Utilidad Neta Real</p>
                            <p className={`text-4xl font-bold ${totals.monthlyNetProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
                                ${totals.monthlyNetProfit.toLocaleString('es-US', {maximumFractionDigits: 0})}
                            </p>
                        </div>
                         <div className="mt-2 text-xs text-center text-bakery-200">
                             Margen Neto Real: {totals.margin.toFixed(1)}%
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="space-y-2">
                        {totals.monthlyNetProfit < 0 && (
                            <div className="flex items-start gap-2 bg-red-500/20 p-3 rounded-lg text-xs text-red-200 border border-red-500/30">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <p>Actualmente estás operando con pérdidas. Necesitas aumentar el volumen de ventas o reducir gastos.</p>
                            </div>
                        )}
                        {totals.monthlyNetProfit > 0 && totals.margin < 15 && (
                            <div className="flex items-start gap-2 bg-yellow-500/20 p-3 rounded-lg text-xs text-yellow-200 border border-yellow-500/30">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <p>Tu margen es bajo ({totals.margin.toFixed(1)}%). Revisa los costos de producción.</p>
                            </div>
                        )}
                         {totals.monthlyNetProfit > 0 && totals.margin >= 15 && (
                            <div className="flex items-start gap-2 bg-emerald-500/20 p-3 rounded-lg text-xs text-emerald-200 border border-emerald-500/30">
                                <TrendingUp size={16} className="flex-shrink-0 mt-0.5" />
                                <p>¡Buen margen de ganancia! Tu modelo de negocio parece saludable.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

// --- Modern Spline Chart Component (SVG Based) ---
const ModernSplineChart: React.FC<{ sales: Sale[], days: number }> = ({ sales, days }) => {
  const dataPoints = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dayStr = d.toDateString();
    const total = sales
      .filter(s => new Date(s.date).toDateString() === dayStr)
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    return { date: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }), value: total };
  });

  const maxVal = Math.max(...dataPoints.map(d => d.value), 50) * 1.2; 
  
  // Calculate Points
  const getX = (index: number) => (index / (days - 1)) * 100; 
  const getY = (val: number) => 100 - (val / maxVal) * 100;   

  // Cubic Bezier Path Generation
  let pathD = `M0,${getY(dataPoints[0].value)}`;
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const x0 = getX(i);
    const y0 = getY(dataPoints[i].value);
    const x1 = getX(i + 1);
    const y1 = getY(dataPoints[i + 1].value);
    
    // Control points (smoothing)
    const cp1x = x0 + (x1 - x0) * 0.5;
    const cp1y = y0;
    const cp2x = x1 - (x1 - x0) * 0.5;
    const cp2y = y1;
    
    pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`;
  }

  const fillPath = `${pathD} L100,100 L0,100 Z`;

  return (
    <div className="w-full h-full relative group/chart">
      {/* Background Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
         {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-b border-gray-900 w-full h-0"></div>)}
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Fill Area */}
        <path d={fillPath} fill="url(#chartGradient)" />
        
        {/* Line */}
        <path d={pathD} fill="none" stroke="#eab308" strokeWidth="1" strokeLinecap="round" filter="url(#glow)" />
        
        {/* Interactive Points */}
        {dataPoints.map((pt, i) => (
          <g key={i} className="group/point">
             {/* Invisible Hit Area for easier hovering */}
             <rect x={getX(i) - 5} y="0" width="10" height="100" fill="transparent" />
             
             {/* Point Circle */}
             <circle 
                cx={getX(i)} 
                cy={getY(pt.value)} 
                r="1.5" 
                fill="#fff" 
                stroke="#ca8a04" 
                strokeWidth="0.8" 
                className="opacity-0 group-hover/point:opacity-100 transition-opacity duration-200" 
             />

             {/* Vertical Guide Line on Hover */}
             <line 
                x1={getX(i)} y1={getY(pt.value)} 
                x2={getX(i)} y2={100} 
                stroke="#ca8a04" 
                strokeWidth="0.2" 
                strokeDasharray="1 1"
                className="opacity-0 group-hover/point:opacity-100"
             />

             {/* Tooltip */}
             <foreignObject x={Math.min(getX(i) - 15, 70)} y={Math.max(getY(pt.value) - 20, 0)} width="30" height="15" className="opacity-0 group-hover/point:opacity-100 transition-opacity pointer-events-none">
                 <div className="bg-gray-900/90 backdrop-blur-sm text-white text-[3px] rounded p-1 text-center shadow-lg border border-white/10">
                    <div className="font-bold">${pt.value.toFixed(0)}</div>
                    <div className="text-gray-300 text-[2px]">{pt.date}</div>
                 </div>
             </foreignObject>
          </g>
        ))}
      </svg>
      
      {/* X Axis Labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-400 font-medium px-1">
          <span>{dataPoints[0].date}</span>
          <span>{dataPoints[Math.floor(days/2)].date}</span>
          <span>{dataPoints[days-1].date}</span>
      </div>
    </div>
  );
};

export default ClientCRM;
