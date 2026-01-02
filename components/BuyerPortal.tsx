
import React, { useState, useMemo } from 'react';
import { Item, Order, WaitlistConfig } from '../types';
import { CheckCircleIcon, ExclamationTriangleIcon, PlusIcon, MinusIcon, SparklesIcon, BanknotesIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface Props {
  mnemonic: string;
  items: Item[];
  orders: Order[];
  waitlistConfig: WaitlistConfig;
  onOrderPlaced: (newItems: Item[], newOrders: Order[]) => void;
  isLoadingInventory: boolean;
}

const BuyerPortal: React.FC<Props> = ({ mnemonic, items, orders, waitlistConfig, onOrderPlaced, isLoadingInventory }) => {
  // Case-insensitive mnemonic matching for robust mobile entry
  const item = useMemo(() => items.find(i => i.mnemonic.toUpperCase() === mnemonic.toUpperCase()), [items, mnemonic]);
  const [formData, setFormData] = useState({ name: '', email: '', quantity: '1', address: '' });
  const [extraQuantities, setExtraQuantities] = useState<Record<string, number>>({});
  const [placed, setPlaced] = useState<{ status: 'success' | 'waitlist', orderId: string, total: number } | null>(null);

  const isTruthy = (val: any) => {
    if (typeof val === 'boolean') return val;
    if (val === null || val === undefined) return false;
    const s = String(val).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'checked';
  };

  // Improved upsell filter: Case-insensitive and robust truthy check
  const upsellItems = useMemo(() => {
    return items.filter(i => {
      const upsellActive = isTruthy(i.allowUpsell);
      const isNotSelf = i.mnemonic.toUpperCase() !== mnemonic.toUpperCase();
      const isAvailable = i.quantity > 0 || waitlistConfig.maxSize > 0;
      return upsellActive && isNotSelf && isAvailable;
    });
  }, [items, mnemonic, waitlistConfig.maxSize]);

  const generateOrderId = () => `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const calculateTotal = () => {
    if (!item) return 0;
    let total = item.price * parseInt(formData.quantity || '0');
    (Object.entries(extraQuantities) as [string, number][]).forEach(([id, qty]) => {
      const extra = items.find(i => i.id === id);
      if (extra && typeof qty === 'number') total += extra.price * qty;
    });
    return total;
  };

  if (isLoadingInventory && !item) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-50 z-[999]">
        <div className="max-w-md w-full text-center p-12 bg-white rounded-[3rem] border border-slate-200 shadow-xl animate-pulse">
          <ArrowPathIcon className="w-16 h-16 text-indigo-500 mx-auto mb-6 animate-spin" />
          <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase tracking-[0.2em]">Synchronizing</h2>
          <p className="text-slate-400 mt-4 text-xs font-bold uppercase tracking-widest">Checking secure stock levels...</p>
        </div>
      </div>
    );
  }

  if (!item && !isLoadingInventory) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full text-center p-10 bg-white rounded-[3rem] border-2 border-amber-100 shadow-xl">
          <ExclamationTriangleIcon className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 mt-4 text-sm font-bold px-4">
            The item <span className="text-indigo-600 font-mono">#{mnemonic}</span> is not currently available in this store's inventory.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100">
             <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Mnemonic Hub v1.5</p>
          </div>
        </div>
      </div>
    );
  }

  const isOutOfStock = (item?.quantity ?? 0) <= 0;
  const canWaitlist = isOutOfStock && waitlistConfig.maxSize > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const isoNow = new Date().toISOString();
    const orderLines: { item: Item, qty: number }[] = [{ item: item, qty: parseInt(formData.quantity) }];
    
    (Object.entries(extraQuantities) as [string, number][]).forEach(([id, qty]) => {
      if (typeof qty === 'number' && qty > 0) {
        const ex = items.find(i => i.id === id);
        if (ex) orderLines.push({ item: ex, qty });
      }
    });

    let updatedItems = [...items];
    const newOrders: Order[] = [];
    const sharedOrderId = generateOrderId();
    const finalTotal = calculateTotal();

    orderLines.forEach(({ item: it, qty }, idx) => {
      const status = it.quantity >= qty ? 'confirmed' : 'waitlisted';
      newOrders.push({
        id: `${Date.now()}-${idx}`, orderId: sharedOrderId, itemId: it.id, itemName: it.name,
        mnemonic: it.mnemonic, buyerName: formData.name, buyerEmail: formData.email,
        quantity: qty, address: formData.address, timestamp: isoNow, status: status as any
      });
      updatedItems = updatedItems.map(i => i.id === it.id ? { ...i, quantity: Math.max(0, i.quantity - qty) } : i);
    });

    onOrderPlaced(updatedItems, [...orders, ...newOrders]);
    setPlaced({ 
      status: (item?.quantity ?? 0) >= parseInt(formData.quantity) ? 'success' : 'waitlist', 
      orderId: sharedOrderId, 
      total: finalTotal 
    });
  };

  if (placed) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-start justify-center pt-12 animate-in zoom-in duration-300">
        <div className="max-w-md w-full text-center p-10 bg-white rounded-[3rem] border-2 border-indigo-100 shadow-2xl relative overflow-hidden">
          <CheckCircleIcon className={`w-20 h-20 mx-auto mb-6 ${placed.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}`} />
          <h2 className="text-3xl font-black text-slate-800 leading-none">
            {placed.status === 'success' ? 'Order Success' : 'Waitlisted'}
          </h2>
          <div className="text-slate-500 mt-6 font-bold text-sm px-4 space-y-4">
            <p>Thank you, {formData.name}. We've received your request.</p>
            <p className="text-indigo-600 bg-indigo-50 py-4 px-6 rounded-2xl border border-indigo-100 leading-relaxed font-black">
              An order confirmation email for payment will be sent to you shortly.
            </p>
          </div>
          <div className="mt-8 bg-slate-50 rounded-3xl p-6 border border-slate-100 text-left space-y-4">
            <div className="flex justify-between text-[10px] font-black"><span className="text-slate-400 uppercase tracking-widest">Reference</span><span className="font-mono text-slate-900">{placed.orderId}</span></div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-200"><span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total</span><span className="text-3xl font-black text-indigo-600">${placed.total.toFixed(2)}</span></div>
          </div>
          <div className="mt-12 border-t border-slate-100 pt-8">
            <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.4em]">Secure Checkout Complete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white md:bg-slate-50 min-h-screen">
      <div className="max-w-md mx-auto w-full p-6 md:py-12 pb-64">
        {item && (
          <div className="bg-white p-6 md:p-10 rounded-[3rem] md:border md:border-slate-200 md:shadow-xl relative overflow-visible animate-in fade-in duration-500">
            
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">{item.category}</span>
              <span className="text-xs font-mono font-bold text-slate-300">#{item.mnemonic}</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-2 leading-tight tracking-tight">{item.name}</h2>
            <div className="flex items-baseline gap-2 mb-10">
              <span className="text-5xl font-black text-indigo-600 tracking-tighter">${item.price.toFixed(2)}</span>
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">per unit</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity & Delivery</p>
                <input required placeholder="Your Full Name" className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-black text-slate-800 shadow-sm appearance-none"
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <input required type="email" placeholder="Email Address" className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-black text-slate-800 shadow-sm appearance-none"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <input required placeholder="Shipping Address" className="w-full p-5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-black text-slate-800 shadow-sm appearance-none"
                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>

              <div className="bg-indigo-600/5 p-8 rounded-[2rem] border border-indigo-500/10 shadow-inner">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Quantity</p>
                  {isOutOfStock && <span className="text-[10px] font-black text-amber-600 bg-white px-3 py-1 rounded-full border border-amber-200 uppercase animate-pulse px-3">Waitlist Only</span>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setFormData(f => ({ ...f, quantity: Math.max(1, parseInt(f.quantity) - 1).toString() }))} className="w-14 h-14 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-md active:scale-90"><MinusIcon className="w-6 h-6" /></button>
                    <span className="text-3xl font-black text-slate-800 w-10 text-center tracking-tighter">{formData.quantity}</span>
                    <button type="button" onClick={() => setFormData(f => ({ ...f, quantity: (parseInt(f.quantity) + 1).toString() }))} className="w-14 h-14 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-md active:scale-90"><PlusIcon className="w-6 h-6" /></button>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 tracking-tight">${(item.price * parseInt(formData.quantity)).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Offer After Section: Optimized for visibility and robust filtering */}
              {upsellItems.length > 0 && (
                <div className="space-y-4 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center gap-3 px-2">
                    <SparklesIcon className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">Offer After: Recommended</h3>
                  </div>
                  <div className="space-y-4">
                    {upsellItems.map(up => {
                      const q = extraQuantities[up.id] || 0;
                      return (
                        <div key={up.id} className={`bg-white border-2 rounded-[2.5rem] p-6 flex justify-between items-center transition-all duration-300 ${q > 0 ? 'border-indigo-500 bg-indigo-50/20 shadow-lg' : 'border-slate-100'}`}>
                          <div className="flex-1 pr-4">
                            <p className="font-black text-slate-800 text-lg leading-tight mb-1">{up.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">${up.price.toFixed(2)}</p>
                              {up.quantity <= 0 && <span className="text-[8px] font-black text-amber-500 uppercase px-1.5 py-0.5 bg-amber-50 rounded-md border border-amber-100">Waitlist</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {q > 0 ? (
                              <div className="flex items-center gap-4">
                                <button type="button" onClick={() => setExtraQuantities({...extraQuantities, [up.id]: Math.max(0, q - 1)})} className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm active:scale-75 transition-transform"><MinusIcon className="w-5 h-5" /></button>
                                <span className="font-black text-indigo-600 text-lg w-4 text-center">{q}</span>
                                <button type="button" onClick={() => setExtraQuantities({...extraQuantities, [up.id]: q + 1})} className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm active:scale-75 transition-transform"><PlusIcon className="w-5 h-5" /></button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setExtraQuantities({...extraQuantities, [up.id]: 1})} className="px-6 py-3 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-95">Add</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl flex flex-col items-center gap-6 border-b-[12px] border-indigo-600 mt-12">
                <div className="flex items-center gap-4 w-full justify-between">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Final Total</p>
                    <p className="text-5xl font-black tracking-tighter leading-none">${calculateTotal().toFixed(2)}</p>
                  </div>
                  <div className="bg-indigo-600/20 p-4 rounded-2xl">
                    <BanknotesIcon className="w-10 h-10 text-indigo-400" />
                  </div>
                </div>
                <button type="submit" disabled={isOutOfStock && !canWaitlist} className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl transition-all active:scale-95 ${isOutOfStock ? (canWaitlist ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed') : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                  {isOutOfStock ? (canWaitlist ? 'Join Waitlist' : 'Out of Stock') : 'Submit Secure Order'}
                </button>
              </div>
            </form>
            
            <p className="text-center text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 mt-10">Secure Merchant Checkout Hub</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerPortal;
