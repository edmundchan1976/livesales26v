
import React, { useState, useEffect, useMemo } from 'react';
import { Item, Order, WaitlistConfig } from '../types';
import InventoryInput from './InventoryInput';
import OrderVisualizer from './OrderVisualizer';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowPathIcon, 
  ListBulletIcon, 
  ChartBarIcon, 
  QrCodeIcon, 
  TrashIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentIcon,
  WifiIcon,
  PlusCircleIcon,
  DocumentDuplicateIcon,
  UserGroupIcon,
  ClockIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface Props {
  items: Item[];
  orders: Order[];
  webhookUrl: string;
  onWebhookChange: (url: string) => void;
  setItems: (items: Item[]) => void;
  setOrders: (orders: Order[]) => void;
  waitlistConfig: WaitlistConfig;
  setWaitlistConfig: (config: WaitlistConfig) => void;
  onManualSync: () => Promise<void>;
  onTestSync: () => Promise<void>;
}

interface GroupedOrder {
  orderId: string;
  timestamp: string;
  buyerName: string;
  buyerEmail: string;
  address: string;
  lines: Order[];
  totalQty: number;
  distinctItems: number;
  totalCost: number;
  overallStatus: 'confirmed' | 'waitlisted' | 'mixed';
}

const SellerDashboard: React.FC<Props> = ({ 
  items, 
  orders, 
  webhookUrl,
  onWebhookChange,
  setItems, 
  setOrders, 
  waitlistConfig, 
  setWaitlistConfig,
  onManualSync,
  onTestSync
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'viz' | 'add' | 'settings'>(webhookUrl ? 'inventory' : 'settings');
  const [selectedMnemonic, setSelectedMnemonic] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasVerifiedOnce, setHasVerifiedOnce] = useState(!!webhookUrl);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!webhookUrl) {
      setActiveTab('settings');
      setHasVerifiedOnce(false);
    }
  }, [webhookUrl]);

  const isLocked = !webhookUrl || !hasVerifiedOnce;

  const itemPriceMap = useMemo(() => new Map(items.map(i => [i.id, i.price])), [items]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, GroupedOrder> = {};
    
    orders.forEach(o => {
      if (!groups[o.orderId]) {
        groups[o.orderId] = {
          orderId: o.orderId,
          timestamp: o.timestamp,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          address: o.address,
          lines: [],
          totalQty: 0,
          distinctItems: 0,
          totalCost: 0,
          overallStatus: 'confirmed'
        };
      }
      
      const g = groups[o.orderId];
      g.lines.push(o);
      g.totalQty += o.quantity;
      const price = itemPriceMap.get(o.itemId) || 0;
      g.totalCost += price * o.quantity;
    });

    return Object.values(groups).map(g => {
      g.distinctItems = g.lines.length;
      const hasConfirmed = g.lines.some(l => l.status === 'confirmed');
      const hasWaitlisted = g.lines.some(l => l.status === 'waitlisted');
      
      if (hasConfirmed && hasWaitlisted) g.overallStatus = 'mixed';
      else if (hasWaitlisted) g.overallStatus = 'waitlisted';
      else g.overallStatus = 'confirmed';
      
      return g;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, itemPriceMap]);

  const toggleOrderExpansion = (orderId: string) => {
    const newSet = new Set(expandedOrderIds);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setExpandedOrderIds(newSet);
  };

  const formatSGT = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) {
      return 'N/A';
    }
  };

  const revenuePotential = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const uniqueOrderCount = groupedOrders.length;
  const uniqueWaitlistOrderCount = groupedOrders.filter(g => g.overallStatus === 'waitlisted' || g.overallStatus === 'mixed').length;

  const handleAddItem = (data: Partial<Item>) => {
    const newItem: Item = {
      id: Date.now().toString(),
      category: data.category || 'General',
      name: data.name || 'New Item',
      price: data.price || 0,
      quantity: data.quantity || 0,
      mnemonic: (data.name || 'ITEM').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) + Math.floor(Math.random() * 100),
      order: items.length,
      allowUpsell: false,
    };
    setItems([...items, newItem]);
    setActiveTab('inventory');
  };

  const toggleUpsell = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, allowUpsell: !i.allowUpsell } : i));
  };

  const deleteItem = (id: string) => {
    if (confirm("Delete this inventory item?")) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await onManualSync();
    setIsSyncing(false);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await onTestSync();
      setHasVerifiedOnce(true);
      alert("Connection verified!");
      setActiveTab('inventory');
    } catch (e) {
      alert("Verification failed.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => e.preventDefault();
  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const sortedItems = [...items].sort((a, b) => a.order - b.order);
    const draggedItem = sortedItems[draggedIndex];
    sortedItems.splice(draggedIndex, 1);
    sortedItems.splice(index, 0, draggedItem);
    setItems(sortedItems.map((item, idx) => ({ ...item, order: idx })));
    setDraggedIndex(null);
  };

  const getOrderUrl = (mnemonic: string) => {
    const fullBaseUrl = (window.location.origin + window.location.pathname).replace(/\/$/, ""); 
    const configParam = webhookUrl ? `?w=${encodeURIComponent(btoa(webhookUrl))}` : '';
    return `${fullBaseUrl}${configParam}#/order/${mnemonic}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => alert("Buyer order link copied to clipboard."));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {selectedMnemonic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedMnemonic(null)}></div>
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl relative w-full max-w-md flex flex-col items-center animate-in zoom-in duration-300">
            <button onClick={() => setSelectedMnemonic(null)} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-600 transition-colors bg-slate-50 rounded-full"><XMarkIcon className="w-6 h-6" /></button>
            <div className="text-center mb-10">
              <h4 className="text-3xl font-black text-slate-900 leading-none">Scan to Order</h4>
              <p className="text-base font-medium text-slate-500 mt-3">Point mobile camera at the code below</p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border-[16px] border-slate-50 shadow-inner mb-10 ring-1 ring-slate-100">
              <QRCodeSVG value={getOrderUrl(selectedMnemonic)} size={300} level="H" includeMargin={true} />
            </div>
            <div className="flex flex-col gap-4 w-full">
              <div className="bg-indigo-50/50 px-6 py-5 rounded-2xl border border-indigo-100/50 flex justify-between items-center group">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Selling Code</span>
                  <span className="font-mono font-black text-indigo-700 tracking-[0.2em] text-xl">{selectedMnemonic}</span>
                </div>
                <button onClick={() => copyToClipboard(getOrderUrl(selectedMnemonic))} className="text-indigo-400 hover:text-indigo-700 transition-colors p-2 hover:bg-indigo-100/50 rounded-xl"><ClipboardDocumentIcon className="w-8 h-8" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Dashboard */}
      <div className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 transition-all duration-700 ${isLocked ? 'blur-md grayscale opacity-50 pointer-events-none' : ''}`}>
        {[
          { label: 'Inventory', value: items.length, color: 'bg-slate-500', icon: ListBulletIcon },
          { label: 'Total Orders', value: uniqueOrderCount, color: 'bg-indigo-500', icon: UserGroupIcon },
          { label: 'Waitlisted', value: uniqueWaitlistOrderCount, color: 'bg-amber-500', icon: ClockIcon },
          { label: 'Line Items', value: orders.length, color: 'bg-emerald-500', icon: DocumentDuplicateIcon },
          { label: 'Total Qty', value: orders.reduce((a, b) => a + b.quantity, 0), color: 'bg-rose-500', icon: PlusCircleIcon },
          { label: 'Potential', value: `$${revenuePotential.toFixed(0)}`, color: 'bg-purple-500', icon: ChartBarIcon },
        ].map((m, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md group">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
              <m.icon className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{m.value}</p>
            <div className={`h-1 w-6 rounded-full mt-2.5 ${m.color}`}></div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 bg-slate-200/50 p-1.5 rounded-2xl w-fit relative">
        {[
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, locked: false },
          { id: 'add', label: 'Add Inventory', icon: PlusCircleIcon, locked: isLocked },
          { id: 'inventory', label: 'Database', icon: ListBulletIcon, locked: isLocked },
          { id: 'orders', label: 'Live Orders', icon: ArrowPathIcon, locked: isLocked },
          { id: 'viz', label: 'Analytics', icon: ChartBarIcon, locked: isLocked },
        ].map(tab => (
          <button key={tab.id} disabled={tab.locked} onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 group relative overflow-hidden ${
              activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : tab.locked ? 'text-slate-400 opacity-60 cursor-not-allowed' : 'text-slate-500 hover:text-slate-800'
            }`}>
            {tab.locked ? <LockClosedIcon className="w-3 h-3 text-slate-300" /> : <tab.icon className="w-4 h-4" />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full">
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div className="flex flex-col">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Selling Database</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Drag rows to prioritize sales order</p>
              </div>
              <button onClick={handleManualSync} disabled={isSyncing} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isSyncing ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'}`}>
                <ArrowUpTrayIcon className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} /> {isSyncing ? 'Syncing...' : 'Force Sync'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase bg-slate-50/50 text-slate-400 font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4 w-10 text-center">#</th>
                    <th className="px-6 py-4">Mnemonic</th>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4 text-center">In Stock</th>
                    <th className="px-6 py-4 text-center">Offer After?</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Empty inventory. <button onClick={() => setActiveTab('add')} className="text-indigo-600 underline ml-1">Add items here</button></td></tr>
                  ) : (
                    [...items].sort((a,b) => a.order - b.order).map((item, idx) => (
                      <tr key={item.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} className={`hover:bg-slate-50/50 group transition-colors ${draggedIndex === idx ? 'opacity-30 bg-indigo-50 shadow-inner' : ''}`}>
                        <td className="px-4 py-5"><Bars3Icon className="w-5 h-5 cursor-grab text-slate-200 group-hover:text-indigo-400" /></td>
                        <td className="px-6 py-5"><button onClick={() => setSelectedMnemonic(item.mnemonic)} className="text-indigo-600 font-black bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 transition-all font-mono text-xs tracking-widest">{item.mnemonic}</button></td>
                        <td className="px-6 py-5"><div className="font-bold text-slate-800">{item.name}</div><div className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{item.category}</div></td>
                        <td className="px-6 py-5 font-black text-slate-700">${item.price.toFixed(2)}</td>
                        <td className="px-6 py-5 text-center"><span className={`px-4 py-2 rounded-xl text-[10px] font-black border uppercase ${item.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{item.quantity} units</span></td>
                        <td className="px-6 py-5 text-center"><input type="checkbox" checked={item.allowUpsell || false} onChange={() => toggleUpsell(item.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></td>
                        <td className="px-6 py-5 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100"><button onClick={() => setSelectedMnemonic(item.mnemonic)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl"><QrCodeIcon className="w-5 h-5" /></button><button onClick={() => deleteItem(item.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"><TrashIcon className="w-5 h-5" /></button></div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-300">
             <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Consolidated Order Log</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Click Order ID to view individual items</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-tighter"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Total Unique: {uniqueOrderCount}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] uppercase bg-slate-50/50 text-slate-400 font-black tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 w-10"></th>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Time (SGT)</th>
                    <th className="px-6 py-4">Buyer</th>
                    <th className="px-6 py-4 text-center">Items</th>
                    <th className="px-6 py-4 text-center">Qty</th>
                    <th className="px-6 py-4 text-right">Total Cost</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedOrders.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No transactions found.</td></tr>
                  ) : (
                    groupedOrders.map((group) => {
                      const isExpanded = expandedOrderIds.has(group.orderId);
                      return (
                        <React.Fragment key={group.orderId}>
                          <tr className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`} onClick={() => toggleOrderExpansion(group.orderId)}>
                            <td className="px-6 py-6">
                              {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-indigo-500" /> : <ChevronRightIcon className="w-4 h-4 text-slate-300" />}
                            </td>
                            <td className="px-6 py-6 font-mono font-black text-[11px] text-indigo-600">{group.orderId}</td>
                            <td className="px-6 py-6 text-slate-400 font-bold text-xs">{formatSGT(group.timestamp)}</td>
                            <td className="px-6 py-6"><div className="font-black text-slate-900 text-xs">{group.buyerName}</div></td>
                            <td className="px-6 py-6 text-center font-bold text-slate-700">{group.distinctItems}</td>
                            <td className="px-6 py-6 text-center font-black text-slate-900">{group.totalQty}</td>
                            <td className="px-6 py-6 text-right font-black text-emerald-600 tracking-tight">${group.totalCost.toFixed(2)}</td>
                            <td className="px-6 py-6 text-center">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${
                                group.overallStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                group.overallStatus === 'mixed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {group.overallStatus}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={8} className="px-12 py-6 border-b border-indigo-100/50">
                                <div className="space-y-4">
                                  <div className="flex gap-12 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">
                                    <div className="flex items-center gap-2"><UserGroupIcon className="w-3.5 h-3.5" /> {group.buyerEmail}</div>
                                    <div className="flex items-center gap-2"><ArrowPathIcon className="w-3.5 h-3.5" /> {group.address}</div>
                                  </div>
                                  <table className="w-full text-[11px]">
                                    <thead className="text-slate-400 uppercase font-bold border-b border-slate-100">
                                      <tr>
                                        <th className="text-left py-2">Mnemonic</th>
                                        <th className="text-left py-2">Item Name</th>
                                        <th className="text-center py-2">Qty</th>
                                        <th className="text-right py-2">Unit Price</th>
                                        <th className="text-right py-2">Subtotal</th>
                                        <th className="text-center py-2">Line Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/50">
                                      {group.lines.map((line, idx) => {
                                        const price = itemPriceMap.get(line.itemId) || 0;
                                        return (
                                          <tr key={idx} className="text-slate-600">
                                            <td className="py-3 font-mono font-bold text-indigo-500">{line.mnemonic}</td>
                                            <td className="py-3 font-medium">{line.itemName}</td>
                                            <td className="py-3 text-center font-black">{line.quantity}</td>
                                            <td className="py-3 text-right text-slate-400">${price.toFixed(2)}</td>
                                            <td className="py-3 text-right font-bold text-slate-800">${(price * line.quantity).toFixed(2)}</td>
                                            <td className="py-3 text-center">
                                              <span className={`text-[8px] font-black uppercase ${line.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                {line.status}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'viz' && (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="font-black text-slate-900 mb-10 uppercase tracking-widest text-xs">Sales vs. Priority Analytics</h3>
            <OrderVisualizer items={items} orders={orders} />
          </div>
        )}

        {activeTab === 'add' && (
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto">
            <h3 className="font-black text-slate-900 mb-8 flex items-center gap-4 text-sm uppercase tracking-[0.25em]"><span className="bg-indigo-600 text-white p-2 rounded-xl"><PlusCircleIcon className="w-5 h-5" /></span> Inventory Entry Center</h3>
            <InventoryInput onAdd={handleAddItem} onBulkAdd={(newItems) => {
              const mapped = newItems.map((ni, idx) => ({ ...ni, id: `bulk-${Date.now()}-${idx}`, mnemonic: ni.mnemonic || (ni.name || 'ITEM').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) + Math.floor(Math.random() * 100), order: items.length + idx, allowUpsell: false })) as Item[];
              setItems([...items, ...mapped]);
              setActiveTab('inventory');
            }} />
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {isLocked && <div className="absolute top-0 left-0 w-full bg-indigo-600/20 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] border-b border-indigo-500/30 animate-pulse">Action Required: Configure Webhook to Unlock Dashboard</div>}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 mt-4">
              <h3 className="font-black flex items-center gap-4 text-sm uppercase tracking-[0.25em]"><span className={`p-2 rounded-xl transition-colors ${isLocked ? 'bg-amber-500 text-white animate-bounce' : 'bg-white/10 text-indigo-400'}`}>{isLocked ? <LockClosedIcon className="w-5 h-5" /> : <ShieldCheckIcon className="w-5 h-5" />}</span> {isLocked ? 'Initial Connection Setup' : 'System Configuration'}</h3>
              {hasVerifiedOnce && <div className="bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-full text-[10px] font-black border border-emerald-500/30 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> System Connected</div>}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
              <div className="space-y-10">
                <div className={`${isLocked ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-900 rounded-3xl p-2' : ''}`}>
                  <label className="text-[10px] text-slate-400 block mb-4 uppercase font-black tracking-[0.2em]">Google Sheet Webhook Endpoint</label>
                  <div className="flex gap-3">
                    <input type="text" placeholder="https://script.google.com/..." value={webhookUrl} onChange={(e) => { onWebhookChange(e.target.value); setHasVerifiedOnce(false); }} className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-sm text-indigo-100 placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium backdrop-blur-sm" />
                    <button onClick={handleTestConnection} disabled={isTesting || !webhookUrl} className={`p-5 rounded-2xl transition-all min-w-[140px] flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest ${isTesting ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/40'}`}>{isTesting ? <WifiIcon className="w-5 h-5 animate-ping" /> : <><WifiIcon className="w-5 h-5" /> Verify</>}</button>
                  </div>
                </div>
              </div>
              <div className={`space-y-12 transition-all duration-700 ${isLocked ? 'blur-sm grayscale opacity-30 pointer-events-none select-none' : ''}`}>
                <div className="bg-slate-800/20 p-8 rounded-[2rem] border border-slate-700/30">
                  <div className="flex justify-between items-center mb-6"><label className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Waitlist Capacity</label><span className="bg-indigo-500/10 text-indigo-400 px-5 py-2 rounded-full text-[10px] font-black border border-indigo-500/30">{waitlistConfig.maxSize} SLOTS</span></div>
                  <input type="range" min="0" max="25" value={waitlistConfig.maxSize} onChange={(e) => setWaitlistConfig({ maxSize: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;
