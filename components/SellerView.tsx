import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { AppSettings, CartItem, Client, Product, Sale, SaleItem, SuspendedSale, User } from '../types';
import { DispatchClientCard } from './DispatchClientCard';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, 
  History, LogOut, DollarSign, Store, Truck, X, ChevronUp, ChevronDown, ImageOff,
  PauseCircle, PlayCircle, Clock
} from 'lucide-react';

interface SellerViewProps {
  user: User;
  onLogout: () => void;
}

const SellerView: React.FC<SellerViewProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'dispatch'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ exchangeRate: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart toggle
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([]);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  
  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);
  const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(null);

  const loadData = async () => {
    const [p, c, s, susp] = await Promise.all([
      db.getProducts(),
      db.getClients(),
      db.getSettings(),
      db.getSuspendedSales()
    ]);
    setProducts(p);
    setClients(c);
    setSettings(s);
    setSuspendedSales(susp);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); 
    return () => clearInterval(interval);
  }, []);

  const loadSales = async () => {
    const allSales = await db.getSales();
    const today = new Date().toDateString();
    setTodaysSales(allSales.filter(s => new Date(s.date).toDateString() === today && s.sellerId === user.id).reverse());
  };

  // --- POS Logic ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.priceRetail * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const handleCheckout = async () => {
    const saleItems: SaleItem[] = cart.map(item => ({
      productId: item.id,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.priceRetail,
      subtotal: item.priceRetail * item.quantity
    }));

    await db.createRetailSale(saleItems, user.id);
    setCart([]);
    setShowPaymentModal(false);
    setIsCartOpen(false);
    await loadData();
    alert('¡Venta registrada con éxito!');
  };

  // --- Suspend/Resume Logic ---
  const handleSuspendSale = async () => {
      if (cart.length === 0) return;
      
      const refName = prompt("Nombre de referencia para esta venta (ej: Señora de Rojo):");
      if (!refName) return;

      try {
          const suspended: SuspendedSale = {
              id: Date.now().toString(), // Simple ID generation
              customerName: refName,
              items: [...cart],
              date: new Date().toISOString(),
              total: cartTotal
          };

          await db.addSuspendedSale(suspended);
          setCart([]);
          await loadData(); // Immediate refresh
          alert(`Cuenta de "${refName}" puesta en espera.`);
      } catch (error) {
          console.error(error);
          alert("Error al poner en espera.");
      }
  };

  const handleResumeSale = async (suspended: SuspendedSale) => {
      if (cart.length > 0) {
          const confirm = window.confirm("Tienes productos en el carrito actual. ¿Deseas sobrescribirlos con la cuenta recuperada?");
          if (!confirm) return;
      }
      setCart(suspended.items);
      await db.removeSuspendedSale(suspended.id);
      await loadData();
      setShowSuspendedModal(false);
  };

  // --- Dispatch Logic ---
  const handleDispatchConfirm = async (clientId: string, items: SaleItem[]) => {
    try {
      await db.createDispatchSale(clientId, items, user.id);
      await loadData();
      alert('Despacho registrado correctamente.');
    } catch (error) {
      alert('Error al procesar despacho');
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.businessName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Navbar - Compact on Mobile */}
      <header className="bg-bakery-600 text-white shadow-md flex-none z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-lg whitespace-nowrap">El Trigal</span>
            <span className="text-bakery-200 text-xs hidden sm:inline truncate">| {user.name}</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
             {/* Suspended Sales Indicator */}
             {suspendedSales.length > 0 && (
                <button 
                  onClick={() => setShowSuspendedModal(true)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse shadow-sm transition-colors"
                  title="Ventas en Espera"
                >
                    <Clock size={14} />
                    {suspendedSales.length} <span className="hidden sm:inline">en Espera</span>
                </button>
             )}

            <div className="bg-bakery-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-mono flex items-center gap-1">
              <DollarSign size={12} />
              <span className="hidden sm:inline">Tasa:</span>
              <span className="font-bold">{settings.exchangeRate}</span>
            </div>
            
            <button 
              onClick={() => { loadSales(); setShowHistoryModal(true); }}
              className="p-2 hover:bg-bakery-700 rounded-full transition-colors"
              title="Mis Ventas"
            >
              <History size={20} />
            </button>
            
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-bakery-700 rounded-full transition-colors"
              title="Salir"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Friendly Tabs */}
      <div className="bg-white shadow border-b flex-none z-20">
        <div className="max-w-7xl mx-auto flex">
          <button
            onClick={() => { setActiveTab('pos'); setSearchTerm(''); }}
            className={`flex-1 py-3 text-sm sm:text-base flex items-center justify-center gap-2 font-bold transition-colors border-b-4
              ${activeTab === 'pos' ? 'border-bakery-500 text-bakery-700 bg-orange-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}
            `}
          >
            <Store size={18} />
            MOSTRADOR
          </button>
          <button
            onClick={() => { setActiveTab('dispatch'); setSearchTerm(''); }}
            className={`flex-1 py-3 text-sm sm:text-base flex items-center justify-center gap-2 font-bold transition-colors border-b-4
              ${activeTab === 'dispatch' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}
            `}
          >
            <Truck size={18} />
            DESPACHO
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative max-w-7xl mx-auto w-full">
        {/* Search Bar */}
        <div className="p-4 bg-gray-100 flex-none z-10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={activeTab === 'pos' ? "Buscar producto..." : "Buscar cliente..."}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-bakery-400 text-sm shadow-sm bg-white text-gray-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {activeTab === 'pos' ? (
          <div className="flex-1 overflow-hidden relative flex flex-col md:flex-row">
            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 scroll-smooth">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={`bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col text-left overflow-hidden active:scale-95 transition-transform group
                      ${product.stock <= 0 ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-bakery-300 hover:shadow-md'}
                    `}
                  >
                    {/* Image Area */}
                    <div className="h-32 w-full bg-gray-100 relative overflow-hidden">
                        {product.image ? (
                            <img 
                                src={product.image} 
                                alt={product.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageOff size={32} />
                            </div>
                        )}
                        {/* Stock Badge Overlay */}
                        <div className="absolute top-2 right-2">
                             <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm ${product.stock > 0 ? 'bg-white/90 text-gray-700 backdrop-blur-sm' : 'bg-red-500 text-white'}`}>
                                 {product.stock} un
                             </span>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm line-clamp-2 leading-tight mb-1">{product.name}</h3>
                        <p className="text-[10px] text-gray-500">{product.category}</p>
                      </div>
                      <div className="mt-2 flex justify-between items-end">
                        <p className="text-lg font-bold text-bakery-600">${product.priceRetail.toFixed(2)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Cart Sidebar (Hidden on Mobile) */}
            <div className="hidden md:flex w-80 bg-white border-l border-gray-200 flex-col shadow-xl z-20 h-full">
              <CartContent 
                cart={cart} 
                onUpdateQty={updateCartQty} 
                total={cartTotal} 
                settings={settings} 
                onCheckout={() => setShowPaymentModal(true)}
                onSuspend={handleSuspendSale}
              />
            </div>

            {/* Mobile Bottom Bar (Floating) */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t z-30">
               {isCartOpen ? (
                 <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsCartOpen(false)}>
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[85vh] flex flex-col shadow-2xl transition-transform duration-300 overflow-hidden" 
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl flex-none">
                         <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart size={20} /> Carrito ({cartItemCount})
                         </h2>
                         <button onClick={() => setIsCartOpen(false)} className="p-2 bg-gray-200 rounded-full">
                           <ChevronDown size={20} />
                         </button>
                      </div>
                      {/* Cart Content takes remaining height */}
                      <div className="flex-1 overflow-hidden">
                        <CartContent 
                            cart={cart} 
                            onUpdateQty={updateCartQty} 
                            total={cartTotal} 
                            settings={settings} 
                            onCheckout={() => setShowPaymentModal(true)}
                            onSuspend={handleSuspendSale}
                        />
                      </div>
                    </div>
                 </div>
               ) : (
                 <div 
                   className="flex items-center justify-between p-4 cursor-pointer active:bg-gray-50"
                   onClick={() => setIsCartOpen(true)}
                 >
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">{cartItemCount} Artículos</span>
                      <span className="font-bold text-xl text-bakery-800">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-bakery-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg">
                       <ShoppingCart size={18} />
                       Ver Pedido
                       <ChevronUp size={18} />
                    </div>
                 </div>
               )}
            </div>

          </div>
        ) : (
          // Dispatch View
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
             <div className="space-y-4 pb-20">
              {filteredClients.map(client => (
                <DispatchClientCard
                    key={client.id}
                    client={client}
                    products={products}
                    exchangeRate={settings.exchangeRate}
                    onConfirmDispatch={handleDispatchConfirm}
                />
              ))}
             </div>
          </div>
        )}
      </main>

      {/* Suspended Sales Modal */}
      {showSuspendedModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Clock size={20} className="text-bakery-500"/> Ventas en Espera
                    </h2>
                    <button onClick={() => setShowSuspendedModal(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {suspendedSales.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay cuentas pendientes.</p>
                    ) : (
                        <div className="space-y-3">
                            {suspendedSales.map(sale => (
                                <div key={sale.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-900">{sale.customerName}</p>
                                            <p className="text-xs text-gray-500">{new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {sale.items.length} items</p>
                                        </div>
                                        <p className="font-bold text-bakery-600">${sale.total.toFixed(2)}</p>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <button 
                                            onClick={() => handleResumeSale(sale)}
                                            className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg text-sm font-bold hover:bg-green-200 flex items-center justify-center gap-1"
                                        >
                                            <PlayCircle size={16}/> Retomar
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                if(confirm('¿Borrar esta cuenta guardada?')) {
                                                    await db.removeSuspendedSale(sale.id);
                                                    await loadData();
                                                }
                                            }}
                                            className="px-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
          </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <DollarSign size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Confirmar Pago</h2>
              <p className="text-sm text-gray-500 mb-6">Total a recibir en caja</p>
              
              <div className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-sm">USD</span>
                  <span className="text-2xl font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Bolívares</span>
                  <span className="text-xl font-bold text-bakery-700">{(cartTotal * settings.exchangeRate).toFixed(2)} Bs</span>
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={handleCheckout} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-200">
                  <CreditCard size={20} />
                  Confirmar Cobro
                </button>
                <button onClick={() => setShowPaymentModal(false)} className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales History Modal - MODIFIED FOR DETAIL VIEW */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in duration-200">
            {selectedHistorySale ? (
                // DETAIL VIEW OF A SALE
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <button onClick={() => setSelectedHistorySale(null)} className="text-sm font-bold text-gray-600 flex items-center gap-1 hover:text-black">
                            &larr; Volver
                        </button>
                        <h3 className="font-bold">Detalle #{selectedHistorySale.id.slice(0,6)}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div className="mb-4 text-center border-b pb-2 border-gray-100">
                                <p className="font-bold text-lg">{selectedHistorySale.clientName || 'Cliente Mostrador'}</p>
                                <p className="text-xs text-gray-500">{new Date(selectedHistorySale.date).toLocaleString()}</p>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded mt-1 inline-block ${selectedHistorySale.type === 'pos' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {selectedHistorySale.type === 'pos' ? 'Venta Mostrador' : 'Ruta / Despacho'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {selectedHistorySale.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{item.quantity} x {item.productName}</span>
                                        <span className="font-bold">${item.subtotal.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-lg font-bold">
                                <span>Total</span>
                                <span>${selectedHistorySale.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // LIST VIEW
                <>
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                        <h2 className="text-lg font-bold">Ventas del Día</h2>
                        <button onClick={() => setShowHistoryModal(false)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {todaysSales.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <History size={40} className="mb-2 opacity-50"/>
                            <p>Sin movimientos hoy</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {todaysSales.map(sale => (
                                <div 
                                    key={sale.id} 
                                    onClick={() => setSelectedHistorySale(sale)}
                                    className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
                                >
                                    <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-bold text-gray-800">{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${sale.type === 'pos' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {sale.type === 'pos' ? 'Caja' : 'Ruta'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate max-w-[150px]">{sale.clientName || 'Cliente Mostrador'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-green-600">${sale.totalAmount.toFixed(2)}</span>
                                        <ChevronUp size={16} className="text-gray-400 rotate-90"/>
                                    </div>
                                </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Extracted Cart Component for re-use in Sidebar (Desktop) and Modal (Mobile)
// UPDATED: Added Pause Button
const CartContent: React.FC<{
  cart: CartItem[];
  onUpdateQty: (id: string, d: number) => void;
  total: number;
  settings: AppSettings;
  onCheckout: () => void;
  onSuspend: () => void;
}> = ({ cart, onUpdateQty, total, settings, onCheckout, onSuspend }) => {
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Scrollable Item List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ShoppingCart size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Carrito vacío</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-bold text-sm text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">${item.priceRetail.toFixed(2)} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onUpdateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm active:bg-gray-100">
                  {item.quantity === 1 ? <Trash2 size={14} className="text-red-500"/> : <Minus size={14} />}
                </button>
                <span className="font-mono w-6 text-center text-sm font-bold">{item.quantity}</span>
                <button 
                  onClick={() => onUpdateQty(item.id, 1)} 
                  className="w-7 h-7 flex items-center justify-center rounded bg-bakery-500 text-white shadow-sm active:scale-95 disabled:bg-gray-300" 
                  disabled={item.quantity >= item.stock}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="w-14 text-right font-bold text-sm text-gray-800 ml-2">
                ${(item.priceRetail * item.quantity).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Static Footer (Always visible) */}
      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex-none">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-600 text-sm">Total USD</span>
          <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mb-4 text-xs bg-gray-100 p-2 rounded">
          <span className="text-gray-500">Aprox. en Bolívares</span>
          <span className="font-mono font-bold text-gray-700">{(total * settings.exchangeRate).toFixed(2)} Bs</span>
        </div>
        
        <div className="flex gap-2">
             <button
                onClick={onSuspend}
                disabled={cart.length === 0}
                className="w-1/3 bg-orange-100 text-orange-700 py-3.5 rounded-xl font-bold shadow-sm hover:bg-orange-200 disabled:bg-gray-100 disabled:text-gray-300 transition-all flex flex-col items-center justify-center text-[10px] sm:text-xs"
                title="Pausar y atender otro cliente"
             >
                <PauseCircle size={18} className="mb-0.5" />
                En Espera
             </button>
            <button
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="w-2/3 bg-bakery-600 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-bakery-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            >
            Cobrar
            </button>
        </div>
      </div>
    </div>
  );
};

export default SellerView;