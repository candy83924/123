import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  FileText, 
  ClipboardCheck, 
  MoreVertical, 
  Trash2, 
  AlertCircle,
  Clock,
  ChevronRight,
  BarChart3,
  Search,
  Filter,
  Receipt,
  Calendar,
  CalendarCheck,
  StickyNote,
  Paperclip,
  X,
  Download,
  ListChecks,
  User,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ProjectFile {
  id: number;
  project_id: number;
  name: string;
  type: string;
  size: number;
  created_at: string;
}

interface ProjectMilestone {
  id: number;
  project_id: number;
  name: string;
  is_accepted: boolean;
  is_invoiced: boolean;
}

interface Project {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  progress: number;
  is_invoiced: boolean;
  is_accepted: boolean;
  is_pr_created: boolean;
  is_urgent_pr: boolean;
  start_date: string | null;
  acceptance_date: string | null;
  notes: string | null;
  assignee: string | null;
  created_at: string;
  files?: ProjectFile[];
  milestones?: ProjectMilestone[];
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newProject, setNewProject] = useState({ 
    title: '', 
    description: '', 
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
    is_urgent_pr: false,
    assignee: ''
  });
  const [loading, setLoading] = useState(true);
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('all');
  const [acceptanceFilter, setAcceptanceFilter] = useState<string>('all');
  const [prFilter, setPrFilter] = useState<string>('all');
  const [urgentPrFilter, setUrgentPrFilter] = useState<string>('all');
  
  // Edit Title State
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  // Edit Description State
  const [editingDescId, setEditingDescId] = useState<number | null>(null);
  const [editingDescValue, setEditingDescValue] = useState('');
  
  // Delete Confirmation State
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      const data = await res.json();
      setProjects([data, ...projects]);
      setNewProject({ 
        title: '', 
        description: '', 
        start_date: new Date().toISOString().split('T')[0],
        notes: '',
        is_urgent_pr: false,
        assignee: ''
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add project:', error);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const projectsToImport = json.map((row: any) => {
          const milestones = [];
          if (row['驗收階段1']) milestones.push({ name: String(row['驗收階段1']) });
          if (row['驗收階段2']) milestones.push({ name: String(row['驗收階段2']) });
          if (row['驗收階段3']) milestones.push({ name: String(row['驗收階段3']) });

          return {
            title: row['案子名稱'] || '未命名案子',
            description: row['廠商'] || '',
            start_date: row['開案日期'] || null,
            acceptance_date: row['驗收日期'] || null,
            notes: row['備註'] || '',
            is_urgent_pr: row['緊急PR'] === '是' || row['緊急PR'] === true,
            assignee: row['處理人'] || '',
            milestones
          };
        });

        if (projectsToImport.length > 0) {
          const res = await fetch('/api/projects/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: projectsToImport }),
          });
          const newProjects = await res.json();
          setProjects([...newProjects, ...projects]);
          alert(`成功匯入 ${newProjects.length} 筆案子！`);
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('匯入失敗，請確認檔案格式是否正確。');
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadExcelTemplate = () => {
    const templateData = [
      {
        '案子名稱': '範例專案A',
        '廠商': '蘋果公司',
        '開案日期': '2024-01-01',
        '驗收日期': '2024-02-01',
        '緊急PR': '是',
        '處理人': '王小明',
        '備註': '急件',
        '驗收階段1': '30% 訂金',
        '驗收階段2': '70% 尾款',
        '驗收階段3': ''
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, "專案匯入範本.xlsx");
  };

  const updateProject = async (id: number, updates: Partial<Project>) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setProjects(projects.map(p => p.id === id ? data : p));
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const confirmDelete = async () => {
    if (projectToDelete === null) return;
    try {
      await fetch(`/api/projects/${projectToDelete}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== projectToDelete));
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleFileUpload = async (projectId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result;
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data
          })
        });
        const newFile = await res.json();
        setProjects(projects.map(p => 
          p.id === projectId 
            ? { ...p, files: [...(p.files || []), newFile] }
            : p
        ));
      } catch (error) {
        console.error('Upload failed', error);
      }
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const handleFileDownload = async (fileId: number, fileName: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}`);
      const fileData = await res.json();
      const a = document.createElement('a');
      a.href = fileData.data;
      a.download = fileName;
      a.click();
    } catch (error) {
      console.error('Download failed', error);
    }
  };

  const handleFileDelete = async (projectId: number, fileId: number) => {
    if (!confirm('確定要刪除此檔案嗎？')) return;
    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      setProjects(projects.map(p => 
        p.id === projectId 
          ? { ...p, files: (p.files || []).filter(f => f.id !== fileId) }
          : p
      ));
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const addMilestone = async (projectId: number, name: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const newMilestone = await res.json();
      setProjects(projects.map(p => 
        p.id === projectId 
          ? { ...p, milestones: [...(p.milestones || []), newMilestone] }
          : p
      ));
    } catch (error) {
      console.error('Failed to add milestone', error);
    }
  };

  const updateMilestone = async (projectId: number, milestoneId: number, updates: Partial<ProjectMilestone>) => {
    try {
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const updated = await res.json();
      setProjects(projects.map(p => 
        p.id === projectId 
          ? { ...p, milestones: p.milestones?.map(m => m.id === milestoneId ? updated : m) }
          : p
      ));
    } catch (error) {
      console.error('Failed to update milestone', error);
    }
  };

  const deleteMilestone = async (projectId: number, milestoneId: number) => {
    try {
      await fetch(`/api/milestones/${milestoneId}`, { method: 'DELETE' });
      setProjects(projects.map(p => 
        p.id === projectId 
          ? { ...p, milestones: p.milestones?.filter(m => m.id !== milestoneId) }
          : p
      ));
    } catch (error) {
      console.error('Failed to delete milestone', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'on_hold': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '進行中';
      case 'on_hold': return '暫緩';
      default: return '待處理';
    }
  };

  // Filter projects based on search query and selected filters
  const filteredProjects = projects.filter(project => {
    // Search by title or description
    const matchesSearch = 
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by status
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    // Filter by invoice status
    const matchesInvoice = 
      invoiceFilter === 'all' || 
      (invoiceFilter === 'invoiced' && project.is_invoiced) || 
      (invoiceFilter === 'not_invoiced' && !project.is_invoiced);
      
    // Filter by acceptance status
    const matchesAcceptance = 
      acceptanceFilter === 'all' || 
      (acceptanceFilter === 'accepted' && project.is_accepted) || 
      (acceptanceFilter === 'not_accepted' && !project.is_accepted);
      
    // Filter by PR status
    const matchesPr = 
      prFilter === 'all' || 
      (prFilter === 'created' && project.is_pr_created) || 
      (prFilter === 'not_created' && !project.is_pr_created);

    // Filter by urgent PR
    const matchesUrgentPr = 
      urgentPrFilter === 'all' || 
      (urgentPrFilter === 'urgent' && project.is_urgent_pr) || 
      (urgentPrFilter === 'not_urgent' && !project.is_urgent_pr);

    return matchesSearch && matchesStatus && matchesInvoice && matchesAcceptance && matchesPr && matchesUrgentPr;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-bottom border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <BarChart3 size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">專案進度管理</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={downloadExcelTemplate}
              className="hidden md:flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
            >
              <Download size={18} />
              下載範本
            </button>
            <label className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold hover:bg-emerald-100 transition-all border border-emerald-200 shadow-sm cursor-pointer">
              <FileText size={18} />
              {isImporting ? '匯入中...' : '匯入 Excel'}
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleImportExcel}
                disabled={isImporting}
              />
            </label>
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <Plus size={18} />
              <span>新增案子</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <ClipboardCheck size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">總案子數</p>
              <p className="text-2xl font-bold">{projects.length}</p>
            </div>
          </div>
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">已驗收</p>
              <p className="text-2xl font-bold">{projects.filter(p => p.is_accepted).length}</p>
            </div>
          </div>
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">已開立發票</p>
              <p className="text-2xl font-bold">{projects.filter(p => p.is_invoiced).length}</p>
            </div>
          </div>
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">
              <Receipt size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">已建PR單</p>
              <p className="text-2xl font-bold">{projects.filter(p => p.is_pr_created).length}</p>
            </div>
          </div>
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">未建PR單</p>
              <p className="text-2xl font-bold">{projects.filter(p => !p.is_pr_created).length}</p>
            </div>
          </div>
          <div className="glass-card p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">緊急PR</p>
              <p className="text-2xl font-bold">{projects.filter(p => p.is_urgent_pr).length}</p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="glass-card p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="搜尋案子名稱或廠商..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm transition-all"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase">篩選:</span>
            </div>
            
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">所有狀態</option>
              <option value="pending">待處理</option>
              <option value="in_progress">進行中</option>
              <option value="on_hold">暫緩</option>
              <option value="completed">已完成</option>
            </select>

            <select 
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">發票狀態 (全部)</option>
              <option value="invoiced">已開立發票</option>
              <option value="not_invoiced">未開立發票</option>
            </select>

            <select 
              value={prFilter}
              onChange={(e) => setPrFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">PR單狀態 (全部)</option>
              <option value="created">已建單</option>
              <option value="not_created">未建單</option>
            </select>

            <select 
              value={urgentPrFilter}
              onChange={(e) => setUrgentPrFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">緊急PR (全部)</option>
              <option value="urgent">緊急</option>
              <option value="not_urgent">一般</option>
            </select>

            <select 
              value={acceptanceFilter}
              onChange={(e) => setAcceptanceFilter(e.target.value)}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">驗收狀態 (全部)</option>
              <option value="accepted">已驗收</option>
              <option value="not_accepted">未驗收</option>
            </select>
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-5 group hover:border-indigo-200 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      {editingTitleId === project.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          onBlur={() => {
                            if (editingTitleValue.trim() && editingTitleValue !== project.title) {
                              updateProject(project.id, { title: editingTitleValue.trim() });
                            }
                            setEditingTitleId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingTitleValue.trim() && editingTitleValue !== project.title) {
                                updateProject(project.id, { title: editingTitleValue.trim() });
                              }
                              setEditingTitleId(null);
                            } else if (e.key === 'Escape') {
                              setEditingTitleId(null);
                            }
                          }}
                          className="text-lg font-bold text-slate-900 bg-white border border-indigo-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500/20 w-full max-w-xs"
                        />
                      ) : (
                        <h3 
                          className="text-lg font-bold text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors border-b border-transparent hover:border-indigo-300"
                          onClick={() => {
                            setEditingTitleId(project.id);
                            setEditingTitleValue(project.title);
                          }}
                          title="點擊以編輯名稱"
                        >
                          {project.title}
                        </h3>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                          {getStatusLabel(project.status)}
                        </span>
                        {project.is_urgent_pr && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold tracking-wider flex items-center gap-1 shadow-sm">
                            <AlertCircle size={10} />
                            緊急PR
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {editingDescId === project.id ? (
                      <div className="mt-2 mb-3">
                        <textarea
                          autoFocus
                          value={editingDescValue}
                          onChange={(e) => setEditingDescValue(e.target.value)}
                          onBlur={() => {
                            if (editingDescValue.trim() !== project.description) {
                              updateProject(project.id, { description: editingDescValue.trim() });
                            }
                            setEditingDescId(null);
                          }}
                          className="w-full text-sm text-slate-700 bg-white border border-indigo-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none min-h-[60px]"
                        />
                      </div>
                    ) : (
                      <p 
                        className="text-sm text-slate-500 cursor-pointer hover:text-indigo-600 hover:bg-indigo-50/50 p-1.5 -ml-1.5 rounded-lg transition-colors line-clamp-2"
                        onClick={() => {
                          setEditingDescId(project.id);
                          setEditingDescValue(project.description || '');
                        }}
                        title="點擊以編輯廠商"
                      >
                        {project.description || '無廠商 (點擊新增)'}
                      </p>
                    )}
                    
                    {/* Dates and Assignee */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-indigo-400" />
                        <span className="font-medium">開案:</span>
                        <input 
                          type="date" 
                          value={project.start_date || ''} 
                          onChange={(e) => updateProject(project.id, { start_date: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarCheck size={14} className="text-emerald-400" />
                        <span className="font-medium">驗收:</span>
                        <input 
                          type="date" 
                          value={project.acceptance_date || ''} 
                          onChange={(e) => updateProject(project.id, { acceptance_date: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-blue-400" />
                        <span className="font-medium">處理人:</span>
                        <input 
                          type="text" 
                          placeholder="未指定"
                          value={project.assignee || ''} 
                          onChange={(e) => updateProject(project.id, { assignee: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-indigo-500 cursor-text w-20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    {/* Progress */}
                    <div className="w-32">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">進度</span>
                        <span className="text-[11px] font-bold text-indigo-600">{project.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress}%` }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateProject(project.id, { is_pr_created: !project.is_pr_created })}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            project.is_pr_created 
                              ? 'bg-purple-50 border-purple-200 text-purple-700' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <Receipt size={14} />
                          <span className="text-xs font-bold">已建PR單</span>
                          {project.is_pr_created ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                      </div>

                      <button 
                        onClick={() => updateProject(project.id, { is_invoiced: !project.is_invoiced })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                          project.is_invoiced 
                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <FileText size={14} />
                        <span className="text-xs font-bold">已開立發票</span>
                        {project.is_invoiced ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </button>

                      <button 
                        onClick={() => updateProject(project.id, { is_accepted: !project.is_accepted })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                          project.is_accepted 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <ClipboardCheck size={14} />
                        <span className="text-xs font-bold">已驗收</span>
                        {project.is_accepted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <select 
                        value={project.status}
                        onChange={(e) => updateProject(project.id, { status: e.target.value as any })}
                        className="text-xs font-bold bg-slate-50 border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="pending">待處理</option>
                        <option value="in_progress">進行中</option>
                        <option value="on_hold">暫緩</option>
                        <option value="completed">已完成</option>
                      </select>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={project.progress}
                        onChange={(e) => updateProject(project.id, { progress: parseInt(e.target.value) })}
                        className="w-20 accent-indigo-600"
                      />
                      <button 
                        onClick={() => setProjectToDelete(project.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Milestones */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    <ListChecks size={14} />
                    <span>驗收階段 (例如: 80% 訂金 / 20% 尾款)</span>
                  </div>
                  
                  <div className="space-y-2">
                    {project.milestones?.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm group">
                        <span className="font-medium text-slate-700 flex-1">{m.name}</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={m.is_accepted} 
                              onChange={(e) => updateMilestone(project.id, m.id, { is_accepted: e.target.checked })}
                              className="w-4 h-4 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500"
                            />
                            <span className={`text-xs font-medium ${m.is_accepted ? 'text-emerald-600' : 'text-slate-400'}`}>已驗收</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={m.is_invoiced} 
                              onChange={(e) => updateMilestone(project.id, m.id, { is_invoiced: e.target.checked })}
                              className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500"
                            />
                            <span className={`text-xs font-medium ${m.is_invoiced ? 'text-blue-600' : 'text-slate-400'}`}>已請款</span>
                          </label>
                          <button 
                            onClick={() => deleteMilestone(project.id, m.id)} 
                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="刪除階段"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <input 
                        type="text" 
                        placeholder="新增階段 (例如: 80% 訂金)" 
                        className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addMilestone(project.id, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <button 
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          addMilestone(project.id, input.value);
                          input.value = '';
                        }}
                        className="bg-indigo-50 text-indigo-600 p-2 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="新增階段"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-start gap-2">
                    <StickyNote size={14} className="text-amber-500 mt-1 flex-shrink-0" />
                    <textarea
                      placeholder="新增備註..."
                      defaultValue={project.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== project.notes) {
                          updateProject(project.id, { notes: e.target.value });
                        }
                      }}
                      className="w-full text-sm bg-amber-50/30 border border-amber-100/50 rounded-lg p-2 outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-amber-50/50 resize-none min-h-[60px] text-slate-700 placeholder-slate-400 transition-all"
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Paperclip size={14} />
                      <span>附件檔案</span>
                    </div>
                    <label className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95">
                      <Plus size={12} />
                      <span>上傳檔案</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => handleFileUpload(project.id, e)}
                      />
                    </label>
                  </div>
                  
                  {project.files && project.files.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {project.files.map(file => (
                        <div key={file.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs group">
                          <button 
                            onClick={() => handleFileDownload(file.id, file.name)}
                            className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 truncate max-w-[200px]"
                            title={file.name}
                          >
                            <FileText size={12} className="text-slate-400 group-hover:text-indigo-500" />
                            <span className="truncate">{file.name}</span>
                          </button>
                          <button 
                            onClick={() => handleFileDelete(project.id, file.id)}
                            className="text-slate-400 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="刪除檔案"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">尚無附件</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredProjects.length === 0 && !loading && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                {projects.length === 0 ? <Clock size={32} /> : <Search size={32} />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {projects.length === 0 ? '尚無案子' : '找不到符合條件的案子'}
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                {projects.length === 0 
                  ? '點擊上方按鈕開始新增您的第一個案子' 
                  : '請嘗試調整搜尋關鍵字或篩選條件'}
              </p>
              {projects.length === 0 ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="text-indigo-600 font-bold text-sm hover:underline"
                >
                  立即新增案子
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setInvoiceFilter('all');
                    setAcceptanceFilter('all');
                    setPrFilter('all');
                  }}
                  className="text-indigo-600 font-bold text-sm hover:underline"
                >
                  清除所有篩選條件
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">新增案子</h2>
                <form onSubmit={addProject} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">案子名稱</label>
                    <input 
                      autoFocus
                      type="text" 
                      required
                      placeholder="例如：網站重新設計專案"
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">廠商 (選填)</label>
                    <textarea 
                      placeholder="輸入廠商名稱..."
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all h-24 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">開案日期</label>
                      <input 
                        type="date" 
                        value={newProject.start_date}
                        onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">處理人 (選填)</label>
                      <input 
                        type="text" 
                        placeholder="輸入處理人姓名..."
                        value={newProject.assignee}
                        onChange={(e) => setNewProject({ ...newProject, assignee: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center mt-2 col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newProject.is_urgent_pr}
                          onChange={(e) => setNewProject({ ...newProject, is_urgent_pr: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-300 text-red-500 focus:ring-red-500/20"
                        />
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                          <AlertCircle size={16} className="text-red-500" />
                          標記為緊急PR
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">備註 (選填)</label>
                    <textarea 
                      placeholder="新增備註..."
                      value={newProject.notes}
                      onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all h-20 resize-none bg-amber-50/30"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                      新增案子
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProjectToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">確定要刪除此案子嗎？</h2>
              <p className="text-slate-500 text-sm mb-6">
                刪除後將無法復原，請確認是否繼續。
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200 active:scale-95"
                >
                  確認刪除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
