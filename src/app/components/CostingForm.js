'use client';
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const CATEGORIES = [
  'Dining Tables',
  'Center Tables',
  'Console Tables',
  'Nesting Table',
  'End Tables',
  'Benches',
  'Sofas',
  'Chairs',
  'High Stools',
  'Beds',
  'Custom'
];

export default function CostingForm({
  formData,
  setFormData,
  woodMaster,
  addonsMaster,
  categoryWoodRules,
  onCategoryChange,
  onTrackUpload
}) {
  const [uploading, setUploading] = useState(false);
  const [dimUnit, setDimUnit] = useState('ft'); // Default to Ft + In (' ")

  const findRuleMultiplier = (cat, woodId) => {
    if (!Array.isArray(categoryWoodRules)) return null;
    const match = categoryWoodRules.find(
      r => r.category === cat && String(r.wood_type_id) === String(woodId)
    );
    return match ? String(match.multiplier) : null;
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // When wood type changes, auto-fill matching Category x Wood rule (or clear to blank if unconfigured)
      if (field === 'woodTypeId') {
        const ruleMult = findRuleMultiplier(prev.category, value);
        next.multiplier = ruleMult !== null ? ruleMult : '';
      }
      return next;
    });
  };

  const activeRuleMult = findRuleMultiplier(formData.category, formData.woodTypeId);
  const isCustomOverride =
    activeRuleMult !== null &&
    String(formData.multiplier).trim() !== '' &&
    parseFloat(formData.multiplier) !== parseFloat(activeRuleMult);

  // --- WHOLE-INTEGER DIMENSION CONVERSION HELPERS ---
  const handleInchInput = (field, rawVal) => {
    if (rawVal === '') {
      handleChange(field, '');
      return;
    }
    const wholeInches = Math.max(0, Math.round(Number(rawVal) || 0));
    handleChange(field, String(wholeInches));
  };

  const getFeetPart = (totalInches) => {
    const num = Math.round(Number(totalInches) || 0);
    return num > 0 ? Math.floor(num / 12) : '';
  };

  const getInchPart = (totalInches) => {
    const num = Math.round(Number(totalInches) || 0);
    return num > 0 ? num % 12 : '';
  };

  const handleFtInChange = (field, part, rawVal) => {
    const currentTotal = Math.round(Number(formData[field]) || 0);
    const currentFt = Math.floor(currentTotal / 12);
    const currentIn = currentTotal % 12;

    const cleanVal = rawVal === '' ? 0 : Math.max(0, Math.round(Number(rawVal) || 0));
    const newFt = part === 'ft' ? cleanVal : currentFt;
    const newIn = part === 'in' ? cleanVal : currentIn;

    const newTotal = newFt * 12 + newIn;
    handleChange(field, newTotal > 0 ? String(newTotal) : '');
  };

  const formatFtInPreview = (totalInches) => {
    const num = Math.round(Number(totalInches) || 0);
    if (!num) return '';
    const ft = Math.floor(num / 12);
    const inc = num % 12;
    return `${ft}' ${inc}"`;
  };

  // Top surface area in sq ft from stored whole inches (L x W / 144)
  const lenIn = Math.round(Number(formData.dimLength) || 0);
  const widIn = Math.round(Number(formData.dimWidth) || 0);
  const topAreaSqFt = lenIn > 0 && widIn > 0 ? (lenIn * widIn) / 144 : 0;

  // --- DYNAMIC ADD-ONS HANDLERS ---
  const currentAddons = Array.isArray(formData.addons) ? formData.addons : [];

  const handleAddComponentRow = () => {
    if (addonsMaster.length === 0) {
      alert('No components configured in Settings yet.');
      return;
    }
    const defaultItem = addonsMaster[0];
    const updated = [
      ...currentAddons,
      {
        addon_id: defaultItem.id,
        qty: '',
        count: 1
      }
    ];
    handleChange('addons', updated);
  };

  const handleComponentRowChange = (index, field, value) => {
    const updated = [...currentAddons];
    if (field === 'addon_id') {
      const newId = parseInt(value, 10);
      updated[index] = {
        addon_id: newId,
        qty: '',
        count: 1
      };
    } else if (field === 'count') {
      updated[index] = {
        ...updated[index],
        count: value === '' ? '' : Math.max(1, Math.round(Number(value) || 1))
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value === '' ? '' : (parseFloat(value) || 0)
      };
    }
    handleChange('addons', updated);
  };

  const handleRemoveComponentRow = (index) => {
    const updated = currentAddons.filter((_, i) => i !== index);
    handleChange('addons', updated);
  };

  // --- IMAGE COMPRESSOR & SAFE CLOUD UPLOAD ---
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressedBlob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 900;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Image compression failed'));
              },
              'image/jpeg',
              0.75
            );
          };
          img.onerror = reject;
          img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const newUrl = publicUrlData.publicUrl;

      if (onTrackUpload) {
        onTrackUpload(newUrl);
      }

      handleChange('image_base64', newUrl);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: PRODUCT IDENTITY */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
            Product Identity
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => {
                const newCat = e.target.value;
                const ruleMult = findRuleMultiplier(newCat, formData.woodTypeId);
                setFormData(prev => ({
                  ...prev,
                  category: newCat,
                  multiplier: ruleMult !== null ? ruleMult : ''
                }));
                if (onCategoryChange) onCategoryChange(newCat);
              }}
              className="w-full p-2.5 text-sm bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              SKU (Editable)
            </label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => handleChange('sku', e.target.value.toUpperCase())}
              placeholder="e.g. DT-001"
              className="w-full p-2.5 text-sm font-mono font-semibold border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
            Product Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Vera Tufted Dining Chair"
            className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
          />
        </div>

        {/* IMAGE UPLOAD DROPZONE */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
            Product Visual Reference
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#dcd3c9] rounded-lg p-5 cursor-pointer hover:bg-[#faf8f5] transition text-center">
            {uploading ? (
              <p className="text-xs font-semibold text-[#746b61]">Compressing &amp; uploading photo...</p>
            ) : formData.image_base64 ? (
              <div className="space-y-2">
                <img
                  src={formData.image_base64}
                  alt="Product preview"
                  className="h-32 w-auto mx-auto rounded object-contain border border-[#e1d8cd] bg-[#faf8f5] p-1"
                />
                <p className="text-[11px] text-[#746b61] font-medium">Click to replace photo</p>
              </div>
            ) : (
              <>
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs font-bold text-[#171512]">Click to upload product photo</span>
                <span className="text-[10px] text-[#746b61] mt-0.5">
                  Auto-compresses to save cloud storage
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
            Short Description / Tagline (1–2 lines)
          </label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="e.g. Monolithic slab shaped by nature..."
            className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
            Inspiration &amp; Backstory (Optional)
          </label>
          <textarea
            rows={2}
            value={formData.inspiration}
            onChange={(e) => handleChange('inspiration', e.target.value)}
            placeholder="e.g. Crafted from a single Monkey Pod slab..."
            className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
          />
        </div>
      </div>

      {/* SECTION 2: REFERENCE DIMENSIONS (DEFAULT FT + IN TOGGLE + TOP AREA SQ FT) */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
              Reference Dimensions
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {topAreaSqFt > 0 && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#f4f1eb] border border-[#e1d8cd] text-[#4a433b] tabular-nums">
                Top Area: <strong className="text-[#171512]">{topAreaSqFt.toFixed(1)} sq ft</strong>
              </span>
            )}

            <div className="inline-flex rounded-md border border-[#dcd3c9] bg-[#faf8f5] p-0.5">
              <button
                type="button"
                onClick={() => setDimUnit('ft')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition ${
                  dimUnit === 'ft'
                    ? 'bg-[#171512] text-white'
                    : 'text-[#746b61] hover:text-[#171512]'
                }`}
              >
                Ft + In (&apos; &quot;)
              </button>
              <button
                type="button"
                onClick={() => setDimUnit('in')}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition ${
                  dimUnit === 'in'
                    ? 'bg-[#171512] text-white'
                    : 'text-[#746b61] hover:text-[#171512]'
                }`}
              >
                Inches (&quot;)
              </button>
            </div>
          </div>
        </div>

        {dimUnit === 'ft' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Length', field: 'dimLength' },
              { label: 'Width', field: 'dimWidth' },
              { label: 'Height', field: 'dimHeight' }
            ].map(({ label, field }) => (
              <div key={field}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#4a433b]">{label}</label>
                  {formData[field] && (
                    <span className="text-[10px] font-medium text-[#746b61]">
                      Total: {Math.round(Number(formData[field]))}&quot;
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={getFeetPart(formData[field])}
                      onChange={(e) => handleFtInChange(field, 'ft', e.target.value)}
                      placeholder="0"
                      className="w-full p-2.5 pr-7 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#746b61]">
                      ft
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={getInchPart(formData[field])}
                      onChange={(e) => handleFtInChange(field, 'in', e.target.value)}
                      placeholder="0"
                      className="w-full p-2.5 pr-7 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#746b61]">
                      in
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Length (In)', field: 'dimLength', placeholder: 'L (in)' },
              { label: 'Width (In)', field: 'dimWidth', placeholder: 'W (in)' },
              { label: 'Height (In)', field: 'dimHeight', placeholder: 'H (in)' }
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#4a433b]">{label}</label>
                  {formData[field] && (
                    <span className="text-[10px] font-medium text-[#746b61]">
                      = {formatFtInPreview(formData[field])}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData[field]}
                  onChange={(e) => handleInchInput(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: WOOD, MULTIPLIER, PACKAGING & MODULAR ADD-ONS */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
            3
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
            Material &amp; Component Variables
          </h2>
        </div>

        {/* PRIMARY WOOD, MULTIPLIER & PACKAGING */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-[#f0eae1]">
          <div>
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              Type of Wood
            </label>
            <select
              value={formData.woodTypeId}
              onChange={(e) => handleChange('woodTypeId', e.target.value)}
              className="w-full p-2.5 text-sm bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            >
              {woodMaster.map(wood => (
                <option key={wood.id} value={wood.id}>{wood.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              Wood Quantity (CFT)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.woodCft}
              onChange={(e) => handleChange('woodCft', e.target.value)}
              placeholder="0.00"
              className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <label className="text-[11px] font-bold text-[#4a433b]">
                Multiplier (₹)
              </label>
              {activeRuleMult !== null ? (
                isCustomOverride ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({ ...prev, multiplier: activeRuleMult }))
                    }
                    className="text-[10px] font-semibold text-amber-700 underline hover:text-[#171512]"
                    title="Reset back to Category × Wood rule"
                  >
                    Custom (Reset)
                  </button>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    Rule: ₹{Number(activeRuleMult).toLocaleString()}
                  </span>
                )
              ) : (
                <span className="text-[10px] font-medium text-[#746b61]">
                  Manual entry
                </span>
              )}
            </div>
            <input
              type="number"
              value={formData.multiplier}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, multiplier: e.target.value }))
              }
              placeholder={activeRuleMult ? activeRuleMult : 'Manual ₹/CFT'}
              className="w-full p-2.5 text-sm font-semibold border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              Packaging Cost (₹)
            </label>
            <input
              type="number"
              value={formData.packagingCost}
              onChange={(e) => handleChange('packagingCost', e.target.value)}
              placeholder="0"
              className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>
        </div>

        {/* DYNAMIC ADDITIONAL COMPONENTS */}
        <div className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#4a433b]">
                Additional Components (Optional)
              </h3>
              <p className="text-[10px] text-[#746b61]">
                Add Rattan, Fabric + Cushion (Price × No. of), Plywood (sqft), Brass, Metal, Hinges, Door Handles, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddComponentRow}
              className="px-3 py-1.5 bg-[#f4f1eb] hover:bg-[#e8e1d7] text-[#171512] text-[11px] font-bold uppercase tracking-wider rounded transition"
            >
              + Add Component
            </button>
          </div>

          {currentAddons.length > 0 && (
            <div className="space-y-2.5 mt-3">
              {currentAddons.map((row, idx) => {
                const matchedMaster = addonsMaster.find(a => a.id === row.addon_id);
                const isCushion = matchedMaster?.name?.toLowerCase().includes('cushion');
                const isPerUnit = matchedMaster?.pricing_type === 'per_unit' && !isCushion;

                const enteredVal = parseFloat(row.qty) || 0;
                const cushionCount = parseFloat(row.count ?? 1) || 0;

                const calculatedLineTotal = isCushion
                  ? Math.round(enteredVal * cushionCount)
                  : isPerUnit
                  ? Math.round(enteredVal * (matchedMaster?.rate || 0))
                  : Math.round(enteredVal);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-[#faf8f5] px-3 py-2.5 rounded-md border border-[#e8e1d7]"
                  >
                    {/* 1. Component Selector (5 cols on desktop) */}
                    <div className="sm:col-span-5">
                      <select
                        value={row.addon_id}
                        onChange={(e) => handleComponentRowChange(idx, 'addon_id', e.target.value)}
                        className="w-full h-9 px-2.5 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                      >
                        {addonsMaster.map(opt => {
                          const optIsCushion = opt.name.toLowerCase().includes('cushion');
                          const optLabel =
                            opt.pricing_type === 'per_unit' && !optIsCushion
                              ? `${opt.name} (₹${opt.rate?.toLocaleString()}/${opt.unit})`
                              : opt.rate > 0
                              ? `${opt.name} (Ref: ₹${opt.rate?.toLocaleString()})`
                              : opt.name;
                          return (
                            <option key={opt.id} value={opt.id}>
                              {optLabel}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* 2. Input Fields (4 cols on desktop) */}
                    <div className="sm:col-span-4">
                      {isCushion ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#746b61]">
                              ₹
                            </span>
                            <input
                              type="number"
                              step="1"
                              value={row.qty}
                              onChange={(e) => handleComponentRowChange(idx, 'qty', e.target.value)}
                              placeholder="Rate"
                              className="w-full h-9 pl-6 pr-2 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                            />
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              value={row.count ?? 1}
                              onChange={(e) => handleComponentRowChange(idx, 'count', e.target.value)}
                              placeholder="Qty"
                              className="w-full h-9 pl-2.5 pr-8 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#746b61]">
                              nos
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          {!isPerUnit && (
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#746b61]">
                              ₹
                            </span>
                          )}
                          <input
                            type="number"
                            step={isPerUnit ? '0.1' : '1'}
                            value={row.qty}
                            onChange={(e) => handleComponentRowChange(idx, 'qty', e.target.value)}
                            placeholder={isPerUnit ? '0' : 'Lump sum'}
                            className={`w-full h-9 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512] ${
                              isPerUnit ? 'pl-2.5 pr-10' : 'pl-6 pr-2.5'
                            }`}
                          />
                          {isPerUnit && (
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#746b61]">
                              {matchedMaster?.unit || 'sqft'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Calculated Line Total + Remove Button (3 cols on desktop) */}
                    <div className="sm:col-span-3 flex items-center justify-end gap-2">
                      <span className="text-xs font-bold text-[#171512] tabular-nums">
                        {calculatedLineTotal > 0 ? `₹${calculatedLineTotal.toLocaleString()}` : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveComponentRow(idx)}
                        title="Remove component"
                        className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-800 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}