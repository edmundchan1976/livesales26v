import React from 'react';
import { Item, Order } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Props {
  items: Item[];
  orders: Order[];
}

const OrderVisualizer: React.FC<Props> = ({ items, orders }) => {
  // Use mnemonics for reliable cross-joining between Orders and Items
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  
  const data = sortedItems.map(item => {
    const totalOrdered = orders
      .filter(o => o.mnemonic.toUpperCase() === item.mnemonic.toUpperCase())
      .reduce((acc, curr) => acc + curr.quantity, 0);
    
    return {
      name: item.name,
      mnemonic: item.mnemonic,
      ordered: totalOrdered,
      inventory: item.quantity,
      sequence: item.order + 1
    };
  });

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="mnemonic" 
            label={{ value: 'Item Mnemonic (by Selling Sequence)', position: 'bottom', offset: 40 }}
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
          />
          <YAxis 
             tick={{ fontSize: 12, fill: '#64748b' }}
             label={{ value: 'Total Qty Ordered', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' } }}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
            itemStyle={{ fontWeight: 900, fontSize: '12px' }}
          />
          <Bar dataKey="ordered" radius={[8, 8, 0, 0]} animationDuration={1000}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
          <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-2">High Demand Leader</p>
          <p className="text-2xl font-black text-slate-800">
            {data.length > 0 ? [...data].sort((a,b) => b.ordered - a.ordered)[0].mnemonic : 'N/A'}
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/50">
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Total Combined Demand</p>
          <p className="text-2xl font-black text-slate-800">
            {orders.reduce((acc, o) => acc + o.quantity, 0)} <span className="text-sm text-slate-400 font-bold ml-1 uppercase">units</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderVisualizer;