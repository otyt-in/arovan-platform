'use client';
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function CostingForm({ 
  formData, 
  setFormData, 
  woodMaster, 
  finishingMaster,
  onCategoryChange 
}) {
  const [uploading, setUploading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const fileExt = 'jpg';
            const fileName = `${formData.sku || 'prod'}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(fileName, blob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage
              .from('product-images')
              .getPublicUrl(fileName);

            handleChange('image_base64', publicUrl);
            setUploading(false);
          }, 'image/jpeg', 0.75);
        };
      };
    } catch (error) {
      console.error("Storage error:", error);
      alert("Upload failed: " + error.message);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* PANEL 1: IDENTITY */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#171512] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white flex items-center justify-center text-[10px]">1</span>
          Product Identity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Category</label>
            <select 
              value={formData.category} 
              onChange={(e) => {
                handleChange('category', e.target.value);
                if (onCategoryChange) onCategoryChange(e.target.value);
              }}
              className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]"
            >
              <option value="Dining Tables">Dining Tables</option>
              <option value="Center Tables">Center Tables</option>
              <option value="Console Tables">Console Tables</option>
              <option value="Nesting Table">Nesting Table</option>
              <option value="End Tables">End Tables</option>
              <option value="Benches">Benches</option>
              <option value="Sofas">Sofas</option>
              <option value="Chairs">Chairs</option>
              <option value="High Stools">High Stools</option>
              <option value="Beds">Beds</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">SKU (Editable)</label>
            <input 
              type="text" 
              value={formData.sku} 
              onChange={(e) => handleChange('sku', e.target.value)}
              className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]"
              placeholder="e.g. CHR-001"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-[#4a443e]">Product Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => handleChange('name', e.target.value)}
              className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]"
              placeholder="e.g. Vera Tufted Dining Chair"
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 border-t border-[#f0e9df] pt-4 mt-1">
            <label className="text-xs font-semibold text-[#4a443e]">Product Visual Reference</label>
            <div className="relative w-full border-2 border-dashed border-[#dcd3c9] rounded-lg bg-[#fdfcfb] hover:bg-[#f4f1eb] transition group overflow-hidden flex items-center justify-center min-h-[120px]">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              {uploading ? (
                <div className="text-sm font-medium text-[#746b61]">Optimizing & Uploading...</div>
              ) : formData.image_base64 ? (
                <div className="flex items-center gap-4 p-4 w-full">
                  <img 
                    src={formData.image_base64} 
                    alt="Uploaded preview" 
                    className="w-20 h-20 object-cover rounded shadow-sm border border-[#e1d8cd]"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-green-600 mb-1">✓ Cloud Upload Successful</span>
                    <span className="text-[11px] text-[#746b61]">Click anywhere in this box to replace the image.</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 pointer-events-none">
                  <span className="text-2xl mb-2">📸</span>
                  <span className="text-sm font-medium text-[#171512]">Click to upload product photo</span>
                  <span className="text-[11px] text-[#746b61] mt-1">Auto-compresses to save cloud storage</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
            <label className="text-xs font-semibold text-[#4a443e]">Short Description / Tagline (1-2 lines)</label>
            <textarea 
              value={formData.notes} 
              onChange={(e) => handleChange('notes', e.target.value)}
              className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb] min-h-[50px]"
              placeholder="e.g. Monolithic slab shaped by nature..."
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-[#4a443e]">Inspiration & Backstory (Optional)</label>
            <textarea 
              value={formData.inspiration} 
              onChange={(e) => handleChange('inspiration', e.target.value)}
              className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb] min-h-[80px]"
              placeholder="e.g. Crafted from a single Monkey Pod slab, where the natural edge flows into the base..."
            />
          </div>
        </div>
      </div>

      {/* PANEL 2: DIMENSIONS */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#171512] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white flex items-center justify-center text-[10px]">2</span>
          Reference Dimensions
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Length (In)</label>
            <input type="number" value={formData.dimLength} onChange={(e) => handleChange('dimLength', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" placeholder="L" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Width (In)</label>
            <input type="number" value={formData.dimWidth} onChange={(e) => handleChange('dimWidth', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" placeholder="W" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Height (In)</label>
            <input type="number" value={formData.dimHeight} onChange={(e) => handleChange('dimHeight', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" placeholder="H" />
          </div>
        </div>
      </div>

      {/* PANEL 3: MATERIALS */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#171512] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white flex items-center justify-center text-[10px]">3</span>
          Material & Component Variables
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Solid Wood Base</label>
            <select value={formData.woodTypeId} onChange={(e) => handleChange('woodTypeId', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]">
              {woodMaster.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Wood Quantity (CFT)</label>
            <input type="number" step="0.01" value={formData.woodCft} onChange={(e) => handleChange('woodCft', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Plywood Selection</label>
            <select value={formData.plywoodType} onChange={(e) => handleChange('plywoodType', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]">
              <option value="None">None</option>
              <option value="Commercial">Commercial Ply (₹1200/Sheet)</option>
              <option value="Marine">Marine Ply (₹1800/Sheet)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Plywood Quantity (Sheets)</label>
            <input type="number" step="0.25" value={formData.plywoodQty} onChange={(e) => handleChange('plywoodQty', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Labour Output (Hours)</label>
            <input type="number" value={formData.labourHours} onChange={(e) => handleChange('labourHours', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Custom Labour Rate (₹/Hr)</label>
            <input type="number" value={formData.labourRate} onChange={(e) => handleChange('labourRate', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Finishing Treatment</label>
            <select value={formData.finishingTypeId} onChange={(e) => handleChange('finishingTypeId', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]">
              {finishingMaster.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Hardware Components (₹)</label>
            <input type="number" value={formData.hardwareCost} onChange={(e) => handleChange('hardwareCost', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Fabric Yards (Meters)</label>
            <input type="number" step="0.1" value={formData.fabricMeters} onChange={(e) => handleChange('fabricMeters', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Fabric Cost Base (₹/Mtr)</label>
            <input type="number" value={formData.fabricRate} onChange={(e) => handleChange('fabricRate', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Premium Foam Core (₹)</label>
            <input type="number" value={formData.foamCost} onChange={(e) => handleChange('foamCost', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#4a443e]">Crating & Packaging (₹)</label>
            <input type="number" value={formData.packagingCost} onChange={(e) => handleChange('packagingCost', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-[#4a443e]">Indirect Overheads Allocation (%)</label>
            <input type="number" value={formData.overheadsPercent} onChange={(e) => handleChange('overheadsPercent', e.target.value)} className="p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
          </div>
        </div>
      </div>
    </div>
  );
}