import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  LayoutDashboard, FileText, Map, FileBarChart, Settings, 
  Plus, Search, Bell, User, MapPin, AlertTriangle, CheckCircle2, Clock,
  Filter, Layers, X, Calendar, Printer, Send, QrCode, Smartphone, Check, ShieldCheck
} from 'lucide-react';

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6'];

const heatmapData = [
  { id: 1, type: 'Property Dispute', x: 35, y: 45, size: 140, color: 'rgba(59, 130, 246, 0.5)', location: 'Sitio Kawayan', count: 4 },
  { id: 2, type: 'Videoke / Noise Disturbance', x: 60, y: 30, size: 220, color: 'rgba(245, 158, 11, 0.4)', location: 'Sitio Mangga', count: 12 },
  { id: 3, type: 'Debt / Financial Dispute', x: 25, y: 70, size: 100, color: 'rgba(239, 68, 68, 0.6)', location: 'Poblacion', count: 2 },
  { id: 4, type: 'Physical Altercation', x: 75, y: 65, size: 120, color: 'rgba(239, 68, 68, 0.7)', location: 'Sitio Kawayan', count: 3 },
  { id: 5, type: 'Curfew Violation', x: 45, y: 80, size: 180, color: 'rgba(245, 158, 11, 0.3)', location: 'Zone 3', count: 8 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [blotters, setBlotters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Citizen Reports State (Pending Review)
  const [citizenReports, setCitizenReports] = useState([
    { id: 101, complainant: 'Roberto Gomez', type: 'Videoke / Noise Disturbance', sitio: 'Sitio Kawayan', narrative: 'Neighbor playing loud music past 12 midnight despite warnings.', date: '2026-03-27 23:30', status: 'Pending Review' },
    { id: 102, complainant: 'Elena Santos', type: 'Property Dispute', sitio: 'Sitio Mangga', narrative: 'Tree branches from neighbor destroying roof gutter.', date: '2026-03-28 09:15', status: 'Pending Review' }
  ]);
  const [isCitizenPortalOpen, setIsCitizenPortalOpen] = useState(false);
  const [citizenForm, setCitizenForm] = useState({ complainant: '', contact: '', type: 'Videoke / Noise Disturbance', sitio: 'Sitio Kawayan', narrative: '' });
  const [citizenSubmittedSuccess, setCitizenSubmittedSuccess] = useState(false);

  // KP Modal States
  const [selectedCaseForKP, setSelectedCaseForKP] = useState(null);
  const [kpModalType, setKpModalType] = useState(null); // 'summons' or 'cfa'
  const [hearingDetails, setHearingDetails] = useState({ date: '', time: '14:00', venue: 'Brgy. Subangdaku Conference Hall' });

  const initialFormState = {
    incident_type: 'Property Dispute',
    status: 'Pending Lupon',
    incident_datetime: '',
    sitio: '',
    landmark: '',
    complainant_name: '',
    complainant_contact: '',
    complainant_sitio: '',
    complainant_resident_status: 'Resident',
    respondent_name: '',
    respondent_contact: '',
    respondent_sitio: '',
    respondent_resident_status: 'Resident',
    narrative: ''
  };
  
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchBlotters();
  }, []);

  const fetchBlotters = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/blotters');
      const data = await response.json();
      setBlotters(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching data from database:", error);
      setIsLoading(false);
    }
  };

  const handleAddBlotter = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.complainant_name) errors.complainant_name = "Required";
    if (!formData.respondent_name) errors.respondent_name = "Required";
    if (!formData.incident_datetime) errors.incident_datetime = "Required";
    if (!formData.sitio) errors.sitio = "Required";
    if (!formData.narrative) errors.narrative = "Required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    try {
      const response = await fetch('http://localhost:5000/api/blotters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchBlotters(); 
        setIsModalOpen(false);
        setFormData(initialFormState);
      } else {
        alert("Failed to save to database.");
      }
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const handleApproveCitizenReport = async (report) => {
    // Transform citizen report into official blotter entry format
    const newBlotter = {
      incident_type: report.type,
      status: 'Pending Lupon',
      incident_datetime: new Date().toISOString().slice(0, 16),
      sitio: report.sitio,
      landmark: 'Online Submission',
      complainant_name: report.complainant,
      complainant_contact: '0917-000-0000',
      complainant_sitio: report.sitio,
      complainant_resident_status: 'Resident',
      respondent_name: 'Unspecified / Respondent TBA',
      respondent_contact: '',
      respondent_sitio: '',
      respondent_resident_status: 'Resident',
      narrative: `[Via Citizen QR Portal]: ${report.narrative}`
    };

    try {
      const response = await fetch('http://localhost:5000/api/blotters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlotter)
      });

      if (response.ok) {
        fetchBlotters();
        setCitizenReports(citizenReports.filter(r => r.id !== report.id));
        alert("Citizen report approved and successfully added to official blotter logs!");
      }
    } catch (error) {
      console.error("Error approving report:", error);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/blotters/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        fetchBlotters();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const resolvedCount = blotters.filter(b => b.status === 'Settled at Desk' || b.status === 'Closed').length;
  const pendingCount = blotters.filter(b => b.status === 'Pending Lupon').length;
  const resolutionRate = blotters.length > 0 ? Math.round((resolvedCount / blotters.length) * 100) : 0;

  const incidentCounts = blotters.reduce((acc, curr) => {
    acc[curr.incident_type] = (acc[curr.incident_type] || 0) + 1;
    return acc;
  }, {});
  const dynamicIncidentData = Object.keys(incidentCounts).map(key => ({ name: key, count: incidentCounts[key] }));

  const statusCounts = blotters.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});
  const dynamicStatusData = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

  const SidebarItem = ({ icon: Icon, label, id }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
        <div className="p-6">
          <div className="flex items-center space-x-2 text-white mb-2">
            <div className="bg-blue-500 p-1.5 rounded-lg">
              <MapPin size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">eBarangayMo</h1>
          </div>
          <p className="text-xs text-slate-400 font-medium">Brgy. Subangdaku, Mandaue</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" id="dashboard" />
          <SidebarItem icon={FileText} label="Blotter Logs & KP" id="logs" />
          <SidebarItem icon={QrCode} label="Citizen Reports Queue" id="citizen_queue" />
          <SidebarItem icon={Map} label="Incident Heatmap" id="map" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setIsCitizenPortalOpen(true)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-blue-400 border border-blue-500/30 text-xs font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center transition-colors shadow-sm"
          >
            <Smartphone size={15} className="mr-2" /> Preview Citizen QR Portal
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center bg-slate-100 px-4 py-2 rounded-lg w-full max-w-md">
            <Search size={18} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search blotter ID, names..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700"
            />
          </div>
          <div className="flex items-center space-x-4 ml-4">
            <button 
              onClick={() => setIsCitizenPortalOpen(true)}
              className="md:hidden bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center"
            >
              <Smartphone size={14} className="mr-1" /> QR Portal
            </button>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200">
              <User size={18} />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          
          {(activeTab === 'dashboard' || activeTab === 'logs') && (
            <div className="max-w-7xl mx-auto space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {activeTab === 'dashboard' ? 'Barangay Overview' : 'Blotter Logs & Katarungang Pambarangay'}
                  </h2>
                  <p className="text-slate-500 text-sm">Manage blotters, issue KP Form summons, and generate certificates.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                >
                  <Plus size={18} className="mr-2" /> New Blotter Entry
                </button>
              </div>

              {activeTab === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Total Blotters" value={blotters.length} icon={FileText} colorClass="bg-blue-100 text-blue-600" />
                    <StatCard title="Cases Settled" value={resolvedCount} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
                    <StatCard title="Pending Lupon" value={pendingCount} icon={Clock} colorClass="bg-amber-100 text-amber-600" />
                    <StatCard title="Resolution Rate" value={`${resolutionRate}%`} icon={FileBarChart} colorClass="bg-purple-100 text-purple-600" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">Incidents by Category</h3>
                      {dynamicIncidentData.length > 0 ? (
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dynamicIncidentData} margin={{bottom: 20}}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                              <XAxis dataKey="name" tick={{fontSize: 11}} stroke="#94a3b8" angle={-15} textAnchor="end" />
                              <YAxis allowDecimals={false} tick={{fontSize: 12}} stroke="#94a3b8" />
                              <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-72 flex items-center justify-center text-slate-400">No data available yet</div>
                      )}
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">Case Status Distribution</h3>
                      {dynamicStatusData.length > 0 ? (
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={dynamicStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {dynamicStatusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                         <div className="h-72 flex items-center justify-center text-slate-400">No data available yet</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Blotter & KP Action Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-800">
                    {activeTab === 'logs' ? 'All Blotter Records & Mediation Control' : 'Recent Blotter Logs'}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-500">Loading data from database...</div>
                  ) : blotters.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">No blotters found. Add one above!</div>
                  ) : (
                    <table className="w-full text-left text-sm text-slate-600 min-w-[1050px]">
                      <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3">Case ID</th>
                          <th className="px-6 py-3">Incident & Date</th>
                          <th className="px-6 py-3">Parties Involved</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">KP Automation Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blotters.map((blotter) => (
                          <tr key={blotter.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-blue-700 whitespace-nowrap">{blotter.case_id}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{blotter.incident_type}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {new Date(blotter.incident_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-slate-800 font-bold">{blotter.complainant_name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">vs. {blotter.respondent_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select 
                                value={blotter.status}
                                onChange={(e) => handleStatusChange(blotter.id, e.target.value)}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border outline-none cursor-pointer
                                  ${blotter.status === 'Settled at Desk' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                    blotter.status === 'Pending Lupon' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    blotter.status === 'Referred to PNP' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-slate-50 text-slate-700 border-slate-200'}
                                `}
                              >
                                <option value="Pending Lupon">Pending Lupon</option>
                                <option value="Settled at Desk">Settled at Desk</option>
                                <option value="Unresolved">Unresolved (for CFA)</option>
                                <option value="Referred to PNP">Referred to PNP</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                              <button 
                                onClick={() => { setSelectedCaseForKP(blotter); setKpModalType('summons'); }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg text-xs inline-flex items-center transition-colors"
                              >
                                <Calendar size={14} className="mr-1" /> Schedule Hearing (KP Form 8)
                              </button>
                              
                              <button 
                                onClick={() => { setSelectedCaseForKP(blotter); setKpModalType('cfa'); }}
                                className={`px-3 py-1.5 font-medium rounded-lg text-xs inline-flex items-center transition-colors
                                  ${blotter.status === 'Unresolved' 
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm' 
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              >
                                <Printer size={14} className="mr-1" /> Print CFA (Form 20)
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Citizen Reports Queue Tab */}
          {activeTab === 'citizen_queue' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Citizen QR Reports Queue</h2>
                  <p className="text-slate-500 text-sm">Review pre-blotter incident reports submitted by residents via smartphone QR scanning.</p>
                </div>
                <button 
                  onClick={() => setIsCitizenPortalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors shadow-sm"
                >
                  <QrCode size={18} className="mr-2" /> Open Resident QR Portal
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Pending Submissions ({citizenReports.length})</h3>
                  <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">Requires Desk Officer Review</span>
                </div>
                {citizenReports.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-500 opacity-80" />
                    <p className="font-medium text-slate-700">All citizen reports have been reviewed and processed!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {citizenReports.map(report => (
                      <div key={report.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800 text-base">{report.complainant}</span>
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">{report.type}</span>
                          </div>
                          <p className="text-sm text-slate-600">{report.narrative}</p>
                          <div className="flex items-center space-x-4 text-xs text-slate-400 pt-1">
                            <span className="flex items-center"><MapPin size={12} className="mr-1" /> {report.sitio}</span>
                            <span className="flex items-center"><Clock size={12} className="mr-1" /> {report.date}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                          <button 
                            onClick={() => handleApproveCitizenReport(report)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm whitespace-nowrap"
                          >
                            <Check size={14} className="mr-1.5" /> Approve to Official Blotter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
             <div className="max-w-7xl mx-auto h-full flex flex-col space-y-6">
               <div>
                 <h2 className="text-2xl font-bold text-slate-800">Incident Heatmap</h2>
                 <p className="text-slate-500 text-sm">Geographical distribution of reported incidents</p>
               </div>
               <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[600px] flex items-center justify-center">
                 <div className="absolute inset-0" style={{
                   backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: '40px 40px', backgroundColor: '#f8fafc'
                 }}></div>
                 {heatmapData.map((point) => (
                   <div key={point.id} className="absolute rounded-full flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair group"
                     style={{ left: `${point.x}%`, top: `${point.y}%`, width: `${point.size}px`, height: `${point.size}px`, background: `radial-gradient(circle, ${point.color} 0%, rgba(255,255,255,0) 70%)` }}
                   >
                     <div className="w-2 h-2 bg-slate-800 rounded-full border-2 border-white opacity-50 group-hover:scale-150 transition-transform"></div>
                     <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-slate-900 text-white text-xs rounded-lg shadow-xl z-10 p-3">
                       <p className="font-bold border-b border-slate-700 pb-1 mb-1">{point.location}</p>
                       <p className="text-slate-300">{point.type}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>
      </main>

      {/* Resident Web Portal / QR Code Simulation Modal */}
      {isCitizenPortalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 text-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[95vh] border border-slate-800">
            
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">eBarangayMo Resident Portal</h3>
                  <p className="text-[10px] text-slate-400">Brgy. Subangdaku Public Reporting</p>
                </div>
              </div>
              <button onClick={() => setIsCitizenPortalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-950">
              {citizenSubmittedSuccess ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck size={32} />
                  </div>
                  <h4 className="text-lg font-bold">Report Submitted Successfully!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Your pre-blotter has been securely dispatched to the Brgy. Subangdaku desk officer for review. Reference Code: <span className="font-mono text-emerald-400 font-bold">QR-2026-8942</span>
                  </p>
                  <button 
                    onClick={() => { setCitizenSubmittedSuccess(false); setCitizenForm({ complainant: '', contact: '', type: 'Videoke / Noise Disturbance', sitio: 'Sitio Kawayan', narrative: '' }); }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl transition-colors"
                  >
                    Submit Another Report
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-start space-x-3">
                    <QrCode size={20} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-blue-300">Scanned via Tarpaulin QR Code</p>
                      <p className="text-slate-400">File a complaint or pre-blotter instantly without walking to the barangay hall.</p>
                    </div>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!citizenForm.complainant || !citizenForm.narrative) {
                      alert("Please fill in your name and incident narrative.");
                      return;
                    }
                    const newReport = {
                      id: Date.now(),
                      complainant: citizenForm.complainant,
                      type: citizenForm.type,
                      sitio: citizenForm.sitio,
                      narrative: citizenForm.narrative,
                      date: new Date().toLocaleString()
                    };
                    setCitizenReports([newReport, ...citizenReports]);
                    setCitizenSubmittedSuccess(true);
                  }} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Your Full Name *</label>
                      <input type="text" required placeholder="e.g. Juan Dela Cruz" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                        value={citizenForm.complainant} onChange={e => setCitizenForm({...citizenForm, complainant: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Mobile Number (For SMS Updates)</label>
                      <input type="text" placeholder="0912 345 6789" 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                        value={citizenForm.contact} onChange={e => setCitizenForm({...citizenForm, contact: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Incident Type</label>
                        <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                          value={citizenForm.type} onChange={e => setCitizenForm({...citizenForm, type: e.target.value})}
                        >
                          <option>Videoke / Noise Disturbance</option>
                          <option>Property Dispute</option>
                          <option>Physical Altercation</option>
                          <option>Curfew Violation</option>
                          <option>Others</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Sitio / Area</label>
                        <select className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                          value={citizenForm.sitio} onChange={e => setCitizenForm({...citizenForm, sitio: e.target.value})}
                        >
                          <option>Sitio Kawayan</option>
                          <option>Sitio Mangga</option>
                          <option>Poblacion</option>
                          <option>Zone 3</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Complaint Narrative & Evidence *</label>
                      <textarea rows="3" required placeholder="Describe what happened..." 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 resize-none"
                        value={citizenForm.narrative} onChange={e => setCitizenForm({...citizenForm, narrative: e.target.value})}
                      ></textarea>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-colors mt-2">
                      Submit Pre-Blotter to Barangay
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KP Summons or CFA Generator Modal */}
      {selectedCaseForKP && kpModalType && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <h2 className="text-lg font-bold flex items-center">
                <FileText size={20} className="mr-2 text-blue-400"/> 
                {kpModalType === 'summons' ? 'DILG KP Form No. 8 (Notice of Hearing)' : 'DILG KP Form No. 20 (Certificate to File Action)'}
              </h2>
              <button onClick={() => setSelectedCaseForKP(null)} className="text-slate-400 hover:text-white p-1 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50 font-serif">
              
              {/* Document Mock Sheet */}
              <div className="bg-white p-8 border border-slate-300 shadow-sm text-black space-y-4">
                <div className="text-center space-y-1 pb-4 border-b border-slate-200 font-sans">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Republic of the Philippines</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">City of Mandaue</p>
                  <p className="font-bold text-sm">BARANGAY SUBANGDAKU</p>
                  <p className="text-xs font-bold text-slate-700">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
                </div>

                <div className="flex justify-between text-sm py-2">
                  <div>
                    <p><span className="font-bold">Complainant:</span> {selectedCaseForKP.complainant_name}</p>
                    <p><span className="font-bold">Address:</span> {selectedCaseForKP.complainant_sitio || 'Brgy. Subangdaku'}</p>
                  </div>
                  <div className="text-right">
                    <p><span className="font-bold">Case ID:</span> {selectedCaseForKP.case_id}</p>
                    <p><span className="font-bold">Type:</span> {selectedCaseForKP.incident_type}</p>
                  </div>
                </div>

                <div className="text-center py-2 font-bold text-base underline">
                  {kpModalType === 'summons' ? 'NOTICE OF HEARING (PATAWAG)' : 'CERTIFICATE TO FILE ACTION'}
                </div>

                {kpModalType === 'summons' ? (
                  <div className="text-sm space-y-4 leading-relaxed font-serif">
                    <p>To: <span className="font-bold uppercase underline">{selectedCaseForKP.respondent_name}</span> (Respondent)</p>
                    <p>
                      You are hereby required to appear before me/the Punong Barangay on the 
                      <span className="font-bold underline px-1">{hearingDetails.date || '[Select Date Below]'}</span> at 
                      <span className="font-bold underline px-1">{hearingDetails.time}</span> at the 
                      <span className="font-bold underline px-1">{hearingDetails.venue}</span> for the hearing of your case.
                    </p>
                    <p className="text-xs text-slate-600 italic">
                      *Note: This notice is automatically generated by eBarangayMo and dispatched with SMS notifications via API.
                    </p>
                  </div>
                ) : (
                  <div className="text-sm space-y-4 leading-relaxed font-serif">
                    <p>This is to certify that:</p>
                    <p className="list-disc pl-4">
                      1. There was a personal confrontation between the parties before the Punong Barangay / Lupon Tagapamayapa.<br/>
                      2. No settlement was reached due to the refusal of the respondent to cooperate / unresolvable dispute.<br/>
                      3. Therefore, the corresponding complaint for the court/police may now be filed.
                    </p>
                  </div>
                )}

                <div className="pt-8 flex justify-between items-end text-xs font-sans">
                  <div>
                    <p>Generated via eBarangayMo Cloud System</p>
                    <p className="text-slate-400">{new Date().toLocaleString()}</p>
                  </div>
                  <div className="text-center pt-8">
                    <div className="border-b border-black w-48 mb-1"></div>
                    <p className="font-bold">PUNONG BARANGAY / LUPON SECRETARY</p>
                  </div>
                </div>
              </div>

              {kpModalType === 'summons' && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 font-sans">
                  <h4 className="font-bold text-sm text-slate-800">Schedule Details for SMS Gateway (Semaphore API):</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Hearing Date</label>
                      <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50"
                        value={hearingDetails.date} onChange={e => setHearingDetails({...hearingDetails, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                      <input type="time" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50"
                        value={hearingDetails.time} onChange={e => setHearingDetails({...hearingDetails, time: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end space-x-3">
              <button onClick={() => setSelectedCaseForKP(null)} className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              {kpModalType === 'summons' ? (
                <button onClick={() => { alert(`Success! SMS Notice sent to Complainant and Respondent (${selectedCaseForKP.respondent_name}) via SMS Gateway API.`); setSelectedCaseForKP(null); }} 
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm flex items-center shadow-sm">
                  <Send size={16} className="mr-2"/> Send SMS Notice & Print Summons
                </button>
              ) : (
                <button onClick={() => { window.print(); }} 
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm flex items-center shadow-sm">
                  <Printer size={16} className="mr-2"/> Print Official CFA (KP Form 20)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Blotter Intake Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <FileText size={22} className="mr-2 text-blue-600"/> Official Blotter Intake
                </h2>
                <p className="text-xs text-slate-500 mt-1">Brgy. Subangdaku - System auto-generates Case ID.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-2 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddBlotter} className="p-6 overflow-y-auto flex-1 bg-white">
              <h3 className="text-md font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Incident Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incident Category *</label>
                  <select className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50"
                    value={formData.incident_type} onChange={e => setFormData({...formData, incident_type: e.target.value})}
                  >
                    <option>Curfew Violation</option>
                    <option>Videoke / Noise Disturbance</option>
                    <option>Property Dispute</option>
                    <option>Physical Altercation</option>
                    <option>Debt / Financial Dispute</option>
                    <option>Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time *</label>
                  <input type="datetime-local" className={`w-full border rounded-lg px-4 py-2.5 bg-slate-50 ${formErrors.incident_datetime ? 'border-red-500' : 'border-slate-300'}`}
                    value={formData.incident_datetime} onChange={e => setFormData({...formData, incident_datetime: e.target.value})}
                  />
                  {formErrors.incident_datetime && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Status</label>
                  <select className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50"
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option>Pending Lupon</option>
                    <option>Settled at Desk</option>
                    <option>Referred to PNP</option>
                    <option>Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sitio / Purok *</label>
                  <input type="text" placeholder="e.g. Sitio Kawayan" className={`w-full border rounded-lg px-4 py-2.5 bg-slate-50 ${formErrors.sitio ? 'border-red-500' : 'border-slate-300'}`}
                    value={formData.sitio} onChange={e => setFormData({...formData, sitio: e.target.value})}
                  />
                  {formErrors.sitio && <p className="text-red-500 text-xs mt-1">Required</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                  <input type="text" placeholder="e.g. Near waiting shed" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-slate-50"
                    value={formData.landmark} onChange={e => setFormData({...formData, landmark: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4">
                  <h3 className="text-md font-bold text-blue-900 border-b border-blue-200 pb-2">Complainant Details</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input type="text" className={`w-full border rounded-lg px-4 py-2 bg-white ${formErrors.complainant_name ? 'border-red-500' : 'border-slate-300'}`}
                      value={formData.complainant_name} onChange={e => setFormData({...formData, complainant_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white border-slate-300"
                      value={formData.complainant_contact} onChange={e => setFormData({...formData, complainant_contact: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-red-50/50 p-5 rounded-xl border border-red-100 space-y-4">
                  <h3 className="text-md font-bold text-red-900 border-b border-red-200 pb-2">Respondent Details</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                    <input type="text" className={`w-full border rounded-lg px-4 py-2 bg-white ${formErrors.respondent_name ? 'border-red-500' : 'border-slate-300'}`}
                      value={formData.respondent_name} onChange={e => setFormData({...formData, respondent_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg px-4 py-2 bg-white border-slate-300"
                      value={formData.respondent_contact} onChange={e => setFormData({...formData, respondent_contact: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-md font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Incident Narrative</h3>
                <textarea rows="4" placeholder="Provide a summary of the complaint..." className={`w-full border rounded-lg px-4 py-3 bg-slate-50 resize-none ${formErrors.narrative ? 'border-red-500' : 'border-slate-300'}`}
                  value={formData.narrative} onChange={e => setFormData({...formData, narrative: e.target.value})}
                ></textarea>
              </div>
              
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end space-x-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center shadow-md">
                  <CheckCircle2 size={20} className="mr-2"/> Save Official Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}