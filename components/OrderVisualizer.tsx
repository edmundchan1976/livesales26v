
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
  // Map items to their sequence order and calculate total quantities ordered
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  
  const data = sortedItems.map(item => {
    const totalOrdered = orders
      .filter(o => o.itemId === item.id)
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
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <YAxis 
             tick={{ fontSize: 12, fill: '#64748b' }}
             label={{ value: 'Total Qty Ordered', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="ordered" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Most Popular</p>
          <p className="text-lg font-bold text-slate-800">
            {data.length > 0 ? [...data].sort((a,b) => b.ordered - a.ordered)[0].mnemonic : 'N/A'}
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Demand</p>
          <p className="text-lg font-bold text-slate-800">
            {orders.reduce((acc, o) => acc + o.quantity, 0)} units
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderVisualizer;
