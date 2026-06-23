'use client';
import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Login from './components/Login';
import CostingForm from './components/CostingForm';
import CostingSummary from './components/CostingSummary';
import Settings from './components/Settings';

export default function Home() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [activeView, setActiveView] = useState('workspace');
  const [globalSettings, setGlobalSettings] = useState(null);
  const [woodMaster, setWoodMaster] = useState([]);
  const [finishingMaster, setFinishingMaster] = useState([]);
  const [plywoodMaster, setPlywoodMaster] = useState([]);
  const [productLibrary, setProductLibrary] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');

  const defaultCategory = 'Dining Tables';
  
  const [formData, setFormData] = useState({
    category: defaultCategory, sku: '', name: '', image_base64: '', notes: '', inspiration: '',
    dimLength: '', dimWidth: '', dimHeight: '',
    woodTypeId: '', woodCft: '', plywoodTypeId: '', plywoodQty: '',
    labourHours: '', labourRate: '', finishingTypeId: '', hardwareCost: '',
    fabricMeters: '', fabricRate: '', foamCost: '', packagingCost: '',
    overheadsPercent: ''
  });

  // --- ROLE BASED ACCESS CONTROL (WITH HARDCODED ADMIN EMAIL) ---
  const ADMIN_EMAILS = ['arovan011@gmail.com']; 
  const userEmail = session?.user?.email?.toLowerCase() || '';
  const isFreelancer = session && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(userEmail);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isFreelancer && activeView !== 'library') {
      setActiveView('library');
    }
  }, [isFreelancer, activeView]);

  useEffect(() => {
    if (session) {
      fetchAllMasterData();
    }
  }, [session]);

  const fetchAllMasterData = async () => {
    setDataLoading(true);
    try {
      const { data: settings } = await supabase.from('global_settings').select('*').single();
      const { data: woods } = await supabase.from('wood_master').select('*').order('name');
      const { data: finishes } = await supabase.from('finishing_master').select('*').order('name');
      const { data: plywoods } = await supabase.from('plywood_master').select('*').order('name');
      const { data: products } = await supabase.from('product_master').select('*').order('modified_at', { ascending: false });

      if (settings) setGlobalSettings(settings);
      if (woods) setWoodMaster(woods);
      if (finishes) setFinishingMaster(finishes);
      if (plywoods) setPlywoodMaster(plywoods);
      if (products) setProductLibrary(products);

      if (!formData.sku && products) {
        handleResetForm(products, settings, woods, finishes, plywoods);
      }
    } catch (err) {
      console.error("Error reading database tables:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const getCategoryPrefix = (category) => {
    const map = {
      'Dining Tables': 'DT', 'Center Tables': 'CT', 'Console Tables': 'CON',
      'Nesting Table': 'NST', 'End Tables': 'ET', 'Benches': 'BEN',
      'Sofas': 'SOF', 'Chairs': 'CHR', 'High Stools': 'HST', 'Beds': 'BED', 'Custom': 'CUS'
    };
    return map[category] || 'CUS';
  };

  const generateNextSKU = (category, currentLibrary = productLibrary) => {
    const prefix = getCategoryPrefix(category);
    const existingIds = currentLibrary
      .filter(p => p.sku && p.sku.startsWith(prefix + '-'))
      .map(p => parseInt(p.sku.replace(prefix + '-', '')) || 0);
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `${prefix}-${nextId.toString().padStart(3, '0')}`;
  };

  const handleCategoryChange = (newCategory) => {
    const newSku = generateNextSKU(newCategory);
    setFormData(prev => ({ ...prev, sku: newSku, category: newCategory }));
  };

  const handleResetForm = (library = productLibrary, settings = globalSettings, woods = woodMaster, finishes = finishingMaster, plywoods = plywoodMaster) => {
    setFormData({
      category: defaultCategory,
      sku: generateNextSKU(defaultCategory, library),
      name: '', image_base64: '', notes: '', inspiration: '',
      dimLength: '', dimWidth: '', dimHeight: '',
      woodTypeId: woods?.[0]?.id || '', woodCft: '', 
      plywoodTypeId: plywoods?.[0]?.id || '', plywoodQty: '',
      labourHours: '', labourRate: settings?.labour_rate || '', 
      finishingTypeId: finishes?.[0]?.id || '', hardwareCost: '',
      fabricMeters: '', fabricRate: '', foamCost: '', packagingCost: '',
      overheadsPercent: settings?.overheads_percent || ''
    });
  };

  const handleSaveProduct = async (calculatedMfgCost, calculatedSellPrice) => {
    if (!formData.sku || !formData.name) {
      alert("Please enter a SKU and Product Name before saving.");
      return;
    }

    const isExisting = productLibrary.find(p => p.sku === formData.sku);
    if (isExisting) {
      if (!window.confirm(`SKU ${formData.sku} already exists in the library. Do you want to overwrite it with these new details?`)) return;
    }

    const payload = {
      sku: formData.sku, category: formData.category, name: formData.name,
      image_base64: formData.image_base64 || null, 
      notes: formData.notes || null, 
      inspiration: formData.inspiration || null,
      dim_length: parseFloat(formData.dimLength) || null, dim_width: parseFloat(formData.dimWidth) || null, dim_height: parseFloat(formData.dimHeight) || null,
      wood_type_id: parseInt(formData.woodTypeId) || null, wood_cft: parseFloat(formData.woodCft) || 0,
      plywood_type_id: parseInt(formData.plywoodTypeId) || null, plywood_qty: parseFloat(formData.plywoodQty) || 0,
      labour_hours: parseFloat(formData.labourHours) || 0, labour_rate: parseInt(formData.labourRate) || 0,
      hardware_cost: parseFloat(formData.hardwareCost) || 0, finishing_type_id: parseInt(formData.finishingTypeId) || null,
      fabric_meters: parseFloat(formData.fabricMeters) || 0, fabric_rate: parseFloat(formData.fabricRate) || 0,
      foam_cost: parseFloat(formData.foamCost) || 0, packaging_cost: parseFloat(formData.packagingCost) || 0,
      overheads_percent: parseFloat(formData.overheadsPercent) || 0,
      total_manufacturing_cost: calculatedMfgCost, estimated_selling_price: calculatedSellPrice,
      modified_at: new Date().toISOString()
    };

    const { error } = await supabase.from('product_master').upsert(payload);

    if (error) {
      alert("Error saving to cloud: " + error.message);
    } else {
      alert(`Product ${formData.sku} successfully saved!`);
      fetchAllMasterData(); 
    }
  };

  const handleEditProduct = (product) => {
    setFormData({
      category: product.category || 'Dining Tables', sku: product.sku || '', name: product.name || '',
      image_base64: product.image_base64 || '', notes: product.notes || '', inspiration: product.inspiration || '',
      dimLength: product.dim_length || '', dimWidth: product.dim_width || '', dimHeight: product.dim_height || '',
      woodTypeId: product.wood_type_id || woodMaster?.[0]?.id || '', woodCft: product.wood_cft || '',
      plywoodTypeId: product.plywood_type_id || plywoodMaster?.[0]?.id || '', plywoodQty: product.plywood_qty || '',
      labourHours: product.labour_hours || '', labourRate: product.labour_rate || globalSettings?.labour_rate || '',
      finishingTypeId: product.finishing_type_id || finishingMaster?.[0]?.id || '', hardwareCost: product.hardware_cost || '',
      fabricMeters: product.fabric_meters || '', fabricRate: product.fabric_rate || '',
      foamCost: product.foam_cost || '', packagingCost: product.packaging_cost || '',
      overheadsPercent: product.overheads_percent || globalSettings?.overheads_percent || ''
    });
    setActiveView('workspace');
  };

  const handleDuplicateProduct = (product) => {
    const newSku = generateNextSKU(product.category || 'Dining Tables');
    setFormData({
      category: product.category || 'Dining Tables', sku: newSku, name: product.name || '',
      image_base64: product.image_base64 || '', notes: product.notes || '', inspiration: product.inspiration || '',
      dimLength: product.dim_length || '', dimWidth: product.dim_width || '', dimHeight: product.dim_height || '',
      woodTypeId: product.wood_type_id || woodMaster?.[0]?.id || '', woodCft: product.wood_cft || '',
      plywoodTypeId: product.plywood_type_id || plywoodMaster?.[0]?.id || '', plywoodQty: product.plywood_qty || '',
      labourHours: product.labour_hours || '', labourRate: product.labour_rate || globalSettings?.labour_rate || '',
      finishingTypeId: product.finishing_type_id || finishingMaster?.[0]?.id || '', hardwareCost: product.hardware_cost || '',
      fabricMeters: product.fabric_meters || '', fabricRate: product.fabric_rate || '',
      foamCost: product.foam_cost || '', packagingCost: product.packaging_cost || '',
      overheadsPercent: product.overheads_percent || globalSettings?.overheads_percent || ''
    });
    setActiveView('workspace');
  };

  const handleDeleteProduct = async (sku, imageUrl) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete ${sku}?`)) {
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('product-images').remove([fileName]);
        }
      }
      const { error } = await supabase.from('product_master').delete().eq('sku', sku);
      if (error) alert("Error deleting product: " + error.message);
      else fetchAllMasterData();
    }
  };

  const filteredLibrary = productLibrary.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedLibrary = filteredLibrary.reduce((groups, product) => {
    const category = product.category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(product);
    return groups;
  }, {});

  if (authLoading) return <div className="flex items-center justify-center bg-[#f4f1eb] min-h-screen"><p>Loading security profile...</p></div>;
  if (!session) return <Login />;
  if (!globalSettings || dataLoading) return <div className="flex flex-col items-center justify-center bg-[#f4f1eb] min-h-screen text-center"><p className="text-sm font-medium text-[#746b61]">Syncing with Cloud Engine tables...</p></div>;

  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <header className="bg-white border-b border-[#e1d8cd] sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-4 sm:gap-6">
              <img src="/Logo_1600x900.jpeg" alt="Arovan Logo" className="h-8 sm:h-12 object-contain" />
              <div className="hidden sm:block h-8 w-px bg-[#e1d8cd]"></div>
              <p className="hidden sm:block text-[11px] font-bold text-[#746b61] uppercase tracking-[0.2em] mt-1">
                Product Master Engine
              </p>
            </div>

            <div className="hidden md:flex items-center h-full">
              <nav className="flex h-full mr-8 gap-2">
                {!isFreelancer && (
                  <>
                    <button onClick={() => setActiveView('workspace')} className={`px-4 text-xs font-bold uppercase tracking-widest h-full border-b-2 transition-colors flex items-center ${activeView === 'workspace' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#8c8378] hover:text-[#171512]'}`}>Workspace</button>
                    <button onClick={() => setActiveView('library')} className={`px-4 text-xs font-bold uppercase tracking-widest h-full border-b-2 transition-colors flex items-center ${activeView === 'library' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#8c8378] hover:text-[#171512]'}`}>Library ({productLibrary.length})</button>
                    <button onClick={() => setActiveView('settings')} className={`px-4 text-xs font-bold uppercase tracking-widest h-full border-b-2 transition-colors flex items-center gap-2 ${activeView === 'settings' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#8c8378] hover:text-[#171512]'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      Settings
                    </button>
                  </>
                )}
              </nav>
              
              <div className="flex items-center pl-8 border-l border-[#e1d8cd] h-8">
                {isFreelancer && <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-sm mr-4 border border-blue-100">Contractor</span>}
                <button onClick={() => supabase.auth.signOut()} className="text-[11px] font-bold text-[#8c8378] hover:text-red-600 uppercase tracking-widest transition-colors">Sign Out</button>
              </div>
            </div>

            <div className="md:hidden flex items-center gap-3">
               {isFreelancer && <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-sm border border-blue-100">Contractor</span>}
               <button onClick={() => supabase.auth.signOut()} className="text-[10px] font-bold text-[#8c8378] hover:text-red-600 uppercase tracking-widest">Sign Out</button>
            </div>
          </div>

          {!isFreelancer && (
            <div className="md:hidden flex items-center overflow-x-auto no-scrollbar gap-2 pb-3 pt-1">
              <button onClick={() => setActiveView('workspace')} className={`whitespace-nowrap px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${activeView === 'workspace' ? 'bg-[#171512] text-white' : 'bg-[#f4f1eb] text-[#746b61]'}`}>Workspace</button>
              <button onClick={() => setActiveView('library')} className={`whitespace-nowrap px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors ${activeView === 'library' ? 'bg-[#171512] text-white' : 'bg-[#f4f1eb] text-[#746b61]'}`}>Library ({productLibrary.length})</button>
              <button onClick={() => setActiveView('settings')} className={`whitespace-nowrap px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors flex items-center gap-1.5 ${activeView === 'settings' ? 'bg-[#171512] text-white' : 'bg-[#f4f1eb] text-[#746b61]'}`}>Settings</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'workspace' && !isFreelancer && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
            <div className="col-span-1 lg:col-span-2">
              <CostingForm formData={formData} setFormData={setFormData} woodMaster={woodMaster} finishingMaster={finishingMaster} plywoodMaster={plywoodMaster} onCategoryChange={handleCategoryChange} />
            </div>
            <div className="col-span-1">
              <CostingSummary formData={formData} globalSettings={globalSettings} woodMaster={woodMaster} finishingMaster={finishingMaster} plywoodMaster={plywoodMaster} onSave={handleSaveProduct} onReset={() => handleResetForm()} />
            </div>
          </div>
        )}

        {activeView === 'library' && (
          <div className="bg-white p-6 lg:p-8 rounded-xl border border-[#e1d8cd] shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-xl font-medium text-gray-900">Product Library</h2>
                <p className="text-xs text-[#746b61] mt-1">Organized by category. Total items: {filteredLibrary.length}</p>
              </div>
              <div className="w-full sm:w-80">
                <input type="text" placeholder="🔍 Search by SKU or Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-3 border border-[#dcd3c9] rounded-lg text-sm bg-[#fdfcfb] focus:outline-none focus:border-[#171512] focus:ring-1 focus:ring-[#171512] transition-shadow" />
              </div>
            </div>

            {Object.keys(groupedLibrary).length === 0 ? (
              <p className="text-gray-500 text-center py-12 bg-[#faf9f6] rounded-lg border border-dashed border-[#dcd3c9]">No products match your search.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(groupedLibrary).map(([category, items]) => (
                  <details key={category} open className="group border border-[#e1d8cd] rounded-xl bg-white overflow-hidden shadow-sm">
                    <summary className="flex justify-between items-center cursor-pointer p-5 bg-[#fdfcfb] hover:bg-[#f4f1eb] transition-colors font-medium text-[#171512] list-none select-none">
                      <span className="flex items-center gap-3">
                        <span className="text-[#746b61] group-open:rotate-90 transition-transform duration-200">▶</span>
                        <span className="text-sm uppercase tracking-widest">{category}</span> 
                        <span className="text-xs font-semibold text-[#8c8378] ml-2 bg-white px-2 py-0.5 rounded border border-[#e1d8cd]">{items.length}</span>
                      </span>
                    </summary>
                    <div className="p-5 lg:p-6 bg-white border-t border-[#e1d8cd]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {items.map(item => {
                          const woodName = woodMaster.find(w => w.id === item.wood_type_id)?.name || 'Custom Wood';
                          const dateModified = new Date(item.modified_at).toLocaleDateString();

                          return (
                            <div key={item.sku} className="bg-white border border-[#e1d8cd] rounded-xl overflow-hidden hover:shadow-md hover:border-[#dcd3c9] transition-all duration-200 flex flex-col group/card h-full">
                              <div className="w-full h-52 bg-[#faf9f6] relative border-b border-[#e1d8cd] shrink-0">
                                {item.image_base64 ? (
                                  <img src={item.image_base64} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-[#8c8378]">
                                    <span className="text-3xl opacity-40 mb-2">🛋️</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">No Photo</span>
                                  </div>
                                )}
                              </div>
                              <div className="p-5 flex-1 flex flex-col bg-white">
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] font-bold bg-[#171512] px-2.5 py-1 rounded text-white tracking-widest">{item.sku}</span>
                                    <span className="text-sm font-bold text-[#171512]">₹{item.estimated_selling_price?.toLocaleString()}</span>
                                  </div>
                                  <h3 className="font-semibold text-gray-900 text-sm mb-1.5 leading-tight">{item.name}</h3>
                                  {item.notes && <p className="text-xs text-[#746b61] italic line-clamp-2 mb-3 leading-relaxed">{item.notes}</p>}
                                  <p className="text-[11px] font-medium text-[#8c8378]">{woodName}</p>
                                  {item.inspiration && (
                                    <details className="mt-4 text-xs text-[#746b61] group/story">
                                      <summary className="cursor-pointer font-bold uppercase tracking-wider underline decoration-[#dcd3c9] underline-offset-4 hover:text-[#171512] transition-colors list-none">
                                        <span className="group-open/story:hidden">Read Story</span>
                                        <span className="hidden group-open/story:inline">Close Story</span>
                                      </summary>
                                      <div className="mt-3 p-3.5 bg-[#faf9f6] rounded-md border border-[#e1d8cd] whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {item.inspiration}
                                      </div>
                                    </details>
                                  )}
                                </div>
                                <div className="mt-5 pt-4 border-t border-[#f0e9df] flex items-center justify-between shrink-0">
                                  <span className="text-[9px] font-semibold text-[#8c8378] uppercase tracking-widest">Upd: {dateModified}</span>
                                  {!isFreelancer && (
                                    <div className="flex gap-3">
                                      <button onClick={() => handleEditProduct(item)} className="text-[10px] font-bold text-[#746b61] hover:text-[#171512] transition-colors uppercase tracking-wider">Edit</button>
                                      <button onClick={() => handleDuplicateProduct(item)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors uppercase tracking-wider">Dup</button>
                                      <button onClick={() => handleDeleteProduct(item.sku, item.image_base64)} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors uppercase tracking-wider">Del</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'settings' && !isFreelancer && (
          <Settings globalSettings={globalSettings} woodMaster={woodMaster} finishingMaster={finishingMaster} plywoodMaster={plywoodMaster} refreshData={fetchAllMasterData} />
        )}
      </main>
    </div>
  );
}