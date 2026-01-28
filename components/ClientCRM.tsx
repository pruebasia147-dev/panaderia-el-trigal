import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Client, Product, Sale } from '../types';
import html2canvas from 'html2canvas';
import { 
  User, MapPin, TrendingUp, Calendar, Search, Edit, 
  FileText, ChevronRight, Star, BrainCircuit, Wallet, CheckCircle, Package,
  Download, Share2, X as XIcon, Store as StoreIcon, ArrowRightCircle, Truck, Filter
} from 'lucide-react';

interface ClientCRMProps {
  clients: Client[];
  sales: Sale[];
  products: Product[];
  onEditClient: (client: Client) => void;
  onRefreshData: () => Promise<void>;
}

const ClientCRM: React.FC<ClientCRMProps> = ({ clients, sales, products, onEditClient, onRefreshData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showSaleDetail, setShowSaleDetail] = useState<Sale | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // New State for List Filter
  const [listFilter, setListFilter] = useState<'all' | 'today'>('all');

  // --- Actions ---
  const handlePayment = async () => {
    if (!selectedClientId || !paymentAmount) return;
    setIsProcessing(true);
    try {
      await db.registerClientPayment(selectedClientId, parseFloat(paymentAmount));
      await onRefreshData(); 
      setPaymentAmount('');
      setShowPaymentModal(false);
    } catch (e) {
      alert('Error al registrar pago');
    }
    setIsProcessing(false);
  };

  const handlePreOrder = () => {
    alert("🚀 Funcionalidad Pre-Orden:\n\nEn la versión completa, al hacer clic aquí, el sistema llevará automáticamente estos productos sugeridos al 'Carrito de Despacho', ahorrando tiempo al vendedor.");
  };

  // 1. Trigger Print: Set state to render the invoice component
  const handlePrint = (sale: Sale) => {
    setSaleToPrint(sale);
  };

  // 2. Watch state: Wait for render, then print, then cleanup
  useEffect(() => {
    let printTimer: ReturnType<typeof setTimeout>;
    let clearTimer: ReturnType<typeof setTimeout>;

    if (saleToPrint) {
        printTimer = setTimeout(() => {
            window.print();
            clearTimer = setTimeout(() => {
                setSaleToPrint(null);
            }, 1000);
        }, 500);
    }

    return () => {
        clearTimeout(printTimer);
        clearTimeout(clearTimer);
    };
  }, [saleToPrint]);

  const handleSmartShare = async () => {
      // Target the specific inner content div that holds the receipt design
      const element = document.getElementById('receipt-content-inner');
      if (!element) return;

      setIsCapturing(true);

      try {
          // Professional Setting: Scale 6 ensures crisp text even after WhatsApp compression
          // We capture the specific element, bypassing the scroll container
          const canvas = await html2canvas(element, {
              scale: 6,
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true,
              allowTaint: true,
              windowHeight: element.scrollHeight + 100 // Ensure full height capture
          });

          canvas.toBlob(async (blob) => {
              if (!blob) {
                  setIsCapturing(false);
                  return;
              }

              const file = new File([blob], `recibo-${showSaleDetail?.id.slice(0,6)}.png`, { type: "image/png" });

              // 1. Try Native Share (Mobile)
              if (navigator.share && navigator.canShare({ files: [file] })) {
                  try {
                      await navigator.share({
                          files: [file],
                          title: 'Recibo de Compra - El Trigal',
                          text: `Adjunto su comprobante de pago.`
                      });
                  } catch (e) {
                      console.log('User cancelled share');
                  }
              } 
              // 2. Try Clipboard (Desktop)
              else if (navigator.clipboard && navigator.clipboard.write) {
                   try {
                       await navigator.clipboard.write([
                           new ClipboardItem({ [blob.type]: blob })
                       ]);
                       alert('¡Imagen copiada al portapapeles!\n\nAhora ve a WhatsApp Web y presiona "Pegar" (Ctrl + V).');
                   } catch (e) {
                       // Fallback to download
                       const link = document.createElement('a');
                       link.href = canvas.toDataURL('image/png');
                       link.download = `recibo-${showSaleDetail?.id.slice(0,6)}.png`;
                       link.click();
                   }
              } 
              // 3. Fallback Download
              else {
                  const link = document.createElement('a');
                  link.href = canvas.toDataURL('image/png');
                  link.download = `recibo-${showSaleDetail?.id.slice(0,6)}.png`;
                  link.click();
              }
              setIsCapturing(false);
          });
      } catch (error) {
          console.error("Error capturing receipt", error);
          alert("No se pudo generar la imagen.");
          setIsCapturing(false);
      }
  };

  // --- Logic & Data Processing ---
  
  // 1. Get Today's Client IDs
  const todayStr = new Date().toDateString();
  const todaySalesMap = sales.reduce((acc, sale) => {
      if (sale.type === 'dispatch' && new Date(sale.date).toDateString() === todayStr && sale.clientId) {
          acc[sale.clientId] = (acc[sale.clientId] || 0) + sale.totalAmount;
      }
      return acc;
  }, {} as Record<string, number>);
  
  const clientsWithSalesToday = Object.keys(todaySalesMap);

  // 2. Filter Clients based on Tab and Search
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.businessName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (listFilter === 'today') {
        return matchesSearch && clientsWithSalesToday.includes(c.id);
    }
    return matchesSearch;
  });

  const totalClientsDebt = clients.reduce((acc, client) => acc + client.debt, 0);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientSales = sales.filter(s => s.clientId === selectedClientId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Stats Calculation
  const totalSpent = clientSales.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const avgOrder = clientSales.length ? totalSpent / clientSales.length : 0;
  
  // --- AI: Prediction Logic ---
  const getLastPurchaseDate = () => clientSales.length > 0 ? new Date(clientSales[0].date) : null;
  const lastPurchase = getLastPurchaseDate();
  
  let predictionWhen = "Datos insuficientes.";
  let statusColor = "bg-gray-100 text-gray-600";
  let statusText = "Nuevo";
  let frequencyDays = 0;
  let probability = 0;

  if (clientSales.length > 2) {
      const firstSale = new Date(clientSales[clientSales.length - 1].date);
      const daysDiff = (new Date().getTime() - firstSale.getTime()) / (1000 * 3600 * 24);
      frequencyDays = daysDiff / clientSales.length;

      if (totalSpent > 500) {
        statusColor = "bg-purple-100 text-purple-700 border border-purple-200";
        statusText = "VIP";
      } else if (frequencyDays < 7) {
        statusColor = "bg-emerald-100 text-emerald-700 border border-emerald-200";
        statusText = "Frecuente";
      } else {
        statusColor = "bg-blue-100 text-blue-700 border border-blue-200";
        statusText = "Regular";
      }

      const daysSinceLast = lastPurchase ? (new Date().getTime() - lastPurchase.getTime()) / (1000 * 3600 * 24) : 0;
      const daysUntilNext = frequencyDays - daysSinceLast;
      
      // Calculate Probability based on cycle
      if (daysUntilNext < -frequencyDays) probability = 10; // Very late
      else if (daysUntilNext < 0) probability = 90; // Overdue slightly
      else if (daysUntilNext < 1) probability = 95; // Due today
      else probability = Math.max(10, 100 - (daysUntilNext * 10));

      if (daysUntilNext < -2) {
        predictionWhen = `⚠️ Retrasado (${frequencyDays.toFixed(0)} días ciclo)`;
      } else if (daysUntilNext <= 1) {
        predictionWhen = `🎯 Probable compra HOY`;
      } else {
        predictionWhen = `En aprox. ${daysUntilNext.toFixed(0)} días`;
      }
  }

  // AI Product Prediction
  const productStats: Record<string, { count: number, totalQty: number, name: string }> = {};
  clientSales.forEach(sale => {
    sale.items.forEach(item => {
      if (!productStats[item.productId]) productStats[item.productId] = { count: 0, totalQty: 0, name: item.productName };
      productStats[item.productId].count += 1;
      productStats[item.productId].totalQty += item.quantity;
    });
  });

  const predictedItems = Object.entries(productStats)
    .map(([id, stats]) => ({
      id, name: stats.name, avgQty: Math.round(stats.totalQty / stats.count), probability: stats.count / clientSales.length
    }))
    .filter(item => item.probability > 0.4)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-140px)] gap-6 animate-in fade-in duration-500 font-sans">
      
      {/* WRAPPER FOR PRINT HIDING */}
      <div className="print:hidden flex w-full h-full gap-6">

        {/* Left List */}
        <div className={`w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col ${selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 mb-1 text-lg">Cartera de Clientes</h2>
                
                {/* Tabs Filter */}
                <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                    <button 
                        onClick={() => setListFilter('all')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setListFilter('today')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${listFilter === 'today' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Truck size={14}/>
                        Despachos Hoy
                        {clientsWithSalesToday.length > 0 && (
                            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{clientsWithSalesToday.length}</span>
                        )}
                    </button>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-bakery-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bakery-400 text-sm transition-all text-gray-900 shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {listFilter === 'today' && filteredClients.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        <Truck size={32} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-sm">No hay despachos registrados hoy.</p>
                    </div>
                )}

                {filteredClients.map(client => {
                    const boughtToday = todaySalesMap[client.id];
                    return (
                        <div 
                            key={client.id}
                            onClick={() => setSelectedClientId(client.id)}
                            className={`p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 group border ${selectedClientId === client.id ? 'bg-orange-50 border-orange-200 shadow-sm' : 'border-transparent'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`font-bold transition-colors ${selectedClientId === client.id ? 'text-bakery-800' : 'text-gray-800 group-hover:text-bakery-700'}`}>{client.businessName}</span>
                                {listFilter === 'today' && boughtToday ? (
                                    <span className="bg-green-100 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <CheckCircle size={10}/>
                                        ${boughtToday.toFixed(0)}
                                    </span>
                                ) : (
                                    client.debt > 0 && (
                                        <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold">Deuda</span>
                                    )
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mb-1">{client.name}</p>
                            {listFilter === 'today' && (
                                <p className="text-[10px] text-blue-600 font-medium mt-1">Clic para ver factura y compartir</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Right Detail Panel */}
        <div className={`w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${!selectedClientId ? 'hidden lg:flex' : 'flex'}`}>
            {selectedClient ? (
                <>
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <button onClick={() => setSelectedClientId(null)} className="lg:hidden text-gray-500 mb-2 flex items-center gap-1 text-sm font-medium"><ChevronRight className="rotate-180" size={16}/> Volver a la lista</button>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold text-gray-900">{selectedClient.businessName}</h2>
                                <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>
                                    {statusText}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin size={14}/> {selectedClient.address}
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setShowPaymentModal(true)}
                                className="flex-1 sm:flex-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95"
                            >
                                <Wallet size={18} /> Abonar
                            </button>
                            <button 
                                onClick={() => onEditClient(selectedClient)}
                                className="bg-white border border-gray-200 text-gray-600 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                            >
                                <Edit size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-50/30">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Compras Totales</p>
                                <p className="text-2xl font-bold text-gray-900">${totalSpent.toFixed(0)}</p>
                            </div>
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Ticket Promedio</p>
                                <p className="text-2xl font-bold text-gray-900">${avgOrder.toFixed(0)}</p>
                            </div>
                            <div className={`p-5 border shadow-sm rounded-2xl ${selectedClient.debt > 0 ? 'bg-white border-red-200 ring-2 ring-red-50' : 'bg-white border-gray-100'}`}>
                                <p className={`text-xs font-bold uppercase mb-1 ${selectedClient.debt > 0 ? 'text-red-500' : 'text-gray-400'}`}>Deuda Actual</p>
                                <p className={`text-2xl font-bold ${selectedClient.debt > 0 ? 'text-red-600' : 'text-gray-900'}`}>${selectedClient.debt.toFixed(0)}</p>
                            </div>
                            <div className="p-5 bg-white border border-gray-100 shadow-sm rounded-2xl">
                                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Crédito Disp.</p>
                                <p className="text-2xl font-bold text-gray-900">${(selectedClient.creditLimit - selectedClient.debt).toFixed(0)}</p>
                            </div>
                        </div>

                        {/* --- AI INTELLIGENCE SECTION --- */}
                         <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm mb-8 relative overflow-hidden group">
                             {/* Decorative Background */}
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                 <BrainCircuit size={120} className="text-indigo-600"/>
                             </div>
                             
                             <div className="flex items-center gap-3 mb-6 relative z-10">
                                 <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                                     <BrainCircuit size={20} />
                                 </div>
                                 <div>
                                     <h3 className="font-bold text-gray-900 text-lg leading-tight">Análisis Predictivo</h3>
                                     <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Powered by El Trigal AI</p>
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                 {/* Behavioral Analysis */}
                                 <div className="space-y-6">
                                     <div className="flex items-start gap-4">
                                         <div className="p-3 bg-white rounded-xl border border-indigo-50 shadow-sm text-indigo-600">
                                             <Calendar size={24} />
                                         </div>
                                         <div>
                                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Ciclo de Compra Promedio</p>
                                             <p className="text-xl font-bold text-gray-900">
                                                 {frequencyDays > 0 ? `Cada ${frequencyDays.toFixed(1)} días` : 'Calculando...'}
                                             </p>
                                             <p className="text-xs text-gray-500 leading-snug mt-1 max-w-[220px]">
                                                 Basado en la frecuencia de las últimas {Math.min(clientSales.length, 10)} transacciones.
                                             </p>
                                         </div>
                                     </div>

                                     <div className="flex items-start gap-4">
                                         <div className="p-3 bg-white rounded-xl border border-indigo-50 shadow-sm text-pink-600">
                                             <Star size={24} />
                                         </div>
                                         <div>
                                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Próxima Visita Estimada</p>
                                             <p className="text-xl font-bold text-gray-900">{predictionWhen}</p>
                                             {frequencyDays > 0 && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 w-[70%] rounded-full animate-pulse" style={{ width: `${probability}%` }}></div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-bold">{probability.toFixed(0)}% Prob.</span>
                                                </div>
                                             )}
                                         </div>
                                     </div>
                                 </div>

                                 {/* Suggested Order */}
                                 <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-indigo-100 p-5 shadow-sm">
                                     <div className="flex justify-between items-center mb-4 border-b border-indigo-50 pb-2">
                                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Productos Sugeridos</p>
                                         <Package size={14} className="text-gray-400"/>
                                     </div>
                                     
                                     {predictedItems.length > 0 ? (
                                         <div className="space-y-3">
                                             {predictedItems.map((item) => (
                                                 <div key={item.id} className="flex items-center justify-between group">
                                                     <div className="flex items-center gap-2.5">
                                                         <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 group-hover:bg-indigo-600 transition-colors shadow-sm"></div>
                                                         <span className="text-sm font-semibold text-gray-700 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                                     </div>
                                                     <div className="flex items-center gap-3">
                                                         {/* UPDATED: Clarified meaning of numbers */}
                                                         <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 whitespace-nowrap" title="Cantidad Promedio que suele llevar">
                                                             Prom: {item.avgQty}u
                                                         </span>
                                                         <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                                                             <div 
                                                                 className="h-full bg-indigo-500" 
                                                                 style={{ width: `${item.probability * 100}%` }}
                                                             ></div>
                                                         </div>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     ) : (
                                         <div className="text-center py-6 text-gray-400 text-xs italic">
                                             Datos insuficientes para generar sugerencias inteligentes.
                                         </div>
                                     )}
                                     
                                     {predictedItems.length > 0 && (
                                         <div className="mt-4 pt-3 border-t border-gray-50">
                                             <button 
                                                onClick={handlePreOrder}
                                                className="w-full py-2 bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 active:scale-95"
                                             >
                                                 <ArrowRightCircle size={14}/>
                                                 Generar Pre-Orden
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             </div>
                        </div>

                        {/* Sales History */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-bakery-100 text-bakery-700 rounded-lg">
                                <FileText size={20} />
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg">Historial de Facturas</h3>
                        </div>
                        
                        {clientSales.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
                                Sin historial de compras registrado.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {clientSales.map(sale => {
                                    // Highlight today's sale if looking at today filter
                                    const isToday = new Date(sale.date).toDateString() === todayStr;
                                    const highlight = listFilter === 'today' && isToday;
                                    
                                    return (
                                        <div key={sale.id} className={`bg-white border rounded-2xl p-4 hover:shadow-lg transition-all group cursor-default ${highlight ? 'border-green-300 ring-2 ring-green-50' : 'border-gray-100 hover:border-bakery-200'}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl transition-colors font-bold text-center min-w-[60px] ${highlight ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 group-hover:bg-bakery-50 group-hover:text-bakery-600'}`}>
                                                        <span className="block text-xs uppercase">{new Date(sale.date).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                                        <span className="block text-xl leading-none">{new Date(sale.date).getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-base">
                                                            Venta #{sale.id.slice(0,6)}
                                                            {highlight && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">HOY</span>}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {sale.items.length} productos
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    <p className="font-bold text-lg text-gray-900">${sale.totalAmount.toFixed(2)}</p>
                                                    <button 
                                                        onClick={() => setShowSaleDetail(sale)}
                                                        className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${highlight ? 'bg-green-600 text-white shadow-md hover:bg-green-700' : 'bg-gray-100 hover:bg-bakery-100 text-gray-600 hover:text-bakery-700'}`}
                                                    >
                                                        Ver Detalles
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <div className="w-24 h-24 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <User size={48} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700">Selecciona un Cliente</h3>
                    <p className="text-sm text-gray-500 max-w-xs text-center mt-2">Haz clic en la lista de la izquierda para ver el perfil completo, historial y predicciones.</p>
                </div>
            )}
        </div>

      </div>

      {/* Sale Detail Modal - FIXED SCROLLING */}
      {showSaleDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col h-auto max-h-[90vh]">
                
                {/* --- CAPTURE AREA CRM --- */}
                <div className="flex-1 overflow-y-auto bg-white" id="receipt-capture-area-wrapper">
                    {/* Inner wrapper specifically for capture */}
                    <div id="receipt-content-inner" className="bg-white antialiased">
                        <div className="bg-gray-900 text-white p-6 pb-8">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 mb-2">
                                    <StoreIcon size={20} className="text-bakery-400" />
                                    <h3 className="font-bold text-lg tracking-wide">Panadería El Trigal</h3>
                                </div>
                                <button onClick={() => setShowSaleDetail(null)} className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors" data-html2canvas-ignore>
                                    <XIcon size={18} />
                                </button>
                            </div>
                            <p className="text-gray-400 text-[10px] leading-tight opacity-80">Rif: J-12345678-9 | Calle Principal, Centro</p>
                        </div>

                        <div className="px-5 -mt-4">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
                                {/* Metadata - Removed border-b to avoid double lines with table header */}
                                <div className="mb-4 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-bold text-gray-400 text-[10px] uppercase">Nº Factura</p>
                                            <p className="font-bold text-gray-900">#{showSaleDetail.id.slice(0,6).toUpperCase()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-400 text-[10px] uppercase">Fecha</p>
                                            <p className="font-bold text-gray-900">{new Date(showSaleDetail.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Client Row */}
                                    <div>
                                        <p className="font-bold text-gray-400 text-[10px] uppercase">Cliente</p>
                                        <p className="font-bold text-bakery-700 text-sm">{showSaleDetail.clientName || 'Cliente Mostrador'}</p>
                                    </div>
                                </div>
                                
                                {/* Items Table - FIXED ALIGNMENT */}
                                <table className="w-full mb-4">
                                    <thead>
                                        {/* Added border-y for top/bottom lines, changed pb-1 to py-3 for better centering */}
                                        <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-y border-gray-100">
                                            <th className="py-3 font-bold text-left align-middle">Producto</th>
                                            <th className="py-3 font-bold text-center w-10 align-middle">Cant</th>
                                            <th className="py-3 font-bold text-right w-16 align-middle">Inv.</th>
                                            <th className="py-3 font-bold text-right w-16 align-middle">Sub.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {showSaleDetail.items.map((item, idx) => (
                                            <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                <td className="py-2 text-gray-800 font-medium whitespace-normal pr-1 align-top leading-tight text-left">
                                                    {item.productName}
                                                </td>
                                                <td className="py-2 font-bold text-gray-600 align-top text-center">{item.quantity}</td>
                                                <td className="py-2 text-right text-gray-500 whitespace-nowrap align-top">
                                                    ${item.unitPrice.toFixed(2)}
                                                </td>
                                                <td className="py-2 text-right font-bold text-gray-900 whitespace-nowrap align-top">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border border-gray-100">
                                    <span className="font-bold text-gray-600 uppercase text-xs">Total Factura</span>
                                    <span className="text-xl font-extrabold text-bakery-600">${showSaleDetail.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="text-center pb-6">
                                <p className="text-[10px] text-gray-400 italic">Gracias por su compra. Vuelva pronto.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions (Sticky Bottom) */}
                <div className="p-5 bg-gray-50 border-t border-gray-200 flex-none z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                     <button 
                        onClick={handleSmartShare}
                        disabled={isCapturing}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-200 mb-3"
                    >
                         {isCapturing ? 'Generando...' : (
                            <>
                                <Share2 size={18} />
                                Compartir Imagen (WhatsApp)
                            </>
                        )}
                    </button>

                     <button 
                        onClick={() => handlePrint(showSaleDetail)}
                        className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-900 py-2 font-medium text-sm transition-colors"
                    >
                        <Download size={16} />
                        Imprimir / PDF
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Debt Payment Modal */}
      {showPaymentModal && selectedClient && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 print:hidden">
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-2xl text-gray-900">Registrar Abono</h3>
                        <button onClick={() => setShowPaymentModal(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200"><XIcon size={20} className="text-gray-600"/></button>
                    </div>
                    
                    <div className="bg-red-50 p-5 rounded-2xl border border-red-100 mb-8 flex flex-col items-center justify-center">
                        <p className="text-xs text-red-500 font-bold uppercase mb-1 tracking-wider">Deuda Pendiente</p>
                        <p className="text-4xl font-bold text-red-600 tracking-tight">${selectedClient.debt.toFixed(2)}</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-2 pl-1">Monto a abonar ($)</label>
                             <div className="relative">
                                <span className="absolute left-4 top-4 text-gray-400 font-bold">$</span>
                                <input 
                                    type="number" 
                                    autoFocus
                                    className="w-full text-2xl p-3 pl-8 border-2 border-gray-200 rounded-2xl focus:border-emerald-500 focus:ring-0 outline-none font-bold bg-white text-gray-900 transition-colors"
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                />
                             </div>
                        </div>

                        <button 
                            onClick={handlePayment}
                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isProcessing}
                            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none mt-4"
                        >
                            {isProcessing ? 'Procesando...' : <><CheckCircle size={20}/> Confirmar Pago</>}
                        </button>
                    </div>
                </div>
            </div>
         </div>
      )}

      {/* HIDDEN INVOICE TEMPLATE (Only shows when printing) */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[10000] print:h-screen print:w-screen print:overflow-visible">
         {saleToPrint && <SingleInvoiceTemplate sale={saleToPrint} />}
      </div>
    </div>
  );
};

// --- Sub-Component: PROFESSIONAL Invoice Template ---
const SingleInvoiceTemplate: React.FC<{ sale: Sale }> = ({ sale }) => {
    return (
        <div className="w-full h-full bg-white text-black p-10 font-sans text-sm leading-normal max-w-[210mm] mx-auto print:p-0">
             
             {/* Top Banner Accent */}
             <div className="h-4 bg-gray-900 w-full mb-8 print:mb-6"></div>

             {/* Header Section */}
             <div className="flex justify-between items-start mb-12 print:mb-8">
                 <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-3">
                         <div className="bg-gray-900 text-white p-2 rounded-lg print:border print:border-gray-900 print:text-black print:bg-white">
                            <StoreIcon size={28} />
                         </div>
                         <h1 className="text-2xl font-bold tracking-tight uppercase">El Trigal</h1>
                     </div>
                     <div className="text-gray-500 text-xs mt-2 space-y-0.5">
                         <p className="font-bold text-gray-900">Panadería El Trigal C.A.</p>
                         <p>Rif: J-12345678-9</p>
                         <p>Calle Principal, Centro, San Cristóbal</p>
                         <p>Tel: (0276) 555-0100</p>
                         <p>Email: facturacion@eltrigal.com</p>
                     </div>
                 </div>

                 <div className="text-right">
                     <h2 className="text-5xl font-extralight text-gray-300 tracking-tighter mb-2 print:text-gray-800">FACTURA</h2>
                     <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Nº Factura</span>
                            <span className="font-bold text-lg text-gray-900">#{sale.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Fecha Emisión</span>
                            <span className="font-medium text-gray-800">{new Date(sale.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Hora</span>
                            <span className="font-medium text-gray-800">{new Date(sale.date).toLocaleTimeString()}</span>
                        </div>
                     </div>
                 </div>
             </div>

             {/* Client Info Box */}
             <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-10 flex justify-between items-start print:bg-white print:border-gray-300 print:mb-6">
                 <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 print:text-gray-600">Facturar A:</h3>
                    <p className="font-bold text-xl text-gray-900 mb-1">{sale.clientName || 'Cliente Mostrador'}</p>
                    {sale.clientId ? (
                         <div className="text-gray-600 space-y-1">
                            <p>ID Cliente: <span className="font-mono text-gray-800">{sale.clientId.slice(0,6)}</span></p>
                            <p>Dirección Registrada en Sistema</p>
                         </div>
                    ) : (
                        <p className="text-gray-500 italic">Venta Directa en Caja</p>
                    )}
                 </div>
                 <div className="text-right">
                     <div className="bg-white border border-gray-200 px-4 py-2 rounded text-center print:border-gray-300">
                         <p className="text-[10px] text-gray-400 font-bold uppercase">Método Pago</p>
                         <p className="font-bold text-gray-800 uppercase">{sale.type === 'pos' ? 'Contado' : 'Crédito / Ruta'}</p>
                     </div>
                 </div>
             </div>

             {/* Table */}
             <div className="mb-8">
                 <table className="w-full text-left border-collapse">
                     <thead>
                         <tr className="border-b-2 border-gray-900">
                             <th className="py-3 pr-4 text-xs font-bold text-gray-600 uppercase tracking-wider w-1/2">Descripción del Producto</th>
                             <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">Cantidad</th>
                             <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Precio Unit.</th>
                             <th className="py-3 pl-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Importe</th>
                         </tr>
                     </thead>
                     <tbody className="">
                         {sale.items.map((item, idx) => (
                             <tr key={idx} className="border-b border-gray-100 print:border-gray-200">
                                 <td className="py-4 pr-4">
                                     <p className="font-bold text-gray-800">{item.productName}</p>
                                     <p className="text-xs text-gray-400 mt-0.5">Código: {item.productId.slice(0,4)}</p>
                                 </td>
                                 <td className="py-4 px-4 text-center text-gray-600 font-medium">{item.quantity}</td>
                                 <td className="py-4 px-4 text-right text-gray-600 font-mono">${item.unitPrice.toFixed(2)}</td>
                                 <td className="py-4 pl-4 text-right font-bold text-gray-900 font-mono">${item.subtotal.toFixed(2)}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>

             {/* Totals Section */}
             <div className="flex justify-end mb-16">
                 <div className="w-1/2 lg:w-1/3">
                     <div className="flex justify-between py-2 border-b border-gray-100 print:border-gray-200">
                         <span className="text-gray-500 font-medium">Subtotal</span>
                         <span className="text-gray-800 font-bold font-mono">${sale.totalAmount.toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between py-2 border-b border-gray-100 print:border-gray-200">
                         <span className="text-gray-500 font-medium">Impuestos (0%)</span>
                         <span className="text-gray-800 font-bold font-mono">$0.00</span>
                     </div>
                     <div className="flex justify-between items-center pt-4">
                         <span className="text-gray-900 font-bold text-lg">TOTAL</span>
                         <div className="text-right">
                             <span className="block text-3xl font-extrabold text-gray-900 font-mono">${sale.totalAmount.toFixed(2)}</span>
                             <span className="text-xs text-gray-400 font-medium">USD Dolár Americano</span>
                         </div>
                     </div>
                 </div>
             </div>

             {/* Footer */}
             <div className="fixed bottom-10 left-10 right-10 border-t border-gray-200 pt-6 print:absolute print:bottom-8">
                 <div className="flex justify-between items-end text-xs text-gray-500">
                     <div className="space-y-1">
                         <p className="font-bold text-gray-700">Términos y Condiciones:</p>
                         <p>Gracias por su preferencia. No se aceptan devoluciones pasadas 24 horas.</p>
                         <p>Esta factura sirve como comprobante de entrega y garantía.</p>
                     </div>
                     <div className="text-right">
                         <p className="font-mono">Generado por Sistema El Trigal</p>
                         <p>Original: Cliente / Copia: Archivo</p>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default ClientCRM;