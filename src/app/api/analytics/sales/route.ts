import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const granularity = (searchParams.get('granularity') || 'hari') as 'hari' | 'bulan' | 'tahun';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables are missing.');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // 1. Determine Date Range
    let dateFrom = fromParam ? new Date(fromParam) : new Date();
    let dateTo = toParam ? new Date(toParam) : new Date();

    // If date range is a single day, expand to cover a useful chart view based on granularity
    const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      if (granularity === 'hari') {
        // Last 7 days
        dateFrom = new Date();
        dateFrom.setDate(dateTo.getDate() - 6);
      } else if (granularity === 'bulan') {
        // Last 12 months
        dateFrom = new Date();
        dateFrom.setMonth(dateTo.getMonth() - 11);
      } else {
        // Last 5 years
        dateFrom = new Date();
        dateFrom.setFullYear(dateTo.getFullYear() - 4);
      }
    }

    // Set boundary times
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    const getLocalDateStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getLocalMonthStr = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const getLocalDateStrFromISO = (isoStr: string) => {
      return getLocalDateStr(new Date(isoStr));
    };

    const getLocalMonthStrFromISO = (isoStr: string) => {
      return getLocalMonthStr(new Date(isoStr));
    };

    const getLocalYearStrFromISO = (isoStr: string) => {
      return String(new Date(isoStr).getFullYear());
    };

    const fromISO = dateFrom.toISOString();
    const toISO = dateTo.toISOString();
    const fromDateStr = getLocalDateStr(dateFrom);
    const toDateStr = getLocalDateStr(dateTo);

    // 2. Fetch data from Supabase
    // A. Transactions
    const { data: txs, error: txsErr } = await supabase
      .from('transactions')
      .select('id, total_amount, created_at')
      .gte('created_at', fromISO)
      .lte('created_at', toISO);
    if (txsErr) throw txsErr;

    // B. Transaction items (for net margin calculations)
    const txIds = (txs || []).map(t => t.id);
    let txItems: any[] = [];
    if (txIds.length > 0) {
      const { data: items, error: itemsErr } = await supabase
        .from('transaction_items')
        .select(`
          transaction_id,
          quantity,
          price_at_sale,
          cost_price_at_sale,
          products (
            cost_price
          )
        `)
        .in('transaction_id', txIds);
      if (itemsErr) throw itemsErr;
      txItems = items || [];
    }

    // C. Completed services
    const { data: svcs, error: svcsErr } = await supabase
      .from('services')
      .select('id, service_cost, part_cost, created_at')
      .eq('status', 'selesai')
      .gte('created_at', fromISO)
      .lte('created_at', toISO);
    if (svcsErr) throw svcsErr;

    // D. Expenditures / Expenses
    const { data: exps, error: expsErr } = await supabase
      .from('expenses')
      .select('id, amount, date')
      .gte('date', fromDateStr)
      .lte('date', toDateStr);
    if (expsErr) throw expsErr;

    // 3. Map margins per transaction
    const txMarginMap: Record<string, number> = {};
    txItems.forEach((item) => {
      const cost = item.products?.cost_price ?? item.cost_price_at_sale ?? 0;
      const sell = item.price_at_sale || 0;
      const qty = item.quantity || 0;
      const margin = (sell - cost) * qty;
      txMarginMap[item.transaction_id] = (txMarginMap[item.transaction_id] || 0) + margin;
    });

    // 4. Generate buckets based on granularity
    const buckets: Record<string, {
      netProfit: number;
      expenses: number;
      completedServices: number;
      salesNetProfit: number;
      serviceNetProfit: number;
      totalInflow: number;
      posGross: number;
      serviceGross: number;
    }> = {};

    const labels: string[] = [];

    if (granularity === 'hari') {
      // Create buckets for each day using local time boundaries
      const current = new Date(dateFrom);
      while (current <= dateTo) {
        const key = getLocalDateStr(current);
        const label = current.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        labels.push(label);
        buckets[key] = { netProfit: 0, expenses: 0, completedServices: 0, salesNetProfit: 0, serviceNetProfit: 0, totalInflow: 0, posGross: 0, serviceGross: 0 };
        current.setDate(current.getDate() + 1);
      }
    } else if (granularity === 'bulan') {
      // Create buckets for each month using local time boundaries
      const current = new Date(dateFrom);
      current.setDate(1); // Set to start of month to avoid overflow
      while (current <= dateTo) {
        const key = getLocalMonthStr(current);
        const label = current.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        labels.push(label);
        buckets[key] = { netProfit: 0, expenses: 0, completedServices: 0, salesNetProfit: 0, serviceNetProfit: 0, totalInflow: 0, posGross: 0, serviceGross: 0 };
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Create buckets for each year using local time boundaries
      const current = new Date(dateFrom);
      current.setMonth(0, 1); // Set to start of year
      while (current <= dateTo) {
        const key = String(current.getFullYear());
        labels.push(key);
        buckets[key] = { netProfit: 0, expenses: 0, completedServices: 0, salesNetProfit: 0, serviceNetProfit: 0, totalInflow: 0, posGross: 0, serviceGross: 0 };
        current.setFullYear(current.getFullYear() + 1);
      }
    }

    // Populate buckets dynamically mapping to correct keys
    (txs || []).forEach((t) => {
      let key = '';
      if (granularity === 'hari') {
        key = getLocalDateStrFromISO(t.created_at);
      } else if (granularity === 'bulan') {
        key = getLocalMonthStrFromISO(t.created_at);
      } else {
        key = getLocalYearStrFromISO(t.created_at);
      }

      if (buckets[key]) {
        const margin = txMarginMap[t.id] || 0;
        buckets[key].salesNetProfit += margin;
        buckets[key].totalInflow += t.total_amount;
        buckets[key].posGross += t.total_amount;
        buckets[key].netProfit += margin;
      }
    });

    (svcs || []).forEach((s) => {
      let key = '';
      if (granularity === 'hari') {
        key = getLocalDateStrFromISO(s.created_at);
      } else if (granularity === 'bulan') {
        key = getLocalMonthStrFromISO(s.created_at);
      } else {
        key = getLocalYearStrFromISO(s.created_at);
      }

      if (buckets[key]) {
        const margin = s.service_cost || 0;
        buckets[key].serviceNetProfit += margin;
        buckets[key].totalInflow += (s.service_cost || 0) + s.part_cost;
        buckets[key].serviceGross += margin;
        buckets[key].netProfit += margin;
        buckets[key].completedServices += 1;
      }
    });

    (exps || []).forEach((e) => {
      let key = '';
      if (granularity === 'hari') {
        key = e.date; // already YYYY-MM-DD
      } else if (granularity === 'bulan') {
        key = e.date.substring(0, 7); // YYYY-MM
      } else {
        key = e.date.substring(0, 4); // YYYY
      }

      if (buckets[key]) {
        buckets[key].expenses += e.amount;
        buckets[key].netProfit -= e.amount;
      }
    });

    // Convert buckets map to datasets arrays
    const netProfit: number[] = [];
    const expenses: number[] = [];
    const completedServices: number[] = [];
    const salesNetProfit: number[] = [];
    const serviceNetProfit: number[] = [];
    const totalInflow: number[] = [];
    const posGross: number[] = [];
    const serviceGross: number[] = [];

    Object.values(buckets).forEach((b) => {
      netProfit.push(b.netProfit);
      expenses.push(b.expenses);
      completedServices.push(b.completedServices);
      salesNetProfit.push(b.salesNetProfit);
      serviceNetProfit.push(b.serviceNetProfit);
      totalInflow.push(b.totalInflow);
      posGross.push(b.posGross);
      serviceGross.push(b.serviceGross);
    });

    return NextResponse.json({
      labels,
      datasets: {
        netProfit,
        expenses,
        completedServices,
        salesNetProfit,
        serviceNetProfit,
        totalInflow,
        posGross,
        serviceGross
      }
    });

  } catch (err: any) {
    console.error('Analytics API error:', err);
    // If anything fails (like DB query because offline), return mock payload to gracefully fallback
    return NextResponse.json(getMockPayload(req), { status: 200 });
  }
}

// Fallback mock payload helper
function getMockPayload(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const granularity = searchParams.get('granularity') || 'hari';

  let labels: string[] = [];
  let size = 7;

  if (granularity === 'hari') {
    labels = ['01 Jun', '02 Jun', '03 Jun', '04 Jun', '05 Jun', '06 Jun', '07 Jun'];
    size = 7;
  } else if (granularity === 'bulan') {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
    size = 12;
  } else {
    labels = ['2022', '2023', '2024', '2025', '2026'];
    size = 5;
  }

  // To prevent visual desynchronization when the database has no data,
  // the mock payload returns flat 0 arrays so it matches the 0 metrics on the dashboard.
  const zeros = Array(size).fill(0);

  return {
    labels,
    datasets: {
      netProfit: zeros,
      expenses: zeros,
      completedServices: zeros,
      salesNetProfit: zeros,
      serviceNetProfit: zeros,
      totalInflow: zeros,
      posGross: zeros,
      serviceGross: zeros
    }
  };
}
