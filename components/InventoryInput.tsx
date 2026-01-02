import React, { useState, useRef } from 'react';
import { Item } from '../types';
import { extractInventoryFromImage } from '../services/geminiService';
import { 
  DocumentTextIcon, 
  TableCellsIcon, 
  SparklesIcon, 
  ExclamationCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowRightCircleIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';

interface Props {
  onAdd: (item: Partial<Item>) => void;
  onBulkAdd: (items: Partial<Item>[]) => void;
}

interface StagedItem extends Partial<Item> {
  tempId: string;
}

const InventoryInput: React.FC<Props> = ({ onAdd, onBulkAdd }) => {
  const [mode, setMode] = useState<'manual' | 'csv' | 'ai'>('manual');
  const [formData, setFormData] = useState({ category: '', name: '', price: '', quantity: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Staging State
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Item>>({});

  const hasApiKey = !!process.env.API_KEY && process.env.API_KEY !== "undefined";

  const addToStaging = (items: Partial<Item>[]) => {
    const newItems = items.map(item => ({
      ...item,
      tempId: Math.random().toString(36).substring(7)
    }));
    setStagedItems(prev => [...prev, ...newItems]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToStaging([{
      category: formData.category,
      name: formData.name,
      price: parseFloat(formData.price),
      quantity: parseInt(formData.quantity),
    }]);
    setFormData({ category: '', name: '', price: '', quantity: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mode === 'csv') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = text.split('\n').slice(1); // Skip header
        const parsed = rows.filter(r => r.trim()).map(row => {
          const parts = row.split(',').map(s => s.trim());
          if (parts.length < 4) return null;
          return { category: parts[0], name: parts[1], price: parseFloat(parts[2]), quantity: parseInt(parts[3]) };
        }).filter(item => item !== null);
        addToStaging(parsed as Partial<Item>[]);
      };
      reader.readAsText(file);
    } else if (mode === 'ai') {
      setIsProcessing(true);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          try {
            const extracted = await extractInventoryFromImage(base64, file.type);
            if (extracted && extracted.length > 0) {
              addToStaging(extracted);
            } else {
              alert("Could not extract any items. Please ensure the document is clear.");
            }
          } catch (err: any) {
            if (err.message === "MISSING_API_KEY") {
              alert("CRITICAL: Gemini API Key is missing.");
            } else {
              alert("AI Processing failed: " + err.message);
            }
          } finally {
            setIsProcessing(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error(err);
        setIsProcessing(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEditing = (item: StagedItem) => {
    setEditingId(item.tempId);
    setEditFormData({ ...item });
  };

  const saveEdit = () => {
    setStagedItems(prev => prev.map(item => 
      item.tempId === editingId ? { ...item, ...editFormData } : item
    ));
    setEditingId(null);
  };

  const removeStagedItem = (id: string) => {
    setStagedItems(prev => prev.filter(item => item.tempId !== id));
  };

  const commitToDatabase = () => {
    if (stagedItems.length === 0) return;
    onBulkAdd(stagedItems.map(({ tempId, ...rest }) => rest));
    setStagedItems([]);
  };

  return (
    <div className="space-y-6">
      {/* Input Mode Selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
        {[
          { id: 'manual', label: 'Manual', icon: DocumentTextIcon },
          { id: 'csv', label: 'CSV Bulk', icon: TableCellsIcon },
          { id: 'ai', label: 'AI Extract', icon: SparklesIcon }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === m.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* API Key Warning */}
      {mode === 'ai' && !hasApiKey && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex gap-4">
            <ExclamationCircleIcon className="w-6 h-6 text-rose-500 shrink-0" />
            <div>
              <p className="text-sm font-black text-rose-700 uppercase tracking-tight">Gemini API Key Missing</p>
              <p className="text-xs text-rose-600/80 mt-1">Setup required in System Settings to use AI.</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Forms/Uploaders */}
      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
        {mode === 'manual' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Item Name</label>
                <input 
                  placeholder="e.g. Wagyu Beef" 
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                <input 
                  placeholder="e.g. Meat" 
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Price ($)</label>
                <input 
                  type="number" step="0.01"
                  placeholder="0.00" 
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Qty</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
            >
              <PlusCircleIcon className="w-4 h-4" /> Add to Review Batch
            </button>
          </form>
        )}

        {(mode === 'csv' || mode === 'ai') && (
          <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 space-y-4 transition-colors group ${(!hasApiKey && mode === 'ai') ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-400'}`}>
            <div className={`p-4 rounded-2xl transition-all group-hover:scale-110 ${mode === 'ai' ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {mode === 'ai' ? <SparklesIcon className="w-8 h-8" /> : <TableCellsIcon className="w-8 h-8" />}
            </div>
            <div className="text-center">
              <p className="font-black text-slate-900 text-sm uppercase tracking-tight">
                {isProcessing ? 'AI Analyzing...' : (!hasApiKey && mode === 'ai' ? 'AI Disabled' : `Select ${mode.toUpperCase()} File`)}
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">
                {mode === 'ai' ? 'Upload packing list images' : 'Upload CSV (Cat, Name, Price, Qty)'}
              </p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept={mode === 'csv' ? '.csv' : 'image/*,.pdf'}
              onChange={handleFileUpload}
              disabled={isProcessing || (!hasApiKey && mode === 'ai')}
            />
            <button 
              disabled={isProcessing || (!hasApiKey && mode === 'ai')}
              onClick={() => fileInputRef.current?.click()}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${isProcessing || (!hasApiKey && mode === 'ai') ? 'bg-slate-50 border-slate-100 text-slate-400' : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
            >
              {isProcessing ? 'Thinking...' : 'Browse Documents'}
            </button>
          </div>
        )}
      </div>

      {/* STAGING AREA / REVIEW BATCH */}
      {stagedItems.length > 0 && (
        <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-1 flex items-center gap-2">
                <ArrowRightCircleIcon className="w-4 h-4" />
                Review Batch Items ({stagedItems.length})
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Check your data before final commit</p>
            </div>
            <button 
              onClick={() => setStagedItems([])}
              className="text-[9px] font-black uppercase text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear All Drafts
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-indigo-50/50 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stagedItems.map(item => (
                  <tr key={item.tempId} className={`group hover:bg-indigo-50/20 transition-colors ${editingId === item.tempId ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      {editingId === item.tempId ? (
                        <input 
                          className="w-full p-2 border border-amber-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-400"
                          value={editFormData.name || ''}
                          onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{item.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.tempId ? (
                        <input 
                          className="w-full p-2 border border-amber-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-400"
                          value={editFormData.category || ''}
                          onChange={e => setEditFormData({...editFormData, category: e.target.value})}
                        />
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase">{item.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.tempId ? (
                        <input 
                          type="number"
                          className="w-full p-2 border border-amber-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-400"
                          value={editFormData.price || ''}
                          onChange={e => setEditFormData({...editFormData, price: parseFloat(e.target.value)})}
                        />
                      ) : (
                        <span className="font-black text-slate-800">${item.price?.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === item.tempId ? (
                        <input 
                          type="number"
                          className="w-full p-2 border border-amber-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-400"
                          value={editFormData.quantity || ''}
                          onChange={e => setEditFormData({...editFormData, quantity: parseInt(e.target.value)})}
                        />
                      ) : (
                        <span className="font-bold text-slate-600">{item.quantity} units</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.tempId ? (
                        <div className="flex justify-end gap-1">
                          <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><CheckIcon className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditing(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><PencilSquareIcon className="w-4 h-4" /></button>
                          <button onClick={() => removeStagedItem(item.tempId)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button 
            onClick={commitToDatabase}
            className="mt-6 w-full py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 animate-bounce"
          >
            <CheckIcon className="w-5 h-5" />
            Commit & Push to Live Database
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryInput;