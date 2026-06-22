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
  const [productLibrary, setProductLibrary] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');

  const defaultCategory = 'Dining Tables';
  
  const [formData, setFormData] = useState({
    category: defaultCategory, sku: '', name: '', image_base64: '', notes: '', inspiration: '',
    dimLength: '', dimWidth: '', dimHeight: '',
    woodTypeId: '', woodCft: '', plywoodType: 'None', plywoodQty: '',
    labourHours: '', labourRate: '', finishingTypeId: '', hardwareCost: '',
    fabricMeters: '', fabricRate: '', foamCost: '', packagingCost: '',
    overheadsPercent: ''
  });

  // --- ROLE BASED ACCESS CONTROL ---
  const ADMIN_EMAILS = ['your@email.com', 'admin@company.com']; 
  const userEmail = session?.user?.email || '';
  const isFreelancer = session && !ADMIN_EMAILS.includes(userEmail);

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
      const { data: products } = await supabase.from('product_master').select('*').order('modified_at', { ascending: false });

      if (settings) setGlobalSettings(settings);
      if (woods) setWoodMaster(woods);
      if (finishes) setFinishingMaster(finishes);
      if (products) setProductLibrary(products);

      if (!formData.sku && products) {
        handleResetForm(products, settings, woods, finishes);
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

  const handleResetForm = (library = productLibrary, settings = globalSettings, woods = woodMaster, finishes = finishingMaster) => {
    setFormData({
      category: defaultCategory,
      sku: generateNextSKU(defaultCategory, library),
      name: '', image_base64: '', notes: '', inspiration: '',
      dimLength: '', dimWidth: '', dimHeight: '',
      woodTypeId: woods?.[0]?.id || '', woodCft: '', 
      plywoodType: 'None', plywoodQty: '',
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
      plywood_type: formData.plywoodType, plywood_qty: parseFloat(formData.plywoodQty) || 0,
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
      plywoodType: product.plywood_type || 'None', plywoodQty: product.plywood_qty || '',
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
      plywoodType: product.plywood_type || 'None', plywoodQty: product.plywood_qty || '',
      labourHours: product.labour_hours || '', labourRate: product.labour_rate || globalSettings?.labour_rate || '',
      finishingTypeId: product.finishing_type_id || finishingMaster?.[0]?.id || '', hardwareCost: product.hardware_cost || '',
      fabricMeters: product.fabric_meters || '', fabricRate: product.fabric_rate || '',
      foamCost: product.foam_cost || '', packagingCost: product.packaging_cost || '',
      overheadsPercent: product.overheads_percent || globalSettings?.overheads_percent || ''
    });
    setActiveView('workspace');
  };

  const handleDeleteProduct = async (sku) => {
    if (window.confirm(`Are you absolutely sure you want to permanently delete ${sku}?`)) {
      const { error } = await supabase.from('product_master').delete().eq('sku', sku);
      if (error) alert("Error deleting product: " + error.message);
      else fetchAllMasterData();
    }
  };

  // --- FILTER & GROUP LOGIC FOR LIBRARY ---
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

  // --- RENDER GATES ---
  if (authLoading) return <div className="flex items-center justify-center bg-[#f4f1eb] min-h-screen"><p>Loading security profile...</p></div>;
  if (!session) return <Login />;
  if (!globalSettings || dataLoading) return <div className="flex flex-col items-center justify-center bg-[#f4f1eb] min-h-screen text-center"><p className="text-sm font-medium text-[#746b61]">Syncing with Cloud Engine tables...</p></div>;

  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <header className="flex items-center justify-between bg-white border-b border-[#e1d8cd] px-8 py-3 sticky top-0 z-20 shadow-sm">
        <div>
          <img src="/Logo_1600x900.jpeg" alt="Arovan Logo" className="h-12 object-contain mb-1" />
          <p className="text-[10px] text-[#746b61] font-medium uppercase tracking-wider">Product Master & Costing Engine</p>
        </div>
        <div className="flex gap-2 items-center">
          {!isFreelancer && (
            <>
              <button onClick={() => setActiveView('workspace')} className={`px-4 py-2 text-xs font-semibold uppercase rounded-md transition ${activeView === 'workspace' ? 'bg-[#171512] text-white' : 'text-[#746b61]'}`}>Workspace</button>
              <button onClick={() => setActiveView('library')} className={`px-4 py-2 text-xs font-semibold uppercase rounded-md transition ${activeView === 'library' ? 'bg-[#171512] text-white' : 'text-[#746b61]'}`}>Library ({productLibrary.length})</button>
              <button onClick={() => setActiveView('settings')} className={`px-4 py-2 text-xs font-semibold uppercase rounded-md transition ${activeView === 'settings' ? 'bg-[#171512] text-white' : 'text-[#746b61]'}`}>⚙️ Settings</button>
            </>
          )}
          {isFreelancer && <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded mr-2 border border-blue-100">Contractor Access</span>}
          <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 border border-[#dcd3c9] text-xs font-semibold uppercase rounded-md hover:bg-red-50 hover:text-red-600 transition ml-2">Logout</button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6">
        {activeView === 'workspace' && !isFreelancer && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="col-span-1 lg:col-span-2">
              <CostingForm formData={formData} setFormData={setFormData} woodMaster={woodMaster} finishingMaster={finishingMaster} onCategoryChange={handleCategoryChange} />
            </div>
            <div className="col-span-1">
              <CostingSummary formData={formData} globalSettings={globalSettings} woodMaster={woodMaster} finishingMaster={finishingMaster} onSave={handleSaveProduct} onReset={() => handleResetForm()} />
            </div>
          </div>
        )}

        {activeView === 'library' && (
          <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
            
            {/* Library Header & Search Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h2 className="text-lg font-medium text-gray-800">Product Library</h2>
                <p className="text-xs text-[#746b61]">Organized by category. Total items: {filteredLibrary.length}</p>
              </div>
              <div className="w-full sm:w-72">
                <input 
                  type="text" 
                  placeholder="🔍 Search by SKU or Name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-2.5 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb] focus:outline-none focus:border-[#171512]"
                />
              </div>
            </div>

            {Object.keys(groupedLibrary).length === 0 ? (
              <p className="text-gray-500 text-center py-10">No products match your search.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(groupedLibrary).map(([category, items]) => (
                  
                  /* Category Accordion Container */
                  <details key={category} className="group border border-[#e1d8cd] rounded-lg bg-white overflow-hidden">
                    <summary className="flex justify-between items-center cursor-pointer p-4 bg-[#fdfcfb] hover:bg-[#f4f1eb] transition font-medium text-[#171512] list-none">
                      <span className="flex items-center gap-2">
                        <span className="text-[#746b61] group-open:rotate-90 transition-transform">▶</span>
                        {category} <span className="text-xs text-[#8c8378] ml-2">({items.length} items)</span>
                      </span>
                    </summary>
                    
                    {/* Grid of Products inside Accordion */}
                    <div className="p-5 bg-white border-t border-[#e1d8cd]">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                        {items.map(item => {
                          const woodName = woodMaster.find(w => w.id === item.wood_type_id)?.name || 'Custom Wood';
                          const dateModified = new Date(item.modified_at).toLocaleDateString();

                          return (
                            <div key={item.sku} className="bg-white border border-[#e1d8cd] rounded-lg overflow-hidden hover:shadow-md transition flex flex-col group/card h-full">
                              
                              <div className="w-full h-48 bg-[#faf9f6] relative border-b border-[#e1d8cd] shrink-0">
                                {item.image_base64 ? (
                                  <img src={item.image_base64} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-[#8c8378]">
                                    <span className="text-2xl opacity-50 mb-1">🛋️</span>
                                    <span className="text-[10px] font-medium uppercase tracking-wider">No Photo</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-4 flex-1 flex flex-col bg-white">
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold bg-[#171512] px-2 py-0.5 rounded text-white tracking-wider">{item.sku}</span>
                                    <span className="text-sm font-bold text-[#171512]">₹{item.estimated_selling_price?.toLocaleString()}</span>
                                  </div>
                                  <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-tight">{item.name}</h3>
                                  
                                  {/* Marketing Tagline */}
                                  {item.notes && (
                                    <p className="text-xs text-[#746b61] italic line-clamp-2 mb-2">{item.notes}</p>
                                  )}
                                  
                                  <p className="text-[11px] text-[#8c8378]">{woodName}</p>
                                  
                                  {/* Expandable Story Tag */}
                                  {item.inspiration && (
                                    <details className="mt-3 text-xs text-[#746b61] group/story">
                                      <summary className="cursor-pointer font-semibold underline decoration-[#dcd3c9] underline-offset-2 hover:text-[#171512] list-none">
                                        <span className="group-open/story:hidden">Read Story</span>
                                        <span className="hidden group-open/story:inline">Close Story</span>
                                      </summary>
                                      <div className="mt-2 p-3 bg-[#fdfcfb] rounded border border-[#e1d8cd] whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {item.inspiration}
                                      </div>
                                    </details>
                                  )}
                                </div>
                                
                                <div className="mt-4 pt-3 border-t border-[#f0e9df] flex items-center justify-between shrink-0">
                                  <span className="text-[9px] text-[#8c8378] uppercase tracking-wider">Upd: {dateModified}</span>
                                  {!isFreelancer && (
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditProduct(item)} className="text-[10px] font-bold text-[#746b61] hover:text-[#171512] transition uppercase">Edit</button>
                                      <button onClick={() => handleDuplicateProduct(item)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition uppercase ml-1">Dup</button>
                                      <button onClick={() => handleDeleteProduct(item.sku)} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition uppercase ml-2">Del</button>
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
          <Settings globalSettings={globalSettings} woodMaster={woodMaster} finishingMaster={finishingMaster} refreshData={fetchAllMasterData} />
        )}
      </main>
    </div>
  );
}