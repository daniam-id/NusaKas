import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { StatMetric } from '../types';

interface StatsCardProps {
  stat: StatMetric;
}

const iconMap = {
  Wallet: Wallet,
  TrendingUp: TrendingUp,
  TrendingDown: TrendingDown,
  Activity: Activity,
};

export const StatsCard: React.FC<StatsCardProps> = ({ stat }) => {
  const Icon = iconMap[stat.iconName];
  const isPositive = stat.trend === 'up';

  return (
    // Card Surface: #FFFFFF (Pure White) on top of the grey page background
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md">
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{stat.label}</p>
          <h3 className="mt-2 font-display text-3xl font-bold tracking-tight text-gray-900">
            {stat.value}
          </h3>
        </div>
        <div className={`rounded-lg p-3 ${
            stat.iconName === 'TrendingUp' ? 'bg-emerald-50 text-emerald-700' : 
            stat.iconName === 'TrendingDown' ? 'bg-red-50 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`flex items-center gap-0.5 text-sm font-semibold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
          {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {stat.change}
        </span>
        <span className="text-sm text-gray-400">vs bulan lalu</span>
      </div>
    </div>
  );
};