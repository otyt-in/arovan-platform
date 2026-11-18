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
  onCategoryChange,
  onTrackUpload
}) {
  const [uploading, setUploading] = useState(false);
  const [dimUnit, setDimUnit] = useState('ft'); // 'in' or 'ft'

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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

  const selectedWood = woodMaster.find(w => String(w.id) === String(formData.woodTypeId));
  const rattanMaster = addonsMaster.find(a => a.name.toLowerCase() === 'rattan');
  const cushionMaster = addonsMaster.find(a => a.name.toLowerCase().includes('cushion'));
  const miscAddonsList = addonsMaster.filter(a => !a.is_fixed_grid);

  // --- DYNAMIC MISC ADD-ONS HANDLERS ---
  const currentAddons = Array.isArray(formData.addons) ? formData.addons : [];

  const handleAddMiscRow = () => {
    if (miscAddonsList.length === 0) {
      alert('No extra components configured in Settings yet.');
      return;
    }
    const defaultItem = miscAddonsList[0];
    const updated = [...currentAddons, { addon_id: defaultItem.id, qty: 1 }];
    handleChange('addons', updated);
  };

  const handleMiscRowChange = (index, field, value) => {
    const updated = [...currentAddons];
    updated[index] = {
      ...updated[index],
      [field]: field === 'addon_id' ? parseInt(value, 10) : (parseFloat(value) || 0)
    };
    handleChange('addons', updated);
  };

  const handleRemoveMiscRow = (index) => {
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

      // Track this upload in parent so unlinked uploads can be cleaned up on Save or Reset
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
                handleChange('category', newCat);
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
              <p className="text-xs font-semibold text-[#746b61]">Compressing & uploading photo...</p>
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
            Inspiration & Backstory (Optional)
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

      {/* SECTION 2: REFERENCE DIMENSIONS (WITH INCHES / FT+IN TOGGLE) */}
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

          {/* Unit Mode Pill Switch */}
          <div className="inline-flex rounded-md border border-[#dcd3c9] bg-[#faf8f5] p-0.5">
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
          </div>
        </div>

        {dimUnit === 'in' ? (
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
        ) : (
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
        )}
      </div>

      {/* SECTION 3: SIMPLIFIED WOOD MULTIPLIER & ADD-ONS */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
            3
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
            Material & Component Variables
          </h2>
        </div>

        {/* PRIMARY WOOD & MULTIPLIER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-[#f0eae1]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#4a433b]">Type of Wood</label>
              {selectedWood && (
                <span className="text-[10px] font-medium text-[#746b61]">
                  Ref: ₹{(selectedWood.rate_per_cft || 0).toLocaleString()}/CFT
                </span>
              )}
            </div>
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
            <label className="block text-[11px] font-bold text-[#4a433b] mb-1.5">
              Multiplier (₹ / CFT)
            </label>
            <input
              type="number"
              value={formData.multiplier}
              onChange={(e) => handleChange('multiplier', e.target.value)}
              placeholder="e.g. 14000"
              className="w-full p-2.5 text-sm font-semibold border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>
        </div>

        {/* FIXED COMMON GRID: RATTAN, FABRIC + CUSHION, PACKAGING */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-5 border-b border-[#f0eae1]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#4a433b]">
                Rattan ({rattanMaster?.unit || 'sqft'})
              </label>
              {rattanMaster && (
                <span className="text-[10px] text-[#746b61]">
                  ₹{rattanMaster.rate?.toLocaleString()}/{rattanMaster.unit || 'sqft'}
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.1"
              value={formData.rattanSqft}
              onChange={(e) => handleChange('rattanSqft', e.target.value)}
              placeholder="0"
              className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#4a433b]">
                Fabric + Cushion ({cushionMaster?.unit || 'mtr'})
              </label>
              {cushionMaster && (
                <span className="text-[10px] text-[#746b61]">
                  ₹{cushionMaster.rate?.toLocaleString()}/{cushionMaster.unit || 'mtr'}
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.1"
              value={formData.cushionQty}
              onChange={(e) => handleChange('cushionQty', e.target.value)}
              placeholder="0"
              className="w-full p-2.5 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
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

        {/* DYNAMIC MISC ADD-ONS (PLYWOOD, BRASS, METAL, HINGES, HANDLES, ETC.) */}
        <div className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#4a433b]">
                Additional Components (Optional)
              </h3>
              <p className="text-[10px] text-[#746b61]">
                Plywood, Brass, Metal legs, Hinges, Door handles, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMiscRow}
              className="px-3 py-1.5 bg-[#f4f1eb] hover:bg-[#e8e1d7] text-[#171512] text-[11px] font-bold uppercase tracking-wider rounded transition"
            >
              + Add Component
            </button>
          </div>

          {currentAddons.length > 0 && (
            <div className="space-y-2.5 mt-3">
              {currentAddons.map((row, idx) => {
                const matchedMaster = miscAddonsList.find(a => a.id === row.addon_id);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2.5 items-center bg-[#faf8f5] p-2.5 rounded-md border border-[#e8e1d7]"
                  >
                    <div className="col-span-7">
                      <select
                        value={row.addon_id}
                        onChange={(e) => handleMiscRowChange(idx, 'addon_id', e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                      >
                        {miscAddonsList.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} (₹{opt.rate?.toLocaleString()}/{opt.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={row.qty}
                        onChange={(e) => handleMiscRowChange(idx, 'qty', e.target.value)}
                        placeholder={matchedMaster?.unit || 'Qty'}
                        className="w-full p-2 text-xs bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                      />
                    </div>

                    <div className="col-span-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveMiscRow(idx)}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1"
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