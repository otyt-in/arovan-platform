'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Settings({ woodMaster, addonsMaster, refreshData }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('addons');
  const [saving, setSaving] = useState(false);

  const [woods, setWoods] = useState([]);
  const [addons, setAddons] = useState([]);

  useEffect(() => {
    if (woodMaster) setWoods(woodMaster);
    if (addonsMaster) setAddons(addonsMaster);
  }, [woodMaster, addonsMaster]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput === '2026') {
      setUnlocked(true);
    } else {
      alert('Incorrect Admin PIN. Access Denied.');
      setPinInput('');
    }
  };

  // --- WOOD MASTER HANDLERS ---
  const handleWoodChange = (index, field, value) => {
    const updated = [...woods];
    updated[index] = {
      ...updated[index],
      [field]: field === 'rate_per_cft' ? (parseFloat(value) || 0) : value
    };
    setWoods(updated);
  };

  const addWoodRow = () => {
    setWoods([...woods, { name: '', rate_per_cft: 0, isNew: true }]);
  };

  const deleteWoodRow = async (index) => {
    const item = woods[index];
    if (item.id) {
      if (!confirm(`Delete "${item.name}" from Wood Master?`)) return;
      await supabase.from('wood_master').delete().eq('id', item.id);
      await refreshData();
    } else {
      setWoods(woods.filter((_, i) => i !== index));
    }
  };

  // --- ADD-ONS MASTER HANDLERS ---
  const handleAddonChange = (index, field, value) => {
    const updated = [...addons];
    updated[index] = {
      ...updated[index],
      [field]: field === 'rate' ? (parseFloat(value) || 0) : value
    };
    setAddons(updated);
  };

  const addAddonRow = () => {
    setAddons([...addons, { name: '', unit: 'nos', rate: 0, is_fixed_grid: false, isNew: true }]);
  };

  const deleteAddonRow = async (index) => {
    const item = addons[index];
    if (item.is_fixed_grid) {
      alert('Core form items (Rattan and Fabric + Cushion) cannot be deleted, only their unit or rate can be edited.');
      return;
    }
    if (item.id) {
      if (!confirm(`Delete "${item.name}" from Add-ons Master?`)) return;
      await supabase.from('addons_master').delete().eq('id', item.id);
      await refreshData();
    } else {
      setAddons(addons.filter((_, i) => i !== index));
    }
  };

  // --- SAVE ALL TO CLOUD ---
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. Save Woods
      const existingWoods = woods.filter(w => w.id && w.name.trim() !== '');
      const newWoods = woods
        .filter(w => !w.id && w.name.trim() !== '')
        .map(({ name, rate_per_cft }) => ({
          name: name.trim(),
          rate_per_cft: rate_per_cft || 0
        }));

      if (existingWoods.length > 0) {
        const cleanExistingWoods = existingWoods.map(({ id, name, rate_per_cft }) => ({
          id,
          name: name.trim(),
          rate_per_cft: rate_per_cft || 0
        }));
        const { error } = await supabase.from('wood_master').upsert(cleanExistingWoods);
        if (error) throw error;
      }
      if (newWoods.length > 0) {
        const { error } = await supabase.from('wood_master').insert(newWoods);
        if (error) throw error;
      }

      // 2. Save Add-ons
      const existingAddons = addons.filter(a => a.id && a.name.trim() !== '');
      const newAddons = addons
        .filter(a => !a.id && a.name.trim() !== '')
        .map(({ name, unit, rate, is_fixed_grid }) => ({
          name: name.trim(),
          unit: unit.trim() || 'nos',
          rate: rate || 0,
          is_fixed_grid: Boolean(is_fixed_grid)
        }));

      if (existingAddons.length > 0) {
        const cleanExistingAddons = existingAddons.map(({ id, name, unit, rate, is_fixed_grid }) => ({
          id,
          name: name.trim(),
          unit: unit.trim() || 'nos',
          rate: rate || 0,
          is_fixed_grid: Boolean(is_fixed_grid)
        }));
        const { error } = await supabase.from('addons_master').upsert(cleanExistingAddons);
        if (error) throw error;
      }
      if (newAddons.length > 0) {
        const { error } = await supabase.from('addons_master').insert(newAddons);
        if (error) throw error;
      }

      await refreshData();
      alert('Configuration saved! All product prices have been synced with the new rates.');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- PIN LOCK SCREEN ---
  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-lg border border-[#e1d8cd] shadow-sm text-center">
        <div className="w-12 h-12 bg-[#f4f1eb] rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
          🔒
        </div>
        <h2 className="font-serif text-xl text-[#171512] mb-1">Admin Configuration</h2>
        <p className="text-xs text-[#746b61] mb-6">Enter security PIN to modify master rates</p>
        <form onSubmit={handleUnlock} className="space-y-4">
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            maxLength={6}
            className="w-full text-center tracking-[0.5em] text-lg font-bold p-3 border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-black transition"
          >
            Unlock Settings
          </button>
        </form>
      </div>
    );
  }

  // --- MAIN SETTINGS DASHBOARD ---
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg border border-[#e1d8cd] shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#e1d8cd] bg-[#faf8f5]">
        <div>
          <h2 className="font-serif text-xl text-[#171512]">Master Rate Configuration</h2>
          <p className="text-xs text-[#746b61] mt-0.5">
            Changes here automatically recalculate live prices across your Product Library.
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-5 py-2.5 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-black transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-[#e1d8cd] px-6 bg-white">
        <button
          onClick={() => setActiveTab('addons')}
          className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'addons'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Add-ons & Components ({addons.length})
        </button>
        <button
          onClick={() => setActiveTab('woods')}
          className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'woods'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Wood Reference Rates ({woods.length})
        </button>
      </div>

      {/* TAB 1: ADD-ONS & COMPONENTS MASTER */}
      {activeTab === 'addons' && (
        <div className="p-6">
          <div className="mb-4 p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349]">
            Set the <strong>selling rate (₹)</strong> per unit for Rattan, Fabric + Cushion, and any additional components (Plywood, Brass, Metal, Hinges, Door Handles, etc.).
          </div>

          <div className="space-y-3">
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-[#746b61] px-2">
              <div className="col-span-5">Component / Material Name</div>
              <div className="col-span-3">Unit (e.g. mtr, sqft, nos)</div>
              <div className="col-span-3">Selling Rate (₹)</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {addons.map((item, idx) => (
              <div
                key={item.id || `new-addon-${idx}`}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 sm:p-2 border sm:border-0 border-[#e1d8cd] rounded-md bg-[#faf8f5] sm:bg-transparent"
              >
                <div className="sm:col-span-5 flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    disabled={item.is_fixed_grid}
                    onChange={(e) => handleAddonChange(idx, 'name', e.target.value)}
                    placeholder="e.g. Brass Inlay"
                    className="w-full p-2 text-sm border border-[#dcd3c9] rounded-md disabled:bg-[#f4f1eb] disabled:text-[#746b61] focus:outline-none focus:border-[#171512]"
                  />
                  {item.is_fixed_grid && (
                    <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 bg-[#e8e1d7] text-[#5c5349] rounded">
                      Core
                    </span>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleAddonChange(idx, 'unit', e.target.value)}
                    placeholder="mtr / sqft / nos"
                    className="w-full p-2 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleAddonChange(idx, 'rate', e.target.value)}
                    placeholder="0"
                    className="w-full p-2 text-sm font-medium border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-1 text-right">
                  {!item.is_fixed_grid && (
                    <button
                      type="button"
                      onClick={() => deleteAddonRow(idx)}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                    >
                      Del
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addAddonRow}
            className="mt-5 px-4 py-2 border border-dashed border-[#746b61] text-xs font-bold uppercase tracking-wider text-[#171512] rounded-md hover:bg-[#f4f1eb] transition"
          >
            + Add New Component
          </button>
        </div>
      )}

      {/* TAB 2: WOOD REFERENCE RATES */}
      {activeTab === 'woods' && (
        <div className="p-6">
          <div className="mb-4 p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349]">
            Wood rates act as a <strong>visual reference guide</strong> in the Costing Form while you enter the product&apos;s Multiplier (₹/CFT).
          </div>

          <div className="space-y-3">
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-[#746b61] px-2">
              <div className="col-span-7">Wood Species</div>
              <div className="col-span-4">Reference Rate (₹ / CFT)</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {woods.map((wood, idx) => (
              <div
                key={wood.id || `new-wood-${idx}`}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 sm:p-2 border sm:border-0 border-[#e1d8cd] rounded-md bg-[#faf8f5] sm:bg-transparent"
              >
                <div className="sm:col-span-7">
                  <input
                    type="text"
                    value={wood.name}
                    onChange={(e) => handleWoodChange(idx, 'name', e.target.value)}
                    placeholder="e.g. Dandeli Teak"
                    className="w-full p-2 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <input
                    type="number"
                    value={wood.rate_per_cft || ''}
                    onChange={(e) => handleWoodChange(idx, 'rate_per_cft', e.target.value)}
                    placeholder="0"
                    className="w-full p-2 text-sm font-medium border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => deleteWoodRow(idx)}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                  >
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addWoodRow}
            className="mt-5 px-4 py-2 border border-dashed border-[#746b61] text-xs font-bold uppercase tracking-wider text-[#171512] rounded-md hover:bg-[#f4f1eb] transition"
          >
            + Add Wood Type
          </button>
        </div>
      )}
    </div>
  );
}