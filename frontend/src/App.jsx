import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

function App() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientName, setNewClientName] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState([]);
  const [turnovers, setTurnovers] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchData();
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    const res = await fetch(`${API_BASE}/clients`);
    const data = await res.json();
    setClients(data);
  };

  const createClient = async () => {
    if (!newClientName) return;
    await fetch(`${API_BASE}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName }),
    });
    setNewClientName('');
    fetchClients();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        const [invRes, sumRes, turnRes] = await Promise.all([
          fetch(`${API_BASE}/clients/${selectedClient.id}/invoices`),
          fetch(`${API_BASE}/clients/${selectedClient.id}/summary`),
          fetch(`${API_BASE}/clients/${selectedClient.id}/turnover`),
        ]);
        setInvoices(await invRes.json());
        setSummary(await sumRes.json());
        setTurnovers(await turnRes.json());
    } finally {
        setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`${API_BASE}/clients/${selectedClient.id}/upload`, {
      method: 'POST',
      body: formData,
    });
    fetchData();
    setActiveTab('invoices');
  };

  const updateInvoice = async (id, updates) => {
    await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    fetchData();
  };

  const updateTurnover = async (month, data) => {
    await fetch(`${API_BASE}/clients/${selectedClient.id}/turnover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, ...data }),
    });
    fetchData();
  };

  const exportExcel = () => {
    window.location.href = `${API_BASE}/clients/${selectedClient.id}/export`;
  }

  const totals = summary.reduce((acc, curr) => {
    const keys = ['table_4a', 'rule_42', 'blocked', 'temp_reversal', 'reclaim_others', 'net_itc'];
    keys.forEach(k => {
        acc[k].igst += curr[k].igst || 0;
        acc[k].cgst += curr[k].cgst || 0;
        acc[k].sgst += curr[k].sgst || 0;
    });
    return acc;
  }, {
    table_4a: {igst:0, cgst:0, sgst:0}, rule_42: {igst:0, cgst:0, sgst:0}, blocked: {igst:0, cgst:0, sgst:0},
    temp_reversal: {igst:0, cgst:0, sgst:0}, reclaim_others: {igst:0, cgst:0, sgst:0}, net_itc: {igst:0, cgst:0, sgst:0}
  });

  if (!selectedClient) {
    return (
      <div className="p-8 max-w-2xl mx-auto font-sans">
        <h1 className="text-4xl font-extrabold mb-8 text-gray-800 tracking-tight">GST ITC RECONCILER</h1>
        <div className="bg-white p-6 shadow-2xl rounded-2xl border border-gray-200">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Select or Create Client</h2>
          <div className="grid gap-3">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className="p-4 bg-gray-50 text-left rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all font-semibold text-gray-800 shadow-sm"
              >
                {c.name}
              </button>
            ))}
            <div className="flex gap-2 mt-8">
              <input
                className="border p-3 flex-grow rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                placeholder="New Client Name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <button onClick={createClient} className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 font-bold shadow-lg transition-transform active:scale-95">Add Client</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <nav className="bg-slate-900 shadow-2xl p-4 mb-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-white">
            <div className="flex items-center gap-6">
                <h1 className="text-xl font-black uppercase tracking-widest text-blue-400">CLIENT: {selectedClient.name}</h1>
                <button onClick={() => setSelectedClient(null)} className="text-xs font-bold text-gray-400 hover:text-white uppercase transition-colors">Switch Client</button>
            </div>
            <button onClick={exportExcel} className="bg-emerald-500 text-white px-6 py-2 rounded-full text-sm font-black hover:bg-emerald-600 shadow-lg transition-all active:scale-95 uppercase tracking-wider">Export to Excel</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-10 mb-8 border-b border-slate-200">
            {['summary', 'invoices', 'turnover', 'upload'].map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'border-b-4 border-blue-600 text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {tab === 'turnover' ? 'Turnover (Rule 42)' : tab}
                </button>
            ))}
        </div>

        {loading && <div className="text-center p-20 font-black text-blue-600 animate-bounce tracking-widest">LOADING DATABASE...</div>}

        {!loading && activeTab === 'upload' && (
          <div className="bg-white p-16 shadow-2xl rounded-3xl border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-8">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-4">Upload Data</h2>
            <p className="text-slate-400 mb-10 text-center max-w-sm font-medium">Drop your monthly or annual GST reconciliation spreadsheet here to begin processing.</p>
            <label className="cursor-pointer bg-blue-600 text-white px-12 py-5 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all hover:-translate-y-1 active:translate-y-0">
                SELECT EXCEL FILE
                <input type="file" onChange={handleUpload} className="hidden" />
            </label>
          </div>
        )}

        {!loading && activeTab === 'turnover' && (
          <div className="bg-white p-10 shadow-2xl rounded-3xl border border-slate-100">
              <h2 className="text-3xl font-black text-slate-800 mb-8 uppercase tracking-tight">Turnover Data</h2>
              <TurnoverForm turnovers={turnovers} onUpdate={updateTurnover} months={[...new Set(invoices.map(i => i.month))]} />
          </div>
        )}

        {!loading && activeTab === 'invoices' && (
          <div className="bg-white shadow-2xl rounded-3xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black tracking-widest">
                    <tr>
                    <th className="p-5 border-b">Month</th>
                    <th className="p-5 border-b">Supplier Details</th>
                    <th className="p-5 border-b">Invoice</th>
                    <th className="p-5 border-b text-right">IGST</th>
                    <th className="p-5 border-b text-right">CGST</th>
                    <th className="p-5 border-b text-right">SGST</th>
                    <th className="p-5 border-b">Classification</th>
                    <th className="p-5 border-b">Reversal Type</th>
                    <th className="p-5 border-b text-center">Common</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-5 font-bold text-slate-900">{inv.month}</td>
                        <td className="p-5">
                            <div className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors">{inv.gstin}</div>
                            <div className="text-[10px] uppercase font-black text-slate-400">{inv.trade_name}</div>
                        </td>
                        <td className="p-5 font-mono text-slate-600">{inv.invoice_number}</td>
                        <td className="p-5 text-right font-mono font-bold text-slate-700">{inv.igst.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        <td className="p-5 text-right font-mono font-bold text-slate-700">{inv.cgst.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        <td className="p-5 text-right font-mono font-bold text-slate-700">{inv.sgst.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                        <td className="p-5">
                        <select
                            value={inv.status}
                            onChange={(e) => updateInvoice(inv.id, { status: e.target.value })}
                            className={`border-2 rounded-lg p-2 text-xs font-black transition-all outline-none ${inv.status === 'Matched' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}
                        >
                            <option value="Matched">Matched</option>
                            <option value="Not in books">Not in books</option>
                            <option value="Not in 2B">Not in 2B</option>
                            <option value="Ineligible">Ineligible</option>
                        </select>
                        </td>
                        <td className="p-5">
                        <select value={inv.sub_status || ''} onChange={(e) => updateInvoice(inv.id, { sub_status: e.target.value })} className="border-2 border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-blue-500">
                            <option value="">N/A</option>
                            <option value="Temp">Temporary</option>
                            <option value="Blocked">Blocked (Permanent)</option>
                        </select>
                        </td>
                        <td className="p-5 text-center">
                        <input
                            type="checkbox"
                            checked={inv.is_common_itc}
                            onChange={(e) => updateInvoice(inv.id, { is_common_itc: e.target.checked })}
                            className="w-6 h-6 text-blue-600 rounded-lg border-2 border-slate-300 focus:ring-blue-500 transition-all cursor-pointer"
                        />
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}

        {!loading && activeTab === 'summary' && (
          <div className="bg-white shadow-2xl rounded-3xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-center border-collapse">
                <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                    <tr>
                    <th rowSpan="2" className="border-r border-slate-700 p-5 sticky left-0 bg-slate-900 z-10">MONTH</th>
                    <th colSpan="3" className="border-r border-slate-700 p-3 bg-slate-800">Available (4A)</th>
                    <th colSpan="3" className="border-r border-slate-700 p-3 bg-blue-900">Rule 42 Reversal</th>
                    <th colSpan="3" className="border-r border-slate-700 p-3 bg-rose-900">Blocked Credit</th>
                    <th colSpan="3" className="border-r border-slate-700 p-3 bg-amber-900">RR Reversal (4B2)</th>
                    <th colSpan="3" className="border-r border-slate-700 p-3 bg-emerald-900">RR Reclaim Others</th>
                    <th colSpan="3" className="p-3 bg-indigo-900">NET ITC AVAILABLE</th>
                    </tr>
                    <tr className="bg-slate-800 text-[9px]">
                    {['I','C','S','I','C','S','I','C','S','I','C','S','I','C','S','I','C','S'].map((h, i) => (
                        <th key={i} className={`p-2 border-r border-slate-700 ${i > 14 ? 'bg-indigo-800' : ''}`}>{h}</th>
                    ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {summary.map(s => (
                    <tr key={s.month} className="hover:bg-slate-50 font-mono font-bold text-slate-700">
                        <td className="p-4 border-r border-slate-100 bg-white sticky left-0 z-10 text-slate-900">{s.month}</td>
                        <td className="p-2 border-r border-slate-50">{s.table_4a.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-50">{s.table_4a.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-100">{s.table_4a.sgst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-blue-50 text-blue-700">{s.rule_42.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-50 bg-blue-50 text-blue-700">{s.rule_42.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-100 bg-blue-50 text-blue-700">{s.rule_42.sgst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-rose-50 text-rose-700">{s.blocked.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-50 bg-rose-50 text-rose-700">{s.blocked.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-100 bg-rose-50 text-rose-700">{s.blocked.sgst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-amber-50 text-amber-700">{s.temp_reversal.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-50 bg-amber-50 text-amber-700">{s.temp_reversal.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-100 bg-amber-50 text-amber-700">{s.temp_reversal.sgst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-emerald-50 text-emerald-700">{s.reclaim_others.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-50 bg-emerald-50 text-emerald-700">{s.reclaim_others.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-100 bg-emerald-50 text-emerald-700">{s.reclaim_others.sgst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-indigo-50 text-indigo-900 font-black">{s.net_itc.igst.toFixed(0)}</td>
                        <td className="p-2 border-r border-slate-50 bg-indigo-50 text-indigo-900 font-black">{s.net_itc.cgst.toFixed(0)}</td>
                        <td className="p-2 bg-indigo-50 text-indigo-900 font-black">{s.net_itc.sgst.toFixed(0)}</td>
                    </tr>
                    ))}
                    {summary.length > 0 && (
                        <tr className="bg-slate-100 font-black text-slate-900 uppercase tracking-tighter">
                             <td className="p-5 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">TOTAL YEAR</td>
                             <td className="p-2 border-r border-slate-200">{totals.table_4a.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-200">{totals.table_4a.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-200">{totals.table_4a.sgst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-blue-100">{totals.rule_42.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-blue-100">{totals.rule_42.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-blue-100">{totals.rule_42.sgst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-rose-100">{totals.blocked.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-rose-100">{totals.blocked.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-rose-100">{totals.blocked.sgst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-amber-100">{totals.temp_reversal.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-amber-100">{totals.temp_reversal.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-amber-100">{totals.temp_reversal.sgst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-emerald-100">{totals.reclaim_others.igst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-emerald-100">{totals.reclaim_others.cgst.toFixed(0)}</td><td className="p-2 border-r border-slate-200 bg-emerald-100">{totals.reclaim_others.sgst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-indigo-200">{totals.net_itc.igst.toFixed(0)}</td>
                             <td className="p-2 border-r border-slate-200 bg-indigo-200">{totals.net_itc.cgst.toFixed(0)}</td>
                             <td className="p-2 bg-indigo-200">{totals.net_itc.sgst.toFixed(0)}</td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TurnoverForm({ turnovers, onUpdate, months }) {
    if (months.length === 0) return (
        <div className="p-20 text-center flex flex-col items-center">
            <svg className="w-16 h-16 text-slate-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <p className="text-slate-400 font-bold uppercase tracking-widest">No data available. Please upload a file first.</p>
        </div>
    );

    return (
        <div className="grid gap-8">
            {months.sort().map(month => {
                const t = turnovers.find(x => x.month === month) || { nil_rated_turnover: 0, exempt_turnover: 0, total_turnover: 0 };
                return (
                    <div key={month} className="bg-slate-50 p-8 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-8 items-end border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="text-xl font-black text-blue-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{month}</div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Nil Rated</label>
                            <input
                                type="number"
                                defaultValue={t.nil_rated_turnover}
                                onBlur={(e) => onUpdate(month, { ...t, nil_rated_turnover: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Exempt</label>
                            <input
                                type="number"
                                defaultValue={t.exempt_turnover}
                                onBlur={(e) => onUpdate(month, { ...t, exempt_turnover: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Total Turnover</label>
                            <input
                                type="number"
                                defaultValue={t.total_turnover}
                                onBlur={(e) => onUpdate(month, { ...t, total_turnover: parseFloat(e.target.value) || 0 })}
                                className="w-full border-2 border-slate-200 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono font-bold"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default App;
