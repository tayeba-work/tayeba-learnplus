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
  const { orders, dailyTarget, monthlyTarget: configuredMonthlyTarget } = useDb();

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

  // Performance ratios
  const successRate = useMemo(() => {
    if (totalOrders === 0) return 0;
    return Math.round((successfulOrders / totalOrders) * 100);
  }, [successfulOrders, totalOrders]);

  const cancelRate = useMemo(() => {
    if (totalOrders === 0) return 0;
    return Math.round((unsuccessfulOrders / totalOrders) * 100);
  }, [unsuccessfulOrders, totalOrders]);

  // Monthly Sales Target vs Achievement
  const monthlyAchievement = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const monthOrders = orders.filter(o => o.date >= monthStart && o.date <= monthEnd);
    const monthTotal = monthOrders.length;
    const monthSuccessful = monthOrders.filter(o => ['confirmed', 'shipped', 'delivered'].includes(o.status)).length;
    const monthCancelled = monthOrders.filter(o => ['cancelled', 'returned'].includes(o.status)).length;
    const monthPending = monthOrders.filter(o => o.status === 'pending').length;

    // Monthly target = custom configured target or fallback (dailyTarget × total days)
    const monthlyTarget = configuredMonthlyTarget || (dailyTarget * daysInMonth);
    // Projected target up to today based on configured monthly target
    const projectedTarget = Math.round((monthlyTarget / daysInMonth) * dayOfMonth);
    const achievementPct = monthlyTarget > 0 ? Math.min(Math.round((monthTotal / monthlyTarget) * 100), 150) : 0;
    const projectedPct = projectedTarget > 0 ? Math.min(Math.round((monthTotal / projectedTarget) * 100), 150) : 0;

    // Week-by-week breakdown inside the month
    const weeks = [];
    for (let w = 0; w < 5; w++) {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7);
      if (weekStart.getDate() > daysInMonth || weekStart.getMonth() !== now.getMonth()) break;
      const weekEndDay = Math.min(7 + w * 7, daysInMonth);
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), weekEndDay);
      const ws = weekStart.toISOString().split('T')[0];
      const we = weekEnd.toISOString().split('T')[0];
      const wOrders = monthOrders.filter(o => o.date >= ws && o.date <= we);
      const wDays = Math.min(7, daysInMonth - w * 7);
      const wTarget = Math.round((monthlyTarget / daysInMonth) * wDays);
      const isPast = weekEnd < now;
      weeks.push({
        label: `Week ${w + 1}`,
        dateRange: `${weekStart.getDate()}–${weekEndDay}`,
        total: wOrders.length,
        target: wTarget,
        pct: wTarget > 0 ? Math.min(Math.round((wOrders.length / wTarget) * 100), 100) : 0,
        isPast
      });
    }

    const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return { monthTotal, monthSuccessful, monthCancelled, monthPending, monthlyTarget, projectedTarget, achievementPct, projectedPct, daysInMonth, dayOfMonth, weeks, monthName };
  }, [orders, dailyTarget, configuredMonthlyTarget]);

  // Hourly shift distribution
  const shiftData = useMemo(() => {
    const shifts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    dateFilteredOrders.forEach(order => {
      const dateObj = new Date(order.lastUpdated || Date.now());
      let hour = dateObj.getHours();

      if (order.notes && order.notes.includes('Bulk imported')) {
        const hashVal = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        hour = (hashVal % 15) + 8; // Distribute between 8 AM and 11 PM
      }

      if (hour >= 6 && hour < 12) shifts.morning++;
      else if (hour >= 12 && hour < 17) shifts.afternoon++;
      else if (hour >= 17 && hour < 21) shifts.evening++;
      else shifts.night++;
    });

    return [
      { label: '🌅 Morning (6AM - 12PM)', count: shifts.morning, color: 'var(--status-confirmed)' },
      { label: '☀️ Afternoon (12PM - 5PM)', count: shifts.afternoon, color: 'hsl(var(--primary-glow))' },
      { label: '🌇 Evening (5PM - 9PM)', count: shifts.evening, color: 'var(--status-pending)' },
      { label: '🌙 Night (9PM - 6AM)', count: shifts.night, color: '#94a3b8' }
    ];
  }, [dateFilteredOrders]);

  // Daily trend: last 7 days order volume (always from ALL orders, not filtered)
  const dailyTrend = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = orders.filter(o => o.date === dateStr);
      const successful = dayOrders.filter(o => ['confirmed', 'shipped', 'delivered'].includes(o.status)).length;
      const cancelled = dayOrders.filter(o => ['cancelled', 'returned'].includes(o.status)).length;
      const pending = dayOrders.filter(o => o.status === 'pending').length;
      result.push({
        date: dateStr,
        label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        total: dayOrders.length,
        successful,
        cancelled,
        pending
      });
    }
    return result;
  }, [orders]);

  const maxDailyCount = useMemo(() => Math.max(...dailyTrend.map(d => d.total), 1), [dailyTrend]);

  // Speedometer: status breakdown as gauge-ready values
  const statusGauges = useMemo(() => {
    const total = dateFilteredOrders.length || 1;
    return [
      { label: 'Confirmed', count: cardCounts.confirmed, pct: Math.round((cardCounts.confirmed / total) * 100), color: 'var(--status-confirmed)', emoji: '✅' },
      { label: 'Delivered', count: cardCounts.delivered, pct: Math.round((cardCounts.delivered / total) * 100), color: '#06b6d4', emoji: '📦' },
      { label: 'Shipped', count: cardCounts.shipped, pct: Math.round((cardCounts.shipped / total) * 100), color: 'var(--status-shipped)', emoji: '🚚' },
      { label: 'Pending', count: cardCounts.pending, pct: Math.round((cardCounts.pending / total) * 100), color: 'var(--status-pending)', emoji: '⏳' },
      { label: 'Cancelled', count: cardCounts.cancelled, pct: Math.round((cardCounts.cancelled / total) * 100), color: 'var(--status-cancelled)', emoji: '❌' },
      { label: 'Returned', count: cardCounts.returned, pct: Math.round((cardCounts.returned / total) * 100), color: 'var(--status-returned)', emoji: '↩️' },
    ];
  }, [dateFilteredOrders, cardCounts]);

  // Weekly momentum: compare this week vs last week
  const weeklyMomentum = useMemo(() => {
    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const thisWeek = orders.filter(o => new Date(o.date) >= startOfThisWeek).length;
    const lastWeek = orders.filter(o => {
      const d = new Date(o.date);
      return d >= startOfLastWeek && d < startOfThisWeek;
    }).length;

    const diff = thisWeek - lastWeek;
    const pct = lastWeek > 0 ? Math.round(Math.abs(diff / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);
    return { thisWeek, lastWeek, diff, pct, up: diff >= 0 };
  }, [orders]);

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

      {/* Dynamic Analytics & Reporting Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
        
        {/* Row 1: Conversion Rate & Shifts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Conversion Rate Card */}
          <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 className="stat-title" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              📊 Performance Conversion Rates
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
              {/* Success rate ring */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="30" cy="30" r="24" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <circle cx="30" cy="30" r="24" fill="transparent" stroke="var(--status-confirmed)" strokeWidth="4" 
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={(2 * Math.PI * 24) - (successRate / 100) * (2 * Math.PI * 24)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ position: 'absolute', fontSize: '11px', fontWeight: 800, color: 'white' }}>{successRate}%</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--status-confirmed)' }}>Success Rate</span>
              </div>

              {/* Cancel rate ring */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="30" cy="30" r="24" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <circle cx="30" cy="30" r="24" fill="transparent" stroke="var(--status-cancelled)" strokeWidth="4" 
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={(2 * Math.PI * 24) - (cancelRate / 100) * (2 * Math.PI * 24)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ position: 'absolute', fontSize: '11px', fontWeight: 800, color: 'white' }}>{cancelRate}%</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--status-cancelled)' }}>Cancel Rate</span>
              </div>
            </div>
          </div>

          {/* Shift hourly productivity card */}
          <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 className="stat-title" style={{ fontSize: '13px', margin: 0 }}>
              ⏰ Shift Activity Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              {shiftData.map((shift, idx) => {
                const percentage = totalOrders > 0 ? (shift.count / totalOrders) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-gray-light)', fontWeight: 600, width: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.label}</span>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', margin: '0 10px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: shift.color, borderRadius: '3px', boxShadow: `0 0 4px ${shift.color}` }} />
                    </div>
                    <span style={{ color: 'white', fontWeight: 700, width: '25px', textAlign: 'right' }}>{shift.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Sales Target vs Achievement */}
        <div className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 className="stat-title" style={{ fontSize: '13px', margin: 0 }}>🎯 {monthlyAchievement.monthName} — Target vs Achievement</h3>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Day {monthlyAchievement.dayOfMonth}/{monthlyAchievement.daysInMonth}</span>
          </div>

          {/* Big achievement numbers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{monthlyAchievement.monthTotal}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '3px', textTransform: 'uppercase' }}>Orders Logged</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-muted)', lineHeight: 1 }}>{monthlyAchievement.monthlyTarget}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '3px', textTransform: 'uppercase' }}>Month Target</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1, color: monthlyAchievement.achievementPct >= 100 ? 'var(--status-confirmed)' : monthlyAchievement.achievementPct >= 60 ? 'var(--status-pending)' : 'var(--status-cancelled)' }}>
                {monthlyAchievement.achievementPct}%
              </div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '3px', textTransform: 'uppercase' }}>Month Fill</div>
            </div>
          </div>

          {/* Projected pace bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginBottom: '5px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Progress vs Projected Pace</span>
              <span style={{ color: monthlyAchievement.projectedPct >= 100 ? 'var(--status-confirmed)' : 'var(--status-pending)' }}>{monthlyAchievement.projectedPct}% of {monthlyAchievement.projectedTarget} target</span>
            </div>
            <div style={{ height: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
              {/* Target marker at 100% */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, (monthlyAchievement.projectedTarget / monthlyAchievement.monthlyTarget) * 100)}%`, width: '2px', background: 'rgba(255,255,255,0.2)', zIndex: 2 }} />
              <div style={{ height: '100%', width: `${Math.min(monthlyAchievement.achievementPct, 100)}%`, background: monthlyAchievement.achievementPct >= 100 ? 'linear-gradient(90deg, var(--status-confirmed), #06b6d4)' : monthlyAchievement.achievementPct >= 60 ? 'linear-gradient(90deg, var(--status-pending), hsl(var(--primary-glow)))' : 'linear-gradient(90deg, var(--status-cancelled), var(--status-pending))', borderRadius: '5px', transition: 'width 0.6s ease', boxShadow: '0 0 8px rgba(255,255,255,0.1)' }} />
            </div>
          </div>

          {/* Week-by-week grid */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '7px' }}>Weekly Breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${monthlyAchievement.weeks.length}, 1fr)`, gap: '6px' }}>
              {monthlyAchievement.weeks.map((week, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-muted)' }}>{week.label}</div>
                  <div style={{ fontSize: '7px', color: 'var(--text-muted)', opacity: 0.6 }}>{week.dateRange}</div>
                  {/* Mini vertical bar */}
                  <div style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${week.pct}%`, minHeight: week.total > 0 ? '4px' : '0', background: week.pct >= 100 ? 'var(--status-confirmed)' : week.pct >= 60 ? 'hsl(var(--primary-glow))' : week.pct > 0 ? 'var(--status-pending)' : 'transparent', borderRadius: '4px', transition: 'height 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: week.pct >= 100 ? 'var(--status-confirmed)' : 'white' }}>{week.total}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>/{week.target}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly sub-KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--status-confirmed)' }}>{monthlyAchievement.monthSuccessful}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Successful</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--status-pending)' }}>{monthlyAchievement.monthPending}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Pending</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--status-cancelled)' }}>{monthlyAchievement.monthCancelled}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>Cancelled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Momentum Banner */}
      <div className="glass-card animate-slide-up" style={{
        padding: '14px 16px',
        marginTop: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderLeft: `4px solid ${weeklyMomentum.up ? 'var(--status-confirmed)' : 'var(--status-cancelled)'}`,
        background: weeklyMomentum.up
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(11,15,25,0.7))'
          : 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(11,15,25,0.7))'
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Weekly Momentum
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: 'white', marginTop: '2px' }}>
            {weeklyMomentum.up ? '▲' : '▼'} {weeklyMomentum.pct}%
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px' }}>
              vs last week
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
            This Week
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: weeklyMomentum.up ? 'var(--status-confirmed)' : 'var(--status-cancelled)' }}>
            {weeklyMomentum.thisWeek}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Last week: {weeklyMomentum.lastWeek}
          </div>
        </div>
      </div>

      {/* 7-Day Trend Bar Chart */}
      <div className="glass-card animate-slide-up" style={{ padding: '14px', marginTop: '12px' }}>
        <h3 className="stat-title" style={{ fontSize: '13px', margin: '0 0 12px 0' }}>
          📈 Last 7 Days — Daily Volume Trend
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
          {dailyTrend.map((day, idx) => {
            const heightPct = maxDailyCount > 0 ? (day.total / maxDailyCount) * 100 : 0;
            const isToday = day.date === todayStr;
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: isToday ? 'hsl(var(--primary-glow))' : 'white' }}>
                  {day.total || ''}
                </div>
                <div style={{ position: 'relative', width: '100%', height: `${Math.max(heightPct, 4)}%`, minHeight: '4px' }}>
                  {/* Stacked bar: successful (bottom), pending (mid), cancelled (top) */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', borderRadius: '3px 3px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                    <div style={{ flex: day.successful, background: 'var(--status-confirmed)', transition: 'flex 0.4s ease' }} />
                    <div style={{ flex: day.pending, background: 'var(--status-pending)', transition: 'flex 0.4s ease' }} />
                    <div style={{ flex: day.cancelled, background: 'var(--status-cancelled)', transition: 'flex 0.4s ease' }} />
                  </div>
                  {isToday && (
                    <div style={{ position: 'absolute', top: '-4px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'hsl(var(--primary-glow))', boxShadow: '0 0 6px hsl(var(--primary-glow))' }} />
                  )}
                </div>
                <div style={{ fontSize: '8px', fontWeight: 600, color: isToday ? 'hsl(var(--primary-glow))' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {day.label}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', justifyContent: 'center' }}>
          {[
            { label: 'Successful', color: 'var(--status-confirmed)' },
            { label: 'Pending', color: 'var(--status-pending)' },
            { label: 'Cancelled', color: 'var(--status-cancelled)' }
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Status Speedometer Grid */}
      <div className="glass-card animate-slide-up" style={{ padding: '14px', marginTop: '12px' }}>
        <h3 className="stat-title" style={{ fontSize: '13px', margin: '0 0 14px 0' }}>🎛️ Status Speedometers — Order Distribution</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {statusGauges.map((gauge, idx) => {
            // Speedometer: semi-circle from -180deg to 0deg (left to right)
            // needle angle: -180 at 0%, 0 at 100%
            const R = 28;
            const cx = 36, cy = 36;
            const startAngle = Math.PI; // left
            const endAngle = 0;         // right
            // arc path helper
            const arcPath = (r, start, end) => {
              const x1 = cx + r * Math.cos(start);
              const y1 = cy + r * Math.sin(start);
              const x2 = cx + r * Math.cos(end);
              const y2 = cy + r * Math.sin(end);
              return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
            };
            // Filled arc 0% to pct%
            const filledEnd = Math.PI - (gauge.pct / 100) * Math.PI;
            const filledEndX = cx + R * Math.cos(filledEnd);
            const filledEndY = cy + R * Math.sin(filledEnd);
            const filledStartX = cx + R * Math.cos(Math.PI);
            const filledStartY = cy + R * Math.sin(Math.PI);
            const largeArc = gauge.pct > 50 ? 1 : 0;
            // Needle
            const needleAngle = Math.PI - (gauge.pct / 100) * Math.PI;
            const needleLen = 20;
            const nx = cx + needleLen * Math.cos(needleAngle);
            const ny = cy + needleLen * Math.sin(needleAngle);
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <div style={{ position: 'relative', width: '72px', height: '42px', overflow: 'visible' }}>
                  <svg width="72" height="44" viewBox="0 0 72 44">
                    {/* Track arc */}
                    <path
                      d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
                      fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round"
                    />
                    {/* Colored fill arc */}
                    {gauge.pct > 0 && (
                      <path
                        d={`M ${filledStartX} ${filledStartY} A ${R} ${R} 0 ${largeArc} 1 ${filledEndX} ${filledEndY}`}
                        fill="none" stroke={gauge.color} strokeWidth="5" strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 3px ${gauge.color})` }}
                      />
                    )}
                    {/* Needle */}
                    <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                    {/* Center dot */}
                    <circle cx={cx} cy={cy} r="3" fill="white" opacity="0.9" />
                    {/* % label */}
                    <text x={cx} y={cy - 6} textAnchor="middle" fontSize="8" fontWeight="800" fill="white" opacity="0.9">
                      {gauge.pct}%
                    </text>
                  </svg>
                </div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: gauge.color, textAlign: 'center', lineHeight: 1.2 }}>
                  {gauge.emoji} {gauge.label}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: 'white' }}>{gauge.count}</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
