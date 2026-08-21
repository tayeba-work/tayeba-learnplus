import React, { useState, useMemo } from 'react';
import { useDb } from '../context/DbContext';
import { 
  TrendingUp, 
  ShoppingBag, 
  CheckCircle, 
  XCircle, 
  AlertCircle
} from 'lucide-react';

const Dashboard = () => {
  const { orders, dailyTarget } = useDb();

  const [dateFilter, setDateFilter] = useState('all'); // today, yesterday, last7, thisMonth, all, custom
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, confirmed, shipped, delivered, cancelled, returned
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get date strings
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  // 1. FILTER ORDERS BY DATE RANGE FIRST
  const dateFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (dateFilter === 'today') return order.date === todayStr;
      if (dateFilter === 'yesterday') return order.date === yesterdayStr;
      if (dateFilter === 'last7') {
        const oDate = new Date(order.date);
        const limit = new Date();
        limit.setDate(limit.getDate() - 7);
        return oDate >= limit;
      }
      if (dateFilter === 'thisMonth') {
        const oDate = new Date(order.date);
        const now = new Date();
        return oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        if (!customStartDate) return true;
        return order.date >= customStartDate && order.date <= (customEndDate || todayStr);
      }
      return true; // all
    });
  }, [orders, dateFilter, customStartDate, customEndDate, todayStr, yesterdayStr]);

  // 2. DYNAMIC STATUS COUNTS WITHIN THE SELECTED DATE RANGE (For status dropdown and chart)
  const statusCounts = useMemo(() => {
    const totals = { all: dateFilteredOrders.length, pending: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0 };
    dateFilteredOrders.forEach(o => {
      if (totals[o.status] !== undefined) {
        totals[o.status]++;
      }
    });
    return totals;
  }, [dateFilteredOrders]);

  // 3. APPLY STATUS FILTER FOR KPI CARDS
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return dateFilteredOrders;
    return dateFilteredOrders.filter(o => o.status === statusFilter);
  }, [dateFilteredOrders, statusFilter]);

  // 4. METRICS CALCULATIONS FOR THE 4 KPI CARDS (Calculated based on date range for complete visibility)
  const totalOrders = dateFilteredOrders.length;
  
  const cardCounts = useMemo(() => {
    const totals = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0 };
    dateFilteredOrders.forEach(o => {
      if (totals[o.status] !== undefined) {
        totals[o.status]++;
      }
    });
    return totals;
  }, [dateFilteredOrders]);

  const successfulOrders = cardCounts.delivered + cardCounts.shipped + cardCounts.confirmed;
  const unsuccessfulOrders = cardCounts.cancelled + cardCounts.returned;

  // Today's total logged count for Target Gauge (fixed to today's volume)
  const todayLoggedCount = useMemo(() => {
    return orders.filter(order => order.date === todayStr).length;
  }, [orders, todayStr]);

  // Target Progress Ring Calculation
  const progressPercent = Math.min(Math.round((todayLoggedCount / dailyTarget) * 100), 100);
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Encouragement messages
  const getEncouragement = () => {
    if (todayLoggedCount === 0) return "Start calling to log your first order!";
    if (todayLoggedCount < dailyTarget / 2) return "Great start, keep dialing!";
    if (todayLoggedCount < dailyTarget) return "You're more than halfway there!";
    return "Daily target achieved! Super job! 🎉";
  };

  return (
    <div className="app-content animate-fade-in">
      <h2 className="section-title">
        <TrendingUp size={20} className="text-gradient" />
        Dashboard Overview
      </h2>

      {/* Date & Status Filters (Single Line, Screen Fit Dropdowns - Exactly like Orders List) */}
      <div className="glass-card filter-bar-compact" style={{ display: 'flex', gap: '8px', padding: '8px 10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="compact-filter-select"
            title="Date Filter"
          >
            <option value="all">📅 All Time Overview</option>
            <option value="today">📅 Today's Overview</option>
            <option value="yesterday">📅 Yesterday's Overview</option>
            <option value="last7">📅 Last 7 Days Overview</option>
            <option value="thisMonth">📅 This Month's Overview</option>
            <option value="custom">📅 Custom Range Overview</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '120px' }}>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="compact-filter-select"
            title="Status Filter"
            style={{
              borderColor: statusFilter !== 'all' ? `var(--status-${statusFilter})` : 'var(--border-light)',
              color: statusFilter !== 'all' ? `var(--status-${statusFilter})` : 'white'
            }}
          >
            <option value="all" style={{ color: 'white' }}>🚦 All Statuses ({statusCounts.all})</option>
            <option value="pending" style={{ color: 'var(--status-pending)' }}>🚦 Pending ({statusCounts.pending})</option>
            <option value="confirmed" style={{ color: 'var(--status-confirmed)' }}>🚦 Confirmed ({statusCounts.confirmed})</option>
            <option value="shipped" style={{ color: 'var(--status-shipped)' }}>🚦 Shipped ({statusCounts.shipped})</option>
            <option value="delivered" style={{ color: 'var(--status-delivered)' }}>🚦 Delivered ({statusCounts.delivered})</option>
            <option value="returned" style={{ color: 'var(--status-returned)' }}>🚦 Returned ({statusCounts.returned})</option>
            <option value="cancelled" style={{ color: 'var(--status-cancelled)' }}>🚦 Cancelled ({statusCounts.cancelled})</option>
          </select>
        </div>

        {/* Custom Date Inputs inline just below if 'custom' is active */}
        {dateFilter === 'custom' && (
          <div className="custom-date-grid animate-slide-up" style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '6px' }}>
            <div className="field-group" style={{ flex: 1, margin: 0 }}>
              <input
                type="date"
                className="input-field"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Start"
              />
            </div>
            <div className="field-group" style={{ flex: 1, margin: 0 }}>
              <input
                type="date"
                className="input-field"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="End"
              />
            </div>
          </div>
        )}
      </div>

      {/* Target Gauge (Shows Fixed Daily Progress) */}
      <div className="glass-card target-card" style={{ marginBottom: '12px' }}>
        <div className="target-info">
          <span className="stat-sub" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Today's Target
          </span>
          <h3 style={{ fontSize: '20px', fontWeight: 800 }}>
            {todayLoggedCount} / <span style={{ color: 'var(--text-gray-dark)' }}>{dailyTarget} Orders</span>
          </h3>
          <p className="stat-sub" style={{ marginTop: '4px', fontStyle: 'italic' }}>
            {getEncouragement()}
          </p>
        </div>
        <div className="target-circle-container">
          <svg className="target-circle" width="80" height="80">
            <defs>
              <linearGradient id="targetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary-glow))" />
                <stop offset="100%" stopColor="hsl(var(--secondary-glow))" />
              </linearGradient>
            </defs>
            <circle
              className="target-circle-bg"
              cx="40"
              cy="40"
              r={radius}
            />
            <circle
              className="target-circle-progress"
              cx="40"
              cy="40"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="target-percentage">{progressPercent}%</div>
        </div>
      </div>

      {/* Dynamic Metrics Grid (Reacts to Date & Status Filters) */}
      <div className="stats-grid" style={{ marginBottom: '12px' }}>
        {/* 1. Total Orders */}
        <div className="glass-card stat-card" style={{ borderLeft: '4px solid hsl(var(--primary-glow))' }}>
          <div className="stat-title">
            <ShoppingBag size={16} style={{ color: 'hsl(var(--primary-glow))' }} />
            Total Orders
          </div>
          <div className="stat-val">{totalOrders}</div>
          <div className="stat-sub">In selected period</div>
        </div>

        {/* 2. Pending Orders */}
        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--status-pending)' }}>
          <div className="stat-title">
            <AlertCircle size={16} style={{ color: 'var(--status-pending)' }} />
            Pending Action
          </div>
          <div className="stat-val" style={{ color: 'var(--status-pending)' }}>{cardCounts.pending}</div>
          <div className="stat-sub">Waiting for callbacks</div>
        </div>

        {/* 3. Successful Orders */}
        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--status-confirmed)' }}>
          <div className="stat-title">
            <CheckCircle size={16} style={{ color: 'var(--status-confirmed)' }} />
            Successful
          </div>
          <div className="stat-val" style={{ color: 'var(--status-confirmed)' }}>{successfulOrders}</div>
          <div className="stat-sub">Confirmed + Delivered</div>
        </div>

        {/* 4. Cancelled/Returned */}
        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--status-cancelled)' }}>
          <div className="stat-title">
            <XCircle size={16} style={{ color: 'var(--status-cancelled)' }} />
            Cancelled
          </div>
          <div className="stat-val" style={{ color: 'var(--status-cancelled)' }}>{unsuccessfulOrders}</div>
          <div className="stat-sub">Cancelled + Returned</div>
        </div>
      </div>

      {/* Status Distribution Chart (Reacts to Date Filter to show overall proportions) */}
      <div className="glass-card chart-container">
        <h3 className="stat-title" style={{ fontSize: '15px' }}>
          <TrendingUp size={16} style={{ marginRight: '4px' }} />
          Status Distribution Chart
        </h3>

        <div className="chart-bars">
          {[
            { label: 'Pending', count: statusCounts.pending, color: 'var(--status-pending)' },
            { label: 'Confirmed', count: statusCounts.confirmed, color: 'var(--status-confirmed)' },
            { label: 'Shipped', count: statusCounts.shipped, color: 'var(--status-shipped)' },
            { label: 'Delivered', count: statusCounts.delivered, color: 'var(--status-delivered)' },
            { label: 'Returned', count: statusCounts.returned, color: 'var(--status-returned)' },
            { label: 'Cancelled', count: statusCounts.cancelled, color: 'var(--status-cancelled)' },
          ].map((bar, idx) => {
            const percentage = dateFilteredOrders.length > 0 ? (bar.count / dateFilteredOrders.length) * 100 : 0;
            return (
              <div className="chart-bar-row" key={idx}>
                <span className="chart-bar-label">{bar.label}</span>
                <div className="chart-bar-track">
                  <div 
                    className="chart-bar-fill" 
                    style={{ 
                      width: `${percentage}%`, 
                      backgroundColor: bar.color,
                      boxShadow: `0 0 8px ${bar.color}`
                    }}
                  />
                </div>
                <span className="chart-bar-val">{bar.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
