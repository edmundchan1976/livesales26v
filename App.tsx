
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Item, Order, ViewMode, WaitlistConfig } from './types';
import SellerDashboard from './components/SellerDashboard';
import BuyerPortal from './components/BuyerPortal';

const STORAGE_KEY_ITEMS = 'mnemonic_hub_items';
const STORAGE_KEY_ORDERS = 'mnemonic_hub_orders';
const STORAGE_KEY_WAITLIST = 'mnemonic_hub_waitlist_config';
const STORAGE_KEY_WEBHOOK = 'mnemonic_hub_webhook_url';

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waitlistConfig, setWaitlistConfig] = useState<WaitlistConfig>({ maxSize: 5 });
  const [webhookUrl, setWebhookUrl] = useState<string>(localStorage.getItem(STORAGE_KEY_WEBHOOK) || '');
  const [view, setView] = useState('seller');
  const [activeMnemonic, setActiveMnemonic] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [syncDiagnostic, setSyncDiagnostic] = useState<string>('');
  const hasAttemptedInitialSync = useRef(false);

  const clearMemoryAndCache = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_ORDERS);
    setItems([]);
    setOrders([]);
    setLastSync(null);
    setSyncDiagnostic('Memory Purged. Waiting for fresh Cloud Link...');
  }, []);

  useEffect(() => {
    const savedItems = localStorage.getItem(STORAGE_KEY_ITEMS);
    const savedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
    const savedWaitlist = localStorage.getItem(STORAGE_KEY_WAITLIST);

    if (savedItems) setItems(JSON.parse(savedItems));
    if (savedOrders) setOrders(JSON.parse(savedOrders));
    if (savedWaitlist) setWaitlistConfig(JSON.parse(savedWaitlist));
  }, []);

  const isTruthy = (val: any) => {
    if (typeof val === 'boolean') return val;
    if (val === null || val === undefined) return false;
    const s = String(val).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'checked';
  };

  const fetchInventoryFromSheets = useCallback(async (targetUrl?: string) => {
    const rawUrl = targetUrl || webhookUrl;
    const url = (rawUrl || '').trim(); // Sanitize URL
    
    if (!url || !url.startsWith('http')) {
      setSyncDiagnostic('Wait: Cloud Hub URL is missing or invalid.');
      return;
    }
    
    setIsLoadingItems(true);
    setSyncDiagnostic('Syncing with Google Engine...');
    
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 20000); // Increased timeout for slow scripts
      
      // Explicitly follow redirects for Google Apps Script
      const response = await fetch(url, { 
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      clearTimeout(id);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}: Connectivity limited.`);
      
      const data = await response.json();
      console.debug('Sync Payload:', data);
      
      let rawItems = [];
      let rawOrders = [];

      if (Array.isArray(data)) {
        rawItems = data;
      } else if (data && typeof data === 'object') {
        // Broad capture to handle inconsistent sheet names
        rawItems = data.Inventory || data.inventory || data.Items || data.items || data.Master_Inventory || data.MasterInventory || [];
        rawOrders = data.Orders || data.orders || data.Order_Log || data.OrderLog || [];
      }

      // Map Inventory
      const mappedItems: Item[] = (rawItems || []).map((it: any, idx: number) => ({
        id: it.id || it.mnemonic || it.Mnemonic || `item-${idx}`,
        category: it.Category || it.category || 'General',
        name: it.ItemName || it.itemName || it.Item_Name || it.name || 'Unknown Item',
        price: parseFloat(it.Price || it.price || 0),
        quantity: parseInt(
          it.AvailableBalance !== undefined ? it.AvailableBalance : 
          (it.quantity !== undefined ? it.quantity : 
          (it.Balance !== undefined ? it.Balance : 
          (it.Quantity !== undefined ? it.Quantity : 0)))
        ),
        mnemonic: (String(it.Mnemonic || it.mnemonic || '')).toUpperCase(),
        order: it.order !== undefined ? it.order : idx,
        allowUpsell: isTruthy(it.AllowUpsell || it.allowUpsell)
      })).filter(it => it.mnemonic);

      // Map Orders
      const mappedOrders: Order[] = (rawOrders || [])
        .filter((o: any) => o && (o.OrderID || o.orderId || o.Mnemonic || o.mnemonic || o.Buyer || o.buyerName))
        .map((o: any, idx: number) => {
          const orderId = String(o.OrderID || o.orderId || o.id || `CLD-${idx}`);
          const statusRaw = String(o.Status || o.AppStatus || o.appStatus || o.status || 'confirmed').toLowerCase();
          
          return {
            id: o.id || `${orderId}-${idx}`,
            orderId: orderId,
            itemId: o.itemId || '',
            itemName: o.ItemName || o.itemName || o.item_name || 'Item',
            mnemonic: (String(o.Mnemonic || o.mnemonic || 'N/A')).toUpperCase(),
            buyerName: o.Buyer || o.buyerName || 'Guest',
            buyerEmail: o.Email || o.email || '-',
            quantity: parseInt(o.Quantity || o.quantity || 0),
            address: o.Address || o.address || '-',
            timestamp: o.Timestamp || o.timestamp || new Date().toISOString(),
            status: statusRaw.includes('waitlist') ? 'waitlisted' : 'confirmed'
          };
        });
      
      setItems(mappedItems);
      setOrders(mappedOrders);
      
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(mappedItems));
      localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(mappedOrders));

      const timeStr = new Intl.DateTimeFormat('en-GB', { 
        timeZone: 'Asia/Singapore', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }).format(new Date());
      
      setLastSync(timeStr);
      setSyncDiagnostic(`Sync Verified: Found ${mappedItems.length} SKU(s) and ${mappedOrders.length} Order(s).`);
    } catch (e: any) {
      console.error("Critical Cloud Fetch Failure:", e);
      if (e.name === 'TypeError' || e.message === 'Failed to fetch') {
        setSyncDiagnostic('CONNECTION_BLOCKED: The browser blocked the Cloud Link. Ensure script is deployed as Web App for "Anyone".');
      } else {
        setSyncDiagnostic(`Error: ${e.message}`);
      }
    } finally {
      setIsLoadingItems(false);
      hasAttemptedInitialSync.current = true;
    }
  }, [webhookUrl]);

  useEffect(() => {
    const handleNavigation = async () => {
      const hash = window.location.hash;
      const urlParams = new URLSearchParams(window.location.search);
      const encodedWebhook = urlParams.get('w');
      let currentWebhook = webhookUrl;
      
      if (encodedWebhook) {
        try {
          const decoded = atob(decodeURIComponent(encodedWebhook).replace(/\s/g, '+'));
          if (decoded.startsWith('http')) {
            currentWebhook = decoded;
            setWebhookUrl(decoded);
            localStorage.setItem(STORAGE_KEY_WEBHOOK, decoded);
          }
        } catch (e) {
          console.error("Webhook decode failed", e);
        }
      }

      if (hash.startsWith('#/order/')) {
        const mnemonic = hash.replace('#/order/', '').split('?')[0].toUpperCase();
        setActiveMnemonic(mnemonic);
        setView('buyer');
        if (currentWebhook) {
          fetchInventoryFromSheets(currentWebhook);
        }
      } else {
        setView('seller');
        setActiveMnemonic(null);
      }
    };

    window.addEventListener('hashchange', handleNavigation);
    handleNavigation();
    return () => window.removeEventListener('hashchange', handleNavigation);
  }, [webhookUrl, fetchInventoryFromSheets]);

  const saveAndSync = useCallback((newItems: Item[], newOrders: Order[]) => {
    setItems(newItems);
    setOrders(newOrders);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(newItems));
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(newOrders));
    
    const url = (webhookUrl || '').trim();
    if (url) {
      const push = async () => {
        try {
          const payload = {
            action: 'sync',
            Inventory: newItems.map(i => ({
              Category: i.category,
              ItemName: i.name,
              Price: i.price,
              InitialQuantity: i.quantity,
              Mnemonic: i.mnemonic,
              AllowUpsell: !!i.allowUpsell,
              order: i.order
            })),
            Orders: newOrders.map(o => ({
              OrderID: o.orderId,
              Timestamp: o.timestamp,
              Buyer: o.buyerName,
              Email: o.buyerEmail,
              ItemName: o.itemName,
              Mnemonic: o.mnemonic,
              Quantity: o.quantity,
              Address: o.address,
              AppStatus: o.status
            }))
          };
          await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          console.error("Failed to push sync", e);
        }
      };
      push();
    }
  }, [webhookUrl]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {view === 'seller' && (
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-100 shadow-lg">M</div>
            <h1 className="text-xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Mnemonic Hub</h1>
          </div>
          <div className="flex gap-4 items-center">
            {lastSync && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                <span className="text-[9px] font-black uppercase tracking-widest">LIVE CLOUD: {lastSync}</span>
              </div>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Control Panel
            </span>
          </div>
        </nav>
      )}

      <main className={`flex-1 ${view === 'buyer' ? 'w-full max-w-none p-0' : 'max-w-7xl mx-auto p-4 md:p-8 w-full'}`}>
        {view === 'seller' ? (
          <SellerDashboard 
            items={items} orders={orders} webhookUrl={webhookUrl}
            onWebhookChange={(url) => { setWebhookUrl(url); localStorage.setItem(STORAGE_KEY_WEBHOOK, url); }}
            setItems={(newItems) => saveAndSync(newItems, orders)}
            setOrders={(newOrders) => saveAndSync(items, newOrders)}
            waitlistConfig={waitlistConfig}
            setWaitlistConfig={(c) => { setWaitlistConfig(c); localStorage.setItem(STORAGE_KEY_WAITLIST, JSON.stringify(c)); }}
            onManualSync={async () => { await fetchInventoryFromSheets(); }}
            onTestSync={async () => { await fetchInventoryFromSheets(); }}
            onResetCache={clearMemoryAndCache}
            syncDiagnostic={syncDiagnostic}
          />
        ) : (
          <BuyerPortal 
            mnemonic={activeMnemonic || ''} items={items} orders={orders}
            waitlistConfig={waitlistConfig} onOrderPlaced={saveAndSync}
            isLoadingInventory={isLoadingItems || !hasAttemptedInitialSync.current}
          />
        )}
      </main>
    </div>
  );
};

export default App;
