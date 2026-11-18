'use client';
import { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import Login from './components/Login';
import CostingForm from './components/CostingForm';
import CostingSummary from './components/CostingSummary';
import Settings from './components/Settings';

const CATEGORY_PREFIXES = {
  'Dining Tables': 'DT',
  'Center Tables': 'CT',
  'Console Tables': 'CON',
  'Nesting Table': 'NT',
  'End Tables': 'ET',
  'Benches': 'BNC',
  'Sofas': 'SOF',
  'Chairs': 'CHR',
  'High Stools': 'HST',
  'Beds': 'BED',
  'Custom': 'CUS'
};

// ROLE-BASED ACCESS LISTS (Lowercase)
const ADMIN_EMAILS = ['arovan011@gmail.com'];
const FREELANCER_EMAILS = ['freelancer@arovan.com'];

// Helper: Convert whole inches into compact Ft + In string (e.g., 72 -> 6'0" or 66 -> 5'6")
const toFtInLabel = (val, axis) => {
  const totalIn = Math.round(Number(val) || 0);
  if (!totalIn) return null;
  const ft = Math.floor(totalIn / 12);
  const inc = totalIn % 12;
  const ftInStr = ft > 0 ? (inc > 0 ? `${ft}'${inc}"` : `${ft}'`) : `${inc}"`;
  return `${ftInStr}${axis}`;
};

export default function Home() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Master States
  const [activeView, setActiveView] = useState('workspace');
  const [woodMaster, setWoodMaster] = useState([]);
  const [addonsMaster, setAddonsMaster] = useState([]);
  const [productLibrary, setProductLibrary] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  // Library UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState({});
  const [editingSku, setEditingSku] = useState(null);

  // Admin Presentation Toggle ("Client View") & Per-Product Reveal Map
  const [clientViewMode, setClientViewMode] = useState(false);
  const [revealedPrices, setRevealedPrices] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    category: 'Dining Tables',
    sku: '',
    name: '',
    image_base64: '',
    notes: '',
    inspiration: '',
    dimLength: '',
    dimWidth: '',
    dimHeight: '',
    woodTypeId: '',
    woodCft: '',
    multiplier: '',
    rattanSqft: '',
    cushionQty: '',
    packagingCost: '',
    addons: []
  });

  // Determine User Role
  const userEmail = session?.user?.email?.toLowerCase() || '';
  const isAdmin = ADMIN_EMAILS.includes(userEmail);
  const isFreelancer = FREELANCER_EMAILS.includes(userEmail);
  const isShowroom = session && !isAdmin && !isFreelancer;

  // Hide prices by default for Showroom users OR when Admin toggles Client View ON
  const defaultHidePrices = isShowroom || (isAdmin && clientViewMode);

  // 1. MONITOR AUTH SESSION
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

  // Force non-admins into Library view
  useEffect(() => {
    if (session && !isAdmin) {
      setActiveView('library');
    }
  }, [session, isAdmin]);

  // 2. FETCH MASTER DATA
  useEffect(() => {
    if (session) {
      fetchAllMasterData();
    }
  }, [session]);

  const generateSmartSku = (category, existingProducts = productLibrary) => {
    const prefix = CATEGORY_PREFIXES[category] || 'PRD';
    const matchingNumbers = existingProducts
      .map(p => p.sku)
      .filter(sku => sku && sku.startsWith(`${prefix}-`))
      .map(sku => parseInt(sku.replace(`${prefix}-`, ''), 10))
      .filter(num => !isNaN(num));

    const nextNum = matchingNumbers.length > 0 ? Math.max(...matchingNumbers) + 1 : 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  };

  const fetchAllMasterData = async () => {
    setDataLoading(true);
    try {
      const [woodsRes, addonsRes, productsRes] = await Promise.all([
        supabase.from('wood_master').select('*').order('name'),
        supabase.from('addons_master').select('*').order('id'),
        supabase.from('product_master').select('*').order('modified_at', { ascending: false })
      ]);

      const woods = woodsRes.data || [];
      const addons = addonsRes.data || [];
      const products = productsRes.data || [];

      setWoodMaster(woods);
      setAddonsMaster(addons);
      setProductLibrary(products);
      setLastSyncTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );

      setFormData(prev => ({
        ...prev,
        woodTypeId: prev.woodTypeId || woods[0]?.id || '',
        sku: prev.sku || generateSmartSku(prev.category, products)
      }));
    } catch (err) {
      console.error('Error fetching master data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // --- LIVE DYNAMIC ERP PRICE CALCULATOR ---
  const calculateDynamicPrice = (product) => {
    const cft = parseFloat(product.wood_cft) || 0;
    const mult = parseFloat(product.multiplier) || 0;
    const baseWoodCost = cft * mult;

    const rattanMaster = addonsMaster.find(a => a.name.toLowerCase() === 'rattan');
    const cushionMaster = addonsMaster.find(a => a.name.toLowerCase().includes('cushion'));

    const rattanCost = (parseFloat(product.rattan_sqft) || 0) * (rattanMaster?.rate || 0);
    const cushionCost = (parseFloat(product.cushion_qty) || 0) * (cushionMaster?.rate || 0);

    const miscList = Array.isArray(product.addons) ? product.addons : [];
    const miscCost = miscList.reduce((sum, item) => {
      const master = addonsMaster.find(a => a.id === item.addon_id);
      return sum + (parseFloat(item.qty) || 0) * (master?.rate || 0);
    }, 0);

    const packagingCost = parseFloat(product.packaging_cost) || 0;

    const rawTotal = baseWoodCost + rattanCost + cushionCost + miscCost + packagingCost;
    return rawTotal > 0 ? Math.ceil(rawTotal / 1000) * 1000 : 0;
  };

  // --- FORM ACTIONS ---
  const handleCategoryChange = (newCategory) => {
    if (!editingSku) {
      setFormData(prev => ({
        ...prev,
        category: newCategory,
        sku: generateSmartSku(newCategory)
      }));
    }
  };

  const handleResetForm = () => {
    setEditingSku(null);
    const defaultCat = 'Dining Tables';
    setFormData({
      category: defaultCat,
      sku: generateSmartSku(defaultCat),
      name: '',
      image_base64: '',
      notes: '',
      inspiration: '',
      dimLength: '',
      dimWidth: '',
      dimHeight: '',
      woodTypeId: woodMaster[0]?.id || '',
      woodCft: '',
      multiplier: '',
      rattanSqft: '',
      cushionQty: '',
      packagingCost: '',
      addons: []
    });
  };

  const handleSaveProduct = async (calculatedSellPrice) => {
    const cleanSku = formData.sku.trim().toUpperCase();
    if (!cleanSku || !formData.name.trim()) {
      alert('Please enter both a SKU and a Product Name before saving.');
      return;
    }

    const skuExists = productLibrary.some(p => p.sku === cleanSku);
    if (skuExists && editingSku !== cleanSku) {
      alert(`SKU "${cleanSku}" already exists in the Library. Please use a unique SKU.`);
      return;
    }

    const payload = {
      sku: cleanSku,
      category: formData.category,
      name: formData.name.trim(),
      image_base64: formData.image_base64 || null,
      notes: formData.notes.trim(),
      inspiration: formData.inspiration.trim(),
      dim_length: formData.dimLength ? Math.round(parseFloat(formData.dimLength)) : null,
      dim_width: formData.dimWidth ? Math.round(parseFloat(formData.dimWidth)) : null,
      dim_height: formData.dimHeight ? Math.round(parseFloat(formData.dimHeight)) : null,
      wood_type_id: parseInt(formData.woodTypeId, 10) || null,
      wood_cft: parseFloat(formData.woodCft) || 0,
      multiplier: parseFloat(formData.multiplier) || 0,
      rattan_sqft: parseFloat(formData.rattanSqft) || 0,
      cushion_qty: parseFloat(formData.cushionQty) || 0,
      packaging_cost: parseFloat(formData.packagingCost) || 0,
      addons: Array.isArray(formData.addons) ? formData.addons : [],
      estimated_selling_price: calculatedSellPrice,
      modified_at: new Date().toISOString()
    };

    try {
      if (editingSku && editingSku !== cleanSku) {
        await supabase.from('product_master').delete().eq('sku', editingSku);
      }

      const { error } = await supabase.from('product_master').upsert(payload);
      if (error) throw error;

      alert(`Product ${cleanSku} saved successfully!`);
      setEditingSku(cleanSku);
      await fetchAllMasterData();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving product: ' + err.message);
    }
  };

  // --- LIBRARY CARD ACTIONS ---
  const handleEditProduct = (product) => {
    setEditingSku(product.sku);
    setFormData({
      category: product.category || 'Dining Tables',
      sku: product.sku,
      name: product.name || '',
      image_base64: product.image_base64 || '',
      notes: product.notes || '',
      inspiration: product.inspiration || '',
      dimLength: product.dim_length ? String(Math.round(product.dim_length)) : '',
      dimWidth: product.dim_width ? String(Math.round(product.dim_width)) : '',
      dimHeight: product.dim_height ? String(Math.round(product.dim_height)) : '',
      woodTypeId: product.wood_type_id || woodMaster[0]?.id || '',
      woodCft: product.wood_cft || '',
      multiplier: product.multiplier || '',
      rattanSqft: product.rattan_sqft || '',
      cushionQty: product.cushion_qty || '',
      packagingCost: product.packaging_cost || '',
      addons: Array.isArray(product.addons) ? product.addons : []
    });
    setActiveView('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicateProduct = (product) => {
    const newSku = generateSmartSku(product.category);
    setEditingSku(null);
    setFormData({
      category: product.category || 'Dining Tables',
      sku: newSku,
      name: `${product.name} (Copy)`,
      image_base64: '',
      notes: product.notes || '',
      inspiration: product.inspiration || '',
      dimLength: product.dim_length ? String(Math.round(product.dim_length)) : '',
      dimWidth: product.dim_width ? String(Math.round(product.dim_width)) : '',
      dimHeight: product.dim_height ? String(Math.round(product.dim_height)) : '',
      woodTypeId: product.wood_type_id || woodMaster[0]?.id || '',
      woodCft: product.wood_cft || '',
      multiplier: product.multiplier || '',
      rattanSqft: product.rattan_sqft || '',
      cushionQty: product.cushion_qty || '',
      packagingCost: product.packaging_cost || '',
      addons: Array.isArray(product.addons) ? product.addons : []
    });
    setActiveView('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (sku, imageUrl) => {
    if (!confirm(`Are you sure you want to permanently delete ${sku}?`)) return;

    try {
      if (imageUrl && imageUrl.includes('/product-images/')) {
        const fileName = imageUrl.split('/product-images/')[1];
        if (fileName) {
          await supabase.storage.from('product-images').remove([fileName]);
        }
      }

      const { error } = await supabase.from('product_master').delete().eq('sku', sku);
      if (error) throw error;

      if (editingSku === sku) handleResetForm();
      await fetchAllMasterData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete product: ' + err.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleToggleClientView = (checked) => {
    setClientViewMode(checked);
    setRevealedPrices({});
  };

  const toggleSingleProductPrice = (sku) => {
    setRevealedPrices(prev => ({
      ...prev,
      [sku]: !prev[sku]
    }));
  };

  // --- LIBRARY FILTERING & GROUPING ---
  const filteredProducts = productLibrary.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const woodName = woodMaster.find(w => w.id === p.wood_type_id)?.name?.toLowerCase() || '';
    return (
      p.sku?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      woodName.includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  });

  const groupedByCategory = filteredProducts.reduce((acc, product) => {
    const cat = product.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {});

  const toggleCategoryAccordion = (cat) => {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // --- RENDER GATES ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center bg-[#f4f1eb] min-h-screen">
        <p className="text-xs font-bold uppercase tracking-widest text-[#746b61]">
          Verifying Session...
        </p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (dataLoading && woodMaster.length === 0) {
    return (
      <div className="flex items-center justify-center bg-[#f4f1eb] min-h-screen">
        <p className="text-xs font-bold uppercase tracking-widest text-[#746b61]">
          Syncing Arovan Cloud Engine...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1eb] text-[#171512]">
      {/* PREMIUM RESPONSIVE HEADER */}
      <header className="bg-white border-b border-[#e1d8cd] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand Logo + Subtitle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <img
                src="/Logo_1600x900.jpeg"
                alt="Arovan"
                className="h-9 sm:h-11 w-auto object-contain"
              />
              <div className="hidden sm:block h-7 w-px bg-[#e1d8cd]" />
              <div className="hidden sm:block">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#171512]">
                  Product Master
                </p>
                <p className="text-[10px] text-[#746b61]">
                  {isAdmin ? 'Admin Engine' : isFreelancer ? 'Contractor Access' : 'Showroom Lookbook'}
                </p>
              </div>
            </div>

            {/* Mobile Sign Out */}
            <button
              onClick={handleSignOut}
              className="md:hidden px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#dcd3c9] rounded-full text-[#5c5349] hover:bg-red-50 hover:text-red-600 transition"
            >
              Sign Out
            </button>
          </div>

          {/* Navigation Tabs & Admin Controls */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
            {isAdmin && (
              <button
                onClick={() => setActiveView('workspace')}
                className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full md:rounded-none md:border-b-2 transition ${
                  activeView === 'workspace'
                    ? 'bg-[#171512] text-white md:bg-transparent md:text-[#171512] md:border-[#171512]'
                    : 'bg-[#f4f1eb] text-[#746b61] md:bg-transparent md:border-transparent hover:text-[#171512]'
                }`}
              >
                Workspace
              </button>
            )}

            <button
              onClick={() => setActiveView('library')}
              className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full md:rounded-none md:border-b-2 transition ${
                activeView === 'library'
                  ? 'bg-[#171512] text-white md:bg-transparent md:text-[#171512] md:border-[#171512]'
                  : 'bg-[#f4f1eb] text-[#746b61] md:bg-transparent md:border-transparent hover:text-[#171512]'
              }`}
            >
              Library ({productLibrary.length})
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveView('settings')}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full md:rounded-none md:border-b-2 transition ${
                  activeView === 'settings'
                    ? 'bg-[#171512] text-white md:bg-transparent md:text-[#171512] md:border-[#171512]'
                    : 'bg-[#f4f1eb] text-[#746b61] md:bg-transparent md:border-transparent hover:text-[#171512]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            )}

            {/* Admin "Client View" Toggle Switch */}
            {isAdmin && (
              <label className="shrink-0 flex items-center gap-2 ml-2 px-3 py-1.5 bg-[#faf8f5] border border-[#e1d8cd] rounded-full cursor-pointer select-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5c5349]">
                  Client View
                </span>
                <input
                  type="checkbox"
                  checked={clientViewMode}
                  onChange={(e) => handleToggleClientView(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-[#dcd3c9] rounded-full peer peer-checked:bg-[#171512] relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-3 after:h-3 after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
              </label>
            )}

            {/* Desktop Sign Out */}
            <button
              onClick={handleSignOut}
              className="hidden md:inline-block ml-2 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#dcd3c9] rounded-md text-[#5c5349] hover:bg-red-50 hover:text-red-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* VIEW 1: WORKSPACE (ADMIN ONLY) */}
        {activeView === 'workspace' && isAdmin && (
          <div>
            {editingSku && (
              <div className="mb-5 px-4 py-3 bg-[#171512] text-white rounded-md flex items-center justify-between text-xs">
                <span>
                  Editing existing product: <strong className="font-mono">{editingSku}</strong>
                </span>
                <button
                  onClick={handleResetForm}
                  className="underline font-semibold hover:text-[#dcd3c9]"
                >
                  + Switch to New Product
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8">
                <CostingForm
                  formData={formData}
                  setFormData={setFormData}
                  woodMaster={woodMaster}
                  addonsMaster={addonsMaster}
                  onCategoryChange={handleCategoryChange}
                />
              </div>

              <div className="lg:col-span-4">
                <CostingSummary
                  formData={formData}
                  addonsMaster={addonsMaster}
                  onSave={handleSaveProduct}
                  onReset={handleResetForm}
                  isClientView={clientViewMode}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PRODUCT LIBRARY (ALL ROLES) */}
        {activeView === 'library' && (
          <div className="space-y-6">
            {/* Search & Live Sync Header */}
            <div className="bg-white p-5 rounded-lg border border-[#e1d8cd] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl text-[#171512]">Product Library</h2>
                {!defaultHidePrices && lastSyncTime && (
                  <p className="text-[11px] text-[#746b61] mt-0.5">
                    Live Pricing Synced: <span className="font-semibold">{lastSyncTime}</span>
                  </p>
                )}
              </div>

              <div className="w-full sm:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search SKU, product name, wood, category..."
                  className="w-full px-3.5 py-2 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                />
              </div>
            </div>

            {/* Category Accordions */}
            {Object.keys(groupedByCategory).length === 0 ? (
              <div className="bg-white p-12 rounded-lg border border-[#e1d8cd] text-center">
                <p className="text-sm text-[#746b61]">
                  No products found matching your search.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedByCategory).map(([category, items]) => {
                  const isOpen = searchQuery.trim() !== '' ? true : Boolean(openCategories[category]);

                  return (
                    <div
                      key={category}
                      className="bg-white rounded-lg border border-[#e1d8cd] shadow-sm overflow-hidden"
                    >
                      {/* Accordion Toggle Header */}
                      <button
                        type="button"
                        onClick={() => toggleCategoryAccordion(category)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-[#faf8f5] hover:bg-[#f4f1eb] transition text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-serif text-base font-medium text-[#171512]">
                            {category}
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8e1d7] text-[#5c5349]">
                            {items.length}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-[#746b61]">
                          {isOpen ? '▲ Hide' : '▼ View'}
                        </span>
                      </button>

                      {/* Accordion Content Grid */}
                      {isOpen && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 border-t border-[#e1d8cd]">
                          {items.map((item) => {
                            const woodName =
                              woodMaster.find((w) => w.id === item.wood_type_id)?.name || 'Solid Wood';
                            const livePrice = calculateDynamicPrice(item);

                            const isCardPriceHidden = defaultHidePrices && !revealedPrices[item.sku];

                            // Build clean integer Inches & Ft+In strings
                            const lIn = item.dim_length ? Math.round(item.dim_length) : null;
                            const wIn = item.dim_width ? Math.round(item.dim_width) : null;
                            const hIn = item.dim_height ? Math.round(item.dim_height) : null;
                            const hasDims = Boolean(lIn || wIn || hIn);

                            const inchesParts = [
                              lIn ? `${lIn}"L` : null,
                              wIn ? `${wIn}"W` : null,
                              hIn ? `${hIn}"H` : null
                            ].filter(Boolean);

                            const ftInParts = [
                              toFtInLabel(lIn, 'L'),
                              toFtInLabel(wIn, 'W'),
                              toFtInLabel(hIn, 'H')
                            ].filter(Boolean);

                            return (
                              <div
                                key={item.sku}
                                className="border border-[#e1d8cd] rounded-lg overflow-hidden bg-white flex flex-col justify-between hover:shadow-md transition"
                              >
                                <div>
                                  {/* Full-Fit Product Image Box */}
                                  <div className="h-56 sm:h-60 w-full bg-[#faf8f5] border-b border-[#e1d8cd] p-3 flex items-center justify-center overflow-hidden">
                                    {item.image_base64 ? (
                                      <img
                                        src={item.image_base64}
                                        alt={item.name}
                                        className="max-h-full max-w-full w-auto h-auto object-contain"
                                      />
                                    ) : (
                                      <span className="text-xs text-[#a3988c] uppercase tracking-widest">
                                        No Image
                                      </span>
                                    )}
                                  </div>

                                  {/* Card Body */}
                                  <div className="p-4">
                                    <div className="flex items-center justify-between gap-2 mb-2.5">
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#f4f1eb] text-[#5c5349] rounded">
                                        {item.sku}
                                      </span>

                                      <div className="flex items-center gap-1.5">
                                        {isCardPriceHidden ? (
                                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-[#faf8f5] border border-[#dcd3c9] text-[#5c5349] rounded-full">
                                            Exquisite Craft
                                          </span>
                                        ) : (
                                          <span className="text-base font-extrabold text-[#171512]">
                                            ₹{livePrice.toLocaleString()}
                                          </span>
                                        )}

                                        {/* Per-product eye toggle when in Client View */}
                                        {defaultHidePrices && (
                                          <button
                                            type="button"
                                            onClick={() => toggleSingleProductPrice(item.sku)}
                                            title={isCardPriceHidden ? 'Show price for this item' : 'Hide price for this item'}
                                            className="p-1 text-[#746b61] hover:text-[#171512] rounded hover:bg-[#f4f1eb] transition"
                                          >
                                            {isCardPriceHidden ? (
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                              </svg>
                                            ) : (
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                              </svg>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <h3 className="font-semibold text-base text-[#171512] mb-2">
                                      {item.name}
                                    </h3>

                                    {/* Line 1: Bold Wood Badge */}
                                    <div className="mb-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-[#171512] text-white text-[11px] font-bold tracking-wide">
                                        {woodName}
                                      </span>
                                    </div>

                                    {/* Line 2: Compact Dual Dimensions (Inches + Ft/In) */}
                                    {hasDims && (
                                      <div className="text-[11px] text-[#5c5349] bg-[#faf8f5] border border-[#e8e1d7] rounded px-2.5 py-1.5 mb-2.5 leading-snug">
                                        <span className="font-semibold text-[#171512]">
                                          📏 {inchesParts.join(' × ')}
                                        </span>
                                        <span className="mx-1.5 text-[#a3988c]">•</span>
                                        <span className="text-[#746b61]">
                                          {ftInParts.join(' × ')}
                                        </span>
                                      </div>
                                    )}

                                    {item.notes && (
                                      <p className="text-xs text-[#4a433b] italic mb-2">
                                        &ldquo;{item.notes}&rdquo;
                                      </p>
                                    )}

                                    {item.inspiration && (
                                      <details className="mt-2 text-xs text-[#5c5349] bg-[#faf8f5] p-2.5 rounded border border-[#e8e1d7]">
                                        <summary className="cursor-pointer font-bold text-[#171512] select-none">
                                          Read Story
                                        </summary>
                                        <p className="mt-1.5 leading-relaxed">{item.inspiration}</p>
                                      </details>
                                    )}
                                  </div>
                                </div>

                                {/* Admin Action Footer */}
                                {isAdmin && (
                                  <div className="px-4 py-3 bg-[#faf8f5] border-t border-[#e1d8cd] flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEditProduct(item)}
                                      className="flex-1 py-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-[#dcd3c9] rounded hover:bg-[#171512] hover:text-white transition"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateProduct(item)}
                                      className="flex-1 py-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-[#dcd3c9] rounded hover:bg-[#171512] hover:text-white transition"
                                    >
                                      Duplicate
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(item.sku, item.image_base64)}
                                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-600 bg-white border border-[#dcd3c9] rounded hover:bg-red-50 transition"
                                    >
                                      Del
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ADMIN SETTINGS (ADMIN ONLY) */}
        {activeView === 'settings' && isAdmin && (
          <Settings
            woodMaster={woodMaster}
            addonsMaster={addonsMaster}
            refreshData={fetchAllMasterData}
          />
        )}
      </main>
    </div>
  );
}