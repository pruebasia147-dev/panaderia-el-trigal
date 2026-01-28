import React, { useMemo, useState, useEffect } from 'react';
import { Product, Sale, SaleItem } from '../types';
import { db } from '../services/db'; // Import DB
import html2canvas from 'html2canvas';
import { 
  Calendar, TrendingUp, DollarSign, ShoppingBag, BarChart2, 
  FileText, Search, Clock, MapPin, X, ArrowRight, Printer, Download, Share2, Camera, Store as StoreIcon, Edit
} from 'lucide-react';

interface SalesAnalyticsProps {
  sales: Sale[];
  products: Product[];
}

type TimeFrame = 'day' | 'week' | 'month' | 'year';

const SalesAnalytics: React.FC<SalesAnalyticsProps> = ({ sales, products }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isEditingSale, setIsEditingSale] = useState(false);
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  
  // State for the specific invoice being printed
  const [saleToPrint, setSaleToPrint] = useState<Sale | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // --- Logic for Filtering ---
  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const getStartDate = () => {
      switch (timeFrame) {
        case 'day': return startOfToday;
        case 'week': {
          const d = new Date(startOfToday);
          d.setDate(d.getDate() - 7);
          return d;
        }
        case 'month': {
          const d = new Date(startOfToday);
          d.setMonth(d.getMonth() - 1);
          return d;
        }
        case 'year': {
          const d = new Date(startOfToday);
          d.setFullYear(d.getFullYear() - 1);
          return d;
        }
      }
    };

    const startDate = getStartDate();
    
    const rangeSales = sales.filter(s => {
        const matchesDate = new Date(s.date) >= startDate;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            s.clientName?.toLowerCase().includes(searchLower) || 
            s.id.toLowerCase().includes(searchLower) ||
            (s.type === 'pos' && 'mostrador'.includes(searchLower));
        
        return matchesDate && matchesSearch;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const chartData: Record<string, number> = {};
    rangeSales.forEach(s => {
      const date = new Date(s.date);
      let key = '';
      if (timeFrame === 'day') key = date.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'});
      else if (timeFrame === 'week') key = date.toLocaleDateString('es-ES', {weekday: 'short'});
      else if (timeFrame === 'month') key = date.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
      else key = date.toLocaleDateString('es-ES', {month: 'long'});
      
      chartData[key] = (chartData[key] || 0) + s.totalAmount;
    });

    return {
      sales: rangeSales,
      dispatchSales: rangeSales.filter(s => s.type === 'dispatch'),
      total: rangeSales.reduce((acc, curr) => acc + curr.totalAmount, 0),
      count: rangeSales.length,
      avgTicket: rangeSales.length ? rangeSales.reduce((acc, curr) => acc + curr.totalAmount, 0) / rangeSales.length : 0,
      chart: chartData
    };
  }, [sales, timeFrame, searchTerm]);

  const maxChartValue = Math.max(...(Object.values(filteredData.chart) as number[]), 10);
  const chartEntries = Object.entries(filteredData.chart) as [string, number][];
  const minChartWidth = Math.max(100, chartEntries.length * 60); 

  // --- ACTIONS ---

  const handlePrint = (sale: Sale) => {
    setSaleToPrint(sale);
  };

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
      const element = document.getElementById('receipt-capture-area');
      if (!element) return;

      setIsCapturing(true);

      try {
          const canvas = await html2canvas(element, {
              scale: 6, 
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true,
              allowTaint: true,
          });

          canvas.toBlob(async (blob) => {
              if (!blob) {
                  setIsCapturing(false);
                  return;
              }

              const file = new File([blob], `recibo-${selectedSale?.id.slice(0,6)}.png`, { type: "image/png" });

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
              else {
                  const link = document.createElement('a');
                  link.href = canvas.toDataURL('image/png');
                  link.download = `recibo-${selectedSale?.id.slice(0,6)}.png`;
                  link.click();
              }
              setIsCapturing(false);
          });
      } catch (error) {
          console.error("Error capturing receipt", error);
          alert("No se pudo generar la imagen. Intente descargar el PDF.");
          setIsCapturing(false);
      }
  };

  // --- EDIT LOGIC ---
  const openEditModal = (sale: Sale) => {
      setSelectedSale(sale);
      setIsEditingSale(true);
      setEditItems(JSON.parse(JSON.stringify(sale.items))); // Deep Copy
  };

  const updateEditItemQty = (idx: number, delta: number) => {
      setEditItems(prev => {
          const newItems = [...prev];
          const newQty = Math.max(0, newItems[idx].quantity + delta);
          newItems[idx].quantity = newQty;
          newItems[idx].subtotal = newQty * newItems[idx].unitPrice;
          return newItems;
      });
  };

  const saveEditedSale = async () => {
      if (!selectedSale) return;
      
      const filteredItems = editItems.filter(i => i.quantity > 0);
      const newTotal = filteredItems.reduce((acc, curr) => acc + curr.subtotal, 0);

      const updatedSale: Sale = {
          ...selectedSale,
          items: filteredItems,
          totalAmount: newTotal
      };

      await db.updateSale(updatedSale);
      alert('Venta actualizada correctamente. Nota: Recuerda ajustar inventario manualmente si es necesario.');
      setIsEditingSale(false);
      setSelectedSale(null);
      // Ideally we should trigger a reload in parent, but DB update will reflect on next interval poll or manual refresh
      // Since this is Admin view, we assume data reloads via effect or manual action.
      // For immediate feedback, we could force reload but let's rely on parent polling for now or just reload page.
      window.location.reload(); 
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans pb-10">
      
      {/* WRAPPER: Hides everything inside when printing */}
      <div className="print:hidden space-y-6">
          
          {/* Header & Controls */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <div>
            <h2 className="text-2xl font-bold text-gray-900">Reportes de Venta</h2>
            <p className="text-sm text-gray-500">
                Gestión y facturación detallada.
            </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
                {/* Search - Fixed BG color */}
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar factura..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-bakery-400 text-sm transition-all shadow-sm text-gray-900"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <div className="bg-gray-100 p-1.5 rounded-xl flex shadow-inner">
                    {(['day', 'week', 'month', 'year'] as TimeFrame[]).map(t => (
                        <button
                        key={t}
                        onClick={() => setTimeFrame(t)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            timeFrame === t 
                            ? 'bg-white text-gray-900 shadow-sm scale-105' 
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                        >
                        {t === 'day' ? 'Hoy' : t === 'week' ? 'Semana' : t === 'month' ? 'Mes' : 'Año'}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Facturado</p>
                      <p className="text-3xl font-bold text-gray-900">${filteredData.total.toLocaleString('es-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  <div className="p-4 bg-green-50 text-green-600 rounded-2xl group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Transacciones</p>
                      <p className="text-3xl font-bold text-gray-900">{filteredData.count}</p>
                  </div>
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><FileText size={24}/></div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group">
                  <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ticket Promedio</p>
                      <p className="text-3xl font-bold text-gray-900">${filteredData.avgTicket.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
              </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col relative overflow-hidden">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2 relative z-10">
            <BarChart2 size={16}/>
            Análisis Temporal
            </h3>
            
            <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent relative z-10">
                <div className="h-64 flex items-end gap-3 px-2" style={{ minWidth: `${minChartWidth}%` }}>
                    <ReportLineChart entries={chartEntries} maxVal={maxChartValue} />
                </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <div>
                    <h3 className="font-bold text-xl text-gray-900">Detalle de Operaciones</h3>
                    <p className="text-sm text-gray-500 mt-1">Historial completo del periodo seleccionado.</p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">{filteredData.count} registros</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100 font-bold tracking-wider">
                        <tr>
                            <th className="px-8 py-4">Fecha / Hora</th>
                            <th className="px-8 py-4">ID Factura</th>
                            <th className="px-8 py-4">Cliente / Tipo</th>
                            <th className="px-8 py-4 text-center">Items</th>
                            <th className="px-8 py-4 text-right">Total</th>
                            <th className="px-8 py-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredData.sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-gray-50/80 transition-colors group cursor-default">
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-base">{new Date(sale.date).toLocaleDateString()}</span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1 font-medium mt-0.5">
                                            <Clock size={12}/> {new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="font-mono text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">
                                        #{sale.id.slice(0, 8)}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        {sale.type === 'pos' ? (
                                            <span className="font-bold text-gray-800">Venta Mostrador</span>
                                        ) : (
                                            <span className="font-bold text-blue-700">{sale.clientName}</span>
                                        )}
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${
                                                sale.type === 'pos' 
                                                ? 'bg-orange-50 text-orange-700 border-orange-100' 
                                                : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                                {sale.type === 'pos' ? 'Local' : 'Despacho'}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <span className="text-gray-600 font-bold">{sale.items.length}</span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <span className="font-bold text-gray-900 text-base">${sale.totalAmount.toFixed(2)}</span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => openEditModal(sale)}
                                            className="text-gray-400 hover:text-bakery-600 hover:bg-bakery-50 p-2 rounded-full transition-all"
                                            title="Editar Venta"
                                        >
                                            <Edit size={18}/>
                                        </button>
                                        <button 
                                            onClick={() => setSelectedSale(sale)}
                                            className="text-bakery-500 hover:text-bakery-700 hover:bg-bakery-50 p-2 rounded-full transition-all"
                                            title="Ver Detalle"
                                        >
                                            <ArrowRight size={18}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
      </div>

      {/* Invoice Modal (Screen View) - FIXED SCROLLING */}
      {selectedSale && !isEditingSale && (
        <div className="print:hidden fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {/* Added 'flex flex-col' and 'max-h' constraints to ensure scrolling works */}
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col h-auto max-h-[90vh]">
                
                {/* --- CAPTURE AREA START --- */}
                {/* Added overflow-y-auto to this wrapper so it scrolls */}
                <div id="receipt-capture-area-wrapper" className="flex-1 overflow-y-auto bg-white">
                    <div id="receipt-capture-area" className="bg-white antialiased">
                        {/* Modal Header */}
                        <div className="bg-gray-900 text-white p-6 pb-8">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 mb-2">
                                    <StoreIcon size={20} className="text-bakery-400" />
                                    <h3 className="font-bold text-lg tracking-wide">Panadería El Trigal</h3>
                                </div>
                                <button onClick={() => setSelectedSale(null)} className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors" data-html2canvas-ignore>
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-gray-400 text-[10px] leading-tight opacity-80">Rif: J-12345678-9 | Calle Principal, Centro</p>
                        </div>

                        {/* Receipt Body (Overlapping Header) */}
                        <div className="px-5 -mt-4">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
                                {/* Metadata */}
                                <div className="border-b border-gray-100 pb-3 mb-3 space-y-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-bold text-gray-400 text-[10px] uppercase">Nº Factura</p>
                                            <p className="font-bold text-gray-900">#{selectedSale.id.slice(0,6).toUpperCase()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-400 text-[10px] uppercase">Fecha</p>
                                            <p className="font-bold text-gray-900">{new Date(selectedSale.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Client Row - NEW */}
                                    <div>
                                        <p className="font-bold text-gray-400 text-[10px] uppercase">Cliente</p>
                                        <p className="font-bold text-bakery-700 text-sm">{selectedSale.clientName || 'Cliente Mostrador'}</p>
                                    </div>
                                </div>
                                
                                {/* Items Table - REORDERED: Product | Cant | Inv. | Sub. */}
                                <table className="w-full mb-4">
                                    <thead>
                                        <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            <th className="pb-1 font-bold text-left">Producto</th>
                                            <th className="pb-1 font-bold text-center w-10">Cant</th>
                                            <th className="pb-1 font-bold text-right w-16">Inv.</th>
                                            <th className="pb-1 font-bold text-right w-16">Sub.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs">
                                        {selectedSale.items.map((item, idx) => (
                                            <tr key={idx} className="border-b border-gray-50 last:border-0">
                                                {/* 1. Producto */}
                                                <td className="py-2 text-gray-800 font-medium whitespace-normal pr-1 align-top leading-tight text-left">
                                                    {item.productName}
                                                </td>
                                                {/* 2. Cantidad */}
                                                <td className="py-2 font-bold text-gray-600 align-top text-center">{item.quantity}</td>
                                                {/* 3. Inversión */}
                                                <td className="py-2 text-right text-gray-500 whitespace-nowrap align-top">
                                                    ${item.unitPrice.toFixed(2)}
                                                </td>
                                                {/* 4. Subtotal */}
                                                <td className="py-2 text-right font-bold text-gray-900 whitespace-nowrap align-top">
                                                    ${item.subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Total */}
                                <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border border-gray-100">
                                    <span className="font-bold text-gray-600 uppercase text-xs">Total Pagado</span>
                                    <span className="text-xl font-extrabold text-bakery-600">${selectedSale.totalAmount.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="text-center pb-6">
                                <p className="text-[10px] text-gray-400 italic">Gracias por su compra. Vuelva pronto.</p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* --- CAPTURE AREA END --- */}

                {/* Footer Actions (Outside Capture Area) - Fixed to bottom */}
                <div className="p-5 bg-gray-50 border-t border-gray-200 mt-auto flex-none">
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
                         onClick={() => handlePrint(selectedSale)}
                         className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-900 py-2 font-medium text-sm transition-colors"
                    >
                        <Printer size={16} />
                        Imprimir Formato Completo
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* EDIT SALE MODAL */}
      {isEditingSale && selectedSale && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Editar Venta #{selectedSale.id.slice(0,6)}</h3>
                  <p className="text-sm text-gray-500 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                      Modificar cantidades recalculará el total automáticamente.
                  </p>
                  
                  <div className="max-h-[50vh] overflow-y-auto mb-4 border rounded-xl">
                      <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-500 font-bold">
                              <tr>
                                  <th className="p-3 text-left">Producto</th>
                                  <th className="p-3 text-center">Cant.</th>
                                  <th className="p-3 text-right">Subtotal</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {editItems.map((item, idx) => (
                                  <tr key={idx}>
                                      <td className="p-3 font-medium">{item.productName}</td>
                                      <td className="p-3">
                                          <div className="flex items-center justify-center gap-2">
                                              <button onClick={() => updateEditItemQty(idx, -1)} className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 font-bold">-</button>
                                              <span className="w-8 text-center">{item.quantity}</span>
                                              <button onClick={() => updateEditItemQty(idx, 1)} className="w-6 h-6 bg-gray-100 rounded hover:bg-gray-200 font-bold">+</button>
                                          </div>
                                      </td>
                                      <td className="p-3 text-right font-bold text-gray-700">${item.subtotal.toFixed(2)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="flex justify-between items-center text-lg font-bold border-t pt-4">
                      <span>Nuevo Total:</span>
                      <span className="text-bakery-600">${editItems.reduce((acc, c) => acc + c.subtotal, 0).toFixed(2)}</span>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                      <button 
                          onClick={() => { setIsEditingSale(false); setSelectedSale(null); }}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={saveEditedSale}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md"
                      >
                          Guardar Cambios
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- HIDDEN SINGLE INVOICE PRINTER COMPONENT --- */}
      {/* Uses fixed positioning to ensure full coverage during print */}
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

// --- Sub-Component: Chart ---
const ReportLineChart: React.FC<{ entries: [string, number][], maxVal: number }> = ({ entries, maxVal }) => {
  if (entries.length < 2) {
    return (
        <div className="h-full w-full flex items-center justify-center text-gray-300 text-xs italic">
            Insuficientes datos para graficar
        </div>
    );
  }

  const dataPoints = entries.map((entry, i) => ({
      label: entry[0],
      value: entry[1]
  }));

  const getX = (index: number) => (index / (entries.length - 1)) * 100;
  const getY = (val: number) => 100 - (val / maxVal) * 100;

  let pathD = `M0,${getY(dataPoints[0].value)}`;
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const x0 = getX(i);
    const y0 = getY(dataPoints[i].value);
    const x1 = getX(i + 1);
    const y1 = getY(dataPoints[i + 1].value);
    
    // Control points for smoothing
    const cp1x = x0 + (x1 - x0) * 0.5;
    const cp1y = y0;
    const cp2x = x1 - (x1 - x0) * 0.5;
    const cp2y = y1;
    
    pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${x1},${y1}`;
  }

  const fillPath = `${pathD} L100,100 L0,100 Z`;

  return (
    <div className="w-full h-full relative group/chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="chartGradientReport" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        <path d={fillPath} fill="url(#chartGradientReport)" />
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="1" strokeLinecap="round" />
        
        {dataPoints.map((pt, i) => (
          <g key={i} className="group/point">
             <circle 
                cx={getX(i)} 
                cy={getY(pt.value)} 
                r="1.5" 
                fill="#fff" 
                stroke="#c2410c" 
                strokeWidth="0.8" 
                className="opacity-0 group-hover/point:opacity-100 transition-opacity" 
             />
             <rect 
                x={getX(i) - 2} 
                y={0} 
                width="4" 
                height="100" 
                fill="transparent" 
             />
          </g>
        ))}
      </svg>
       <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium px-1">
          <span>{entries[0]?.[0]}</span>
          {entries.length > 2 && <span>{entries[Math.floor(entries.length/2)]?.[0]}</span>}
          {entries.length > 1 && <span>{entries[entries.length-1]?.[0]}</span>}
      </div>
    </div>
  );
};

export default SalesAnalytics;