import React, { useState } from 'react';
import { Client, Product, SaleItem } from '../types';
import { ChevronDown, ChevronUp, Truck, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface DispatchClientCardProps {
  client: Client;
  products: Product[];
  exchangeRate: number;
  onConfirmDispatch: (clientId: string, items: SaleItem[]) => Promise<void>;
}

export const DispatchClientCard: React.FC<DispatchClientCardProps> = ({ 
  client, 
  products, 
  exchangeRate,
  onConfirmDispatch 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Helper: Increment/Decrement
  const updateQty = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Helper: Calculate Total for this specific client session
  const calculateTotal = () => {
    let total = 0;
    Object.entries(quantities).forEach(([prodId, qty]: [string, number]) => {
      if (qty > 0) {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          total += prod.priceWholesale * qty;
        }
      }
    });
    return total;
  };

  const getProposedItems = (): SaleItem[] => {
    const items: SaleItem[] = [];
    Object.entries(quantities).forEach(([prodId, qty]: [string, number]) => {
      if (qty > 0) {
        const prod = products.find(p => p.id === prodId);
        if (prod) {
          items.push({
            productId: prod.id,
            productName: prod.name,
            quantity: qty,
            unitPrice: prod.priceWholesale,
            subtotal: prod.priceWholesale * qty
          });
        }
      }
    });
    return items;
  };

  const handleInitialClick = () => {
      const items = getProposedItems();
      if (items.length > 0) {
          setShowConfirmation(true);
      }
  };

  const handleFinalConfirm = async () => {
    setIsProcessing(true);
    const items = getProposedItems();
    await onConfirmDispatch(client.id, items);
    setQuantities({}); // Reset form
    setIsExpanded(false); // Close accordion
    setShowConfirmation(false);
    setIsProcessing(false);
  };

  const totalUSD = calculateTotal();
  const totalBS = totalUSD * exchangeRate;
  const itemCount = (Object.values(quantities) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-4">
      {/* Header / Summary */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full flex-shrink-0 ${client.debt > client.creditLimit ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            <Truck size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 truncate">{client.businessName}</h3>
            <p className="text-xs text-gray-500 truncate">{client.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right flex-shrink-0">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Deuda</p>
            <p className={`font-mono font-bold text-sm ${client.debt > 0 ? 'text-red-500' : 'text-green-600'}`}>
              ${client.debt.toFixed(2)}
            </p>
          </div>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Expanded Order Form */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4 animate-in slide-in-from-top-2">
          {/* UPDATED HEIGHT: Changed max-h-80 to max-h-[60vh] to allow many items to be seen */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-200">
            {products.map(product => {
              const qty = quantities[product.id] || 0;
              return (
                <div key={product.id} className="flex items-center justify-between bg-white p-3 rounded shadow-sm border border-gray-100">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium text-gray-800 text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      Stock: {product.stock} | <span className="font-bold text-bakery-700">${product.priceWholesale.toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateQty(product.id, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold active:scale-95 transition-transform"
                      disabled={qty === 0}
                    >-</button>
                    <span className="w-6 text-center font-bold text-lg">{qty}</span>
                    <button 
                      onClick={() => updateQty(product.id, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-bakery-500 text-white hover:bg-bakery-600 font-bold shadow-sm active:scale-95 transition-transform disabled:bg-gray-300"
                      disabled={product.stock <= qty}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm gap-4 sticky bottom-0 z-10">
             <div className="flex justify-between sm:block">
               <p className="text-sm text-gray-500">Total Despacho</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-bold text-bakery-800">${totalUSD.toFixed(2)}</span>
                 <span className="text-xs text-gray-500">({totalBS.toFixed(2)} Bs)</span>
               </div>
             </div>
             
             <button
              onClick={handleInitialClick}
              disabled={itemCount === 0 || isProcessing}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-md transition-all active:scale-95
                ${itemCount > 0 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-300 cursor-not-allowed'}
              `}
             >
               {isProcessing ? 'Procesando...' : (
                 <>
                   <CheckCircle size={20} />
                   Despachar
                 </>
               )}
             </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
                  <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                          <AlertTriangle size={20} className="text-bakery-500"/> Confirmar Despacho
                      </h3>
                      <button onClick={() => setShowConfirmation(false)} className="p-1 hover:bg-gray-200 rounded-full">
                          <X size={20}/>
                      </button>
                  </div>
                  <div className="p-5 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm text-gray-600 mb-4">Revisa los productos antes de confirmar la carga al cliente <b>{client.businessName}</b>.</p>
                      <div className="space-y-2 mb-4">
                          {getProposedItems().map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                                  <span>{item.quantity} x {item.productName}</span>
                                  <span className="font-bold">${item.subtotal.toFixed(2)}</span>
                              </div>
                          ))}
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold text-gray-900 border-t border-gray-100 pt-2">
                          <span>Total a Deuda:</span>
                          <span>${totalUSD.toFixed(2)}</span>
                      </div>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-b-2xl grid grid-cols-2 gap-3">
                      <button 
                          onClick={() => setShowConfirmation(false)}
                          className="py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-100"
                      >
                          Corregir
                      </button>
                      <button 
                          onClick={handleFinalConfirm}
                          disabled={isProcessing}
                          className="py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200"
                      >
                          {isProcessing ? 'Guardando...' : 'Confirmar'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};