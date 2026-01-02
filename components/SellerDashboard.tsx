
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
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ClipboardDocumentIcon,
  WifiIcon,
  PlusCircleIcon,
  DocumentDuplicateIcon,
  UserGroupIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon,
  TagIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon
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
  onResetCache: () => void;
  syncDiagnostic?: string;
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
  hasWaitlistedLine: boolean;
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
  onTestSync,
  onResetCache,
  syncDiagnostic
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'viz' | 'add' | 'settings'>('settings');
  const [selectedMnemonic, setSelectedMnemonic] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasVerifiedOnce, setHasVerifiedOnce] = useState(!!webhookUrl);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [orderFilterMode, setOrderFilterMode] = useState<'all' | 'waitlisted'>('all');

  const handleTabClick = async (tab: any) => {
    setActiveTab(tab);
    if ((tab === 'orders' || tab === 'inventory') && webhookUrl) {
      handleManualSync();
    }
  };

  const isLocked = !webhookUrl;

  const itemPriceMap = useMemo(() => new Map(items.map(i => [i.mnemonic.toUpperCase(), i.price])), [items]);
  const itemStockMap = useMemo(() => new Map(items.map(i => [i.mnemonic.toUpperCase(), i.quantity])), [items]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, GroupedOrder> = {};
    const safeOrders = Array.isArray(orders) ? orders : [];
    
    safeOrders.forEach((o, idx) => {
      const baseKey = o.orderId || `${o.buyerName}-${o.timestamp}` || `GRP-${idx}`;
      const key = String(baseKey).toUpperCase();
      
      if (!groups[key]) {
        groups[key] = {
          orderId: o.orderId || 'N/A',
          timestamp: o.timestamp,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          address: o.address,
          lines: [],
          totalQty: 0,
          distinctItems: 0,
          totalCost: 0,
          overallStatus: 'confirmed',
          hasWaitlistedLine: false
        };
      }
      
      const g = groups[key];
      g.lines.push(o);
      g.totalQty += (o.quantity || 0);
      const price = itemPriceMap.get(o.mnemonic.toUpperCase()) || 0;
      g.totalCost += price * (o.quantity || 0);
      if (o.status === 'waitlisted') g.hasWaitlistedLine = true;
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

  const filteredOrders = useMemo(() => {
    if (orderFilterMode === 'waitlisted') {
      return groupedOrders.filter(g => g.hasWaitlistedLine);
    }
    return groupedOrders;
  }, [groupedOrders, orderFilterMode]);

  const toggleOrderExpansion = (orderId: string) => {
    const newSet = new Set(expandedOrderIds);
    if (newSet.has(orderId)) newSet.delete(orderId);
    else newSet.add(orderId);
    setExpandedOrderIds(newSet);
  };

  const formatSGT = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  const totalBalance = items.reduce((acc, i) => acc + i.quantity, 0);
  const uniqueOrderCount = groupedOrders.length;
  const uniqueWaitlistOrderCount = groupedOrders.filter(g => g.hasWaitlistedLine).length;

  const handleManualSync = async () => {
    if (!webhookUrl) return;
    setIsSyncing(true);
    try {
      await onManualSync();
    } catch (e) {
      console.error("Manual sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    onResetCache(); 
    try {
      await onTestSync();
      setHasVerifiedOnce(true);
      setActiveTab('orders');
    } catch (e) {
      console.error(e);
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
    const updatedItems = sortedItems.map((item, idx) => ({ ...item, order: idx }));
    setItems(updatedItems);
    setDraggedIndex(null);
  };

  const toggleUpsell = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, allowUpsell: !i.allowUpsell } : i));
  };

  const deleteItem = (id: string) => {
    if (confirm("Delete item?")) setItems(items.filter(i => i.id !== id));
  };

  const getOrderUrl = (mnemonic: string) => {
    const fullBaseUrl = (window.location.origin + window.location.pathname).replace(/\/$/, ""); 
    const configParam = webhookUrl ? `?w=${encodeURIComponent(btoa(webhookUrl))}` : '';
    return `${fullBaseUrl}${configParam}#/order/${mnemonic}`;
  };

  const isFailedFetch = syncDiagnostic?.includes('CONNECTION_BLOCKED') || syncDiagnostic?.includes('Failed to fetch');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {selectedMnemonic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedMnemonic(null)}></div>
          <div className="bg-white rounded-[3rem] p-10 shadow-2xl relative w-full max-w-md flex flex-col items-center animate-in zoom-in duration-300">
            <button onClick={() => setSelectedMnemonic(null)} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-600 transition-colors bg-slate-50 rounded-full"><XMarkIcon className="w-6 h-6" /></button>
            <div className="text-center mb-10">
              <h4 className="text-3xl font-black text-slate-900 leading-none">Scan to Order</h4>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border-[16px] border-slate-50 shadow-inner mb-10 ring-1 ring-slate-100">
              <QRCodeSVG value={getOrderUrl(selectedMnemonic)} size={300} level="H" includeMargin={true} />
            </div>
            <div className="bg-indigo-50/50 px-6 py-5 rounded-2xl border border-indigo-100/50 flex justify-between items-center w-full">
              <span className="font-mono font-black text-indigo-700 tracking-[0.2em] text-xl">{selectedMnemonic}</span>
              <button onClick={() => {
                navigator.clipboard.writeText(getOrderUrl(selectedMnemonic));
                alert("Link copied!");
              }} className="text-indigo-400 hover:text-indigo-700 transition-colors p-2 hover:bg-indigo-100/50 rounded-xl"><ClipboardDocumentIcon className="w-8 h-8" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 bg-slate-200/50 p-1.5 rounded-2xl w-fit relative">
        {[
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, locked: false },
          { id: 'add', label: 'Add Inventory', icon: PlusCircleIcon, locked: isLocked },
          { id: 'inventory', label: 'Database', icon: ListBulletIcon, locked: isLocked },
          { id: 'orders', label: 'Live Orders', icon: ArrowPathIcon, locked: isLocked },
          { id: 'viz', label: 'Analytics', icon: ChartBarIcon, locked: isLocked },
        ].map(tab => (
          <button key={tab.id} disabled={tab.locked} onClick={() => handleTabClick(tab.id as any)}
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
                <div className="flex items-center gap-2">
                   <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Selling Database</h3>
                   {isSyncing && <ArrowPathIcon className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Cloud-synced Inventory Sheet</p>
              </div>
              <button onClick={handleManualSync} disabled={isSyncing} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isSyncing ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}>
                <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> Refresh Cloud Data
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase bg-slate-50/50 text-slate-400 font-black tracking-widest">
                  <tr>
                    <th className="px-4 py-4 w-10 text-center">#</th>
                    <th className="px-6 py-4">Mnemonic</th>
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4 text-center">Stock Balance</th>
                    <th className="px-6 py-4 text-center">Offer After?</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-300 font-black uppercase text-[10px]">Database Empty. Syncing required.</td></tr>
                  ) : [...items].sort((a,b) => a.order - b.order).map((item, idx) => (
                    <tr key={item.id} 
                      draggable 
                      onDragStart={() => handleDragStart(idx)} 
                      onDragOver={(e) => handleDragOver(e, idx)} 
                      onDrop={() => handleDrop(idx)} 
                      className={`hover:bg-slate-50/50 group transition-colors ${draggedIndex === idx ? 'opacity-30 bg-indigo-50 shadow-inner' : ''}`}>
                      <td className="px-4 py-5"><Bars3Icon className="w-5 h-5 cursor-grab text-slate-200 group-hover:text-indigo-400" /></td>
                      <td className="px-6 py-5"><button onClick={() => setSelectedMnemonic(item.mnemonic)} className="text-indigo-600 font-black bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 font-mono text-xs">{item.mnemonic}</button></td>
                      <td className="px-6 py-5 font-bold text-slate-800">{item.name}</td>
                      <td className="px-6 py-5 text-center"><span className={`px-4 py-2 rounded-xl text-[10px] font-black border uppercase ${item.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{item.quantity} units</span></td>
                      <td className="px-6 py-5 text-center">
                         <input type="checkbox" checked={!!item.allowUpsell} onChange={() => toggleUpsell(item.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      <td className="px-6 py-5 text-right flex justify-end gap-2">
                        <button onClick={() => setSelectedMnemonic(item.mnemonic)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><QrCodeIcon className="w-5 h-5" /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
            {/* Connection Diagnostic Message */}
            {syncDiagnostic && (
              <div className={`p-4 rounded-2xl flex items-center justify-between border ${isFailedFetch ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'}`}>
                <div className="flex items-center gap-3">
                  {isFailedFetch ? <ExclamationTriangleIcon className="w-5 h-5 text-rose-600" /> : <InformationCircleIcon className="w-5 h-5 text-indigo-600" />}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{isFailedFetch ? 'Connection Blocked by Google' : 'Sync Status'}</p>
                    <p className="text-[11px] font-bold">{syncDiagnostic}</p>
                  </div>
                </div>
                {isFailedFetch && (
                  <button onClick={() => setActiveTab('settings')} className="text-[10px] font-black uppercase underline decoration-rose-400 underline-offset-4">Fix Connection</button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <button onClick={() => setOrderFilterMode('all')} className={`p-6 rounded-[2.5rem] border transition-all text-left flex items-center justify-between group ${orderFilterMode === 'all' ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-100 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm hover:border-indigo-300'}`}>
                  <div><p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${orderFilterMode === 'all' ? 'text-indigo-200' : 'text-slate-400'}`}>Total Orders</p><p className="text-3xl font-black">{uniqueOrderCount}</p></div>
                  <div className={`p-4 rounded-2xl ${orderFilterMode === 'all' ? 'bg-white/10' : 'bg-slate-50 text-slate-300'}`}><UserGroupIcon className="w-8 h-8" /></div>
               </button>
               <button onClick={() => setOrderFilterMode('waitlisted')} className={`p-6 rounded-[2.5rem] border transition-all text-left flex items-center justify-between group ${orderFilterMode === 'waitlisted' ? 'bg-amber-500 border-amber-400 shadow-xl shadow-amber-100 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm hover:border-amber-300'}`}>
                  <div><p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${orderFilterMode === 'waitlisted' ? 'text-amber-100' : 'text-slate-400'}`}>Waitlist Demand</p><p className="text-3xl font-black">{uniqueWaitlistOrderCount}</p></div>
                  <div className={`p-4 rounded-2xl ${orderFilterMode === 'waitlisted' ? 'bg-white/10' : 'bg-slate-50 text-slate-300 group-hover:text-amber-500'}`}><ExclamationCircleIcon className="w-8 h-8" /></div>
               </button>
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
                  <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available Cloud Stock</p><p className="text-3xl font-black text-slate-900">{totalBalance}</p></div>
                  <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-500"><CheckBadgeIcon className="w-8 h-8" /></div>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
               <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Live Transactions</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Sourced from "Orders" sheet.</p>
                </div>
                <button onClick={handleManualSync} disabled={isSyncing} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-100">
                  <ArrowPathIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> Force Re-Sync
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase bg-slate-50/50 text-slate-400 font-black tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 w-10"></th>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Time (SGT)</th>
                      <th className="px-6 py-4">Buyer</th>
                      <th className="px-6 py-4 text-center">Items</th>
                      <th className="px-6 py-4 text-right">Revenue</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-24 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">{isSyncing ? 'Fetching...' : 'No orders found.'}</td></tr>
                    ) : (
                      filteredOrders.map((group) => {
                        const isExpanded = expandedOrderIds.has(group.orderId);
                        return (
                          <React.Fragment key={group.orderId}>
                            <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`} onClick={() => toggleOrderExpansion(group.orderId)}>
                              <td className="px-6 py-6">{isExpanded ? <ChevronDownIcon className="w-4 h-4 text-indigo-500" /> : <ChevronRightIcon className="w-4 h-4 text-slate-300" />}</td>
                              <td className="px-6 py-6 font-mono font-black text-[11px] text-indigo-600">{group.orderId}</td>
                              <td className="px-6 py-6 text-slate-400 font-bold text-xs">{formatSGT(group.timestamp)}</td>
                              <td className="px-6 py-6 font-black text-slate-900 text-xs">{group.buyerName}</td>
                              <td className="px-6 py-6 text-center font-bold text-slate-700">{group.distinctItems}</td>
                              <td className="px-6 py-6 text-right font-black text-emerald-600 tracking-tight">${group.totalCost.toFixed(2)}</td>
                              <td className="px-6 py-6 text-center">
                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border ${
                                  group.overallStatus === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {group.overallStatus}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={7} className="px-12 py-8 border-b border-indigo-100/30">
                                  <table className="w-full text-[11px]">
                                    <thead className="text-slate-400 uppercase font-bold border-b border-slate-100">
                                      <tr><th className="text-left py-3">Item</th><th className="text-center py-3">Qty</th><th className="text-center py-3">Outcome</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100/50">
                                      {group.lines.map((line, idx) => (
                                        <tr key={idx} className="text-slate-600">
                                          <td className="py-4 font-black text-slate-800">{line.itemName} <span className="text-indigo-400 font-mono text-[9px] ml-1">#{line.mnemonic}</span></td>
                                          <td className="py-4 text-center font-black">{line.quantity}</td>
                                          <td className="py-4 text-center"><span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${line.status === 'confirmed' ? 'text-emerald-500 border-emerald-100' : 'text-amber-500 border-amber-100'}`}>{line.status}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
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
          </div>
        )}

        {activeTab === 'viz' && (
          <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
            <h3 className="font-black text-slate-900 mb-10 uppercase tracking-widest text-xs">Demand vs Priority Visualization</h3>
            <OrderVisualizer items={items} orders={orders} />
          </div>
        )}

        {activeTab === 'add' && (
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm animate-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto">
            <h3 className="font-black text-slate-900 mb-8 uppercase tracking-[0.25em] text-sm">Inventory Entry Center</h3>
            <InventoryInput onAdd={(item) => {
                const newItem = { ...item, id: Date.now().toString(), order: items.length, allowUpsell: false } as Item;
                setItems([...items, newItem]);
                setActiveTab('inventory');
              }} onBulkAdd={(newItems) => {
                const mapped = newItems.map((ni, idx) => ({ ...ni, id: `bulk-${Date.now()}-${idx}`, mnemonic: ni.mnemonic || (ni.name || 'ITEM').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4) + Math.floor(Math.random() * 90 + 10), order: items.length + idx, allowUpsell: false })) as Item[];
                setItems([...items, ...mapped]);
                setActiveTab('inventory');
              }} />
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 mt-4">
              <h3 className="font-black flex items-center gap-4 text-sm uppercase tracking-[0.25em]"><span className={`p-2 rounded-xl transition-colors ${!webhookUrl ? 'bg-amber-500 text-white' : 'bg-white/10 text-indigo-400'}`}>{!webhookUrl ? <LockClosedIcon className="w-5 h-5" /> : <ShieldCheckIcon className="w-5 h-5" />}</span> {webhookUrl ? 'Cloud Connection Active' : 'Initialize Cloud Link'}</h3>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
              <div className="space-y-10">
                <div className={`${!hasVerifiedOnce ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-900 rounded-3xl p-2' : ''}`}>
                  <label className="text-[10px] text-slate-400 block mb-4 uppercase font-black tracking-[0.2em]">Google Sheet Script URL</label>
                  <div className="flex gap-3">
                    <input type="text" placeholder="https://script.google.com/macros/s/.../exec" value={webhookUrl} onChange={(e) => { onWebhookChange(e.target.value); setHasVerifiedOnce(false); }} className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 text-sm text-indigo-100 placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium backdrop-blur-sm" />
                    <button onClick={handleTestConnection} disabled={isTesting || !webhookUrl} className={`p-5 rounded-2xl transition-all min-w-[140px] flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest ${isTesting ? 'bg-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/40'}`}>{isTesting ? <WifiIcon className="w-5 h-5 animate-ping" /> : 'Verify & Sync'}</button>
                  </div>
                  
                  {syncDiagnostic && (
                    <div className={`mt-6 p-5 rounded-2xl border ${isFailedFetch ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
                       <div className="flex items-center gap-2 mb-2">
                          <InformationCircleIcon className={`w-4 h-4 ${isFailedFetch ? 'text-rose-400' : 'text-indigo-400'}`} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Hub Report</p>
                       </div>
                       <p className={`text-[11px] font-bold ${isFailedFetch ? 'text-rose-200' : 'text-slate-200'}`}>{syncDiagnostic}</p>
                       
                       {isFailedFetch && (
                         <div className="mt-4 pt-4 border-t border-rose-500/20 space-y-3">
                            <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest flex items-center gap-2">
                               <QuestionMarkCircleIcon className="w-3.5 h-3.5" /> Troubleshooting "Failed to Fetch"
                            </p>
                            <ul className="text-[10px] text-rose-100/60 font-bold space-y-1.5 list-disc pl-4">
                               <li>Ensure you chose <strong>"Anyone"</strong> under "Who has access" in Google Apps Script deployment.</li>
                               <li>You must click <strong>"Authorize Access"</strong> in the Google Script editor at least once.</li>
                               <li>Ensure the URL ends in <strong>/exec</strong> and not /edit.</li>
                               <li>Check if your sheets are named exactly <strong>"Inventory"</strong> and <strong>"Orders"</strong>.</li>
                            </ul>
                         </div>
                       )}
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 mt-4 uppercase font-bold tracking-widest leading-relaxed">Verifying refreshes local cache with cloud data.</p>
                </div>
              </div>
              <div className="space-y-12">
                <div className="bg-slate-800/20 p-8 rounded-[2rem] border border-slate-700/30">
                  <div className="flex justify-between items-center mb-6"><label className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Waitlist Threshold</label><span className="bg-indigo-500/10 text-indigo-400 px-5 py-2 rounded-full text-[10px] font-black border border-indigo-500/30">{waitlistConfig.maxSize} SLOTS</span></div>
                  <input type="range" min="0" max="100" value={waitlistConfig.maxSize} onChange={(e) => setWaitlistConfig({ maxSize: parseInt(e.target.value) })} className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer" />
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
