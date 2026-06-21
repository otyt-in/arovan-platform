'use client';
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Settings({ globalSettings, woodMaster, finishingMaster, refreshData }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState('wood');
  const [isSaving, setIsSaving] = useState(false);

  // Local state to hold edits before pushing to the cloud
  const [globals, setGlobals] = useState(globalSettings || { labour_rate: 300, overheads_percent: 20, margin_percent: 40 });
  const [woods, setWoods] = useState(woodMaster || []);
  const [finishes, setFinishes] = useState(finishingMaster || []);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pin === '2026') {
      setIsUnlocked(true);
    } else {
      alert('Incorrect PIN. Access Denied.');
      setPin('');
    }
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    try {
      // 1. Save Globals
      if (globalSettings?.id) {
        await supabase.from('global_settings').update({
          labour_rate: parseFloat(globals.labour_rate),
          overheads_percent: parseFloat(globals.overheads_percent),
          margin_percent: parseFloat(globals.margin_percent)
        }).eq('id', globalSettings.id);
      }

      // 2. Save Wood Master (Upsert handles both updating old ones and inserting new ones)
      const woodPayload = woods.map(w => w.isNew 
        ? { name: w.name, rate_per_cft_premium: parseFloat(w.rate_per_cft_premium) } 
        : { id: w.id, name: w.name, rate_per_cft_premium: parseFloat(w.rate_per_cft_premium) }
      );
      if (woodPayload.length > 0) await supabase.from('wood_master').upsert(woodPayload);

      // 3. Save Finishing Master
      const finishPayload = finishes.map(f => f.isNew 
        ? { name: f.name, flat_rate: parseFloat(f.flat_rate) } 
        : { id: f.id, name: f.name, flat_rate: parseFloat(f.flat_rate) }
      );
      if (finishPayload.length > 0) await supabase.from('finishing_master').upsert(finishPayload);

      alert("Settings successfully saved to the cloud!");
      refreshData(); // Tells the main page to re-download the fresh data
    } catch (error) {
      alert("Error saving settings: " + error.message);
    }
    setIsSaving(false);
  };

  // Row Management Functions
  const addWood = () => setWoods([...woods, { isNew: true, name: 'New Wood', rate_per_cft_premium: 0 }]);
  const deleteWood = async (index, id) => {
    if (confirm("Delete this wood type?")) {
      if (id) await supabase.from('wood_master').delete().eq('id', id);
      setWoods(woods.filter((_, i) => i !== index));
    }
  };

  const addFinish = () => setFinishes([...finishes, { isNew: true, name: 'New Finish', flat_rate: 0 }]);
  const deleteFinish = async (index, id) => {
    if (confirm("Delete this finish type?")) {
      if (id) await supabase.from('finishing_master').delete().eq('id', id);
      setFinishes(finishes.filter((_, i) => i !== index));
    }
  };

  // --- SECURITY GATE ---
  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-[#e1d8cd] shadow-sm max-w-sm mx-auto mt-10">
        <h2 className="font-serif text-xl mb-2">Admin Configuration</h2>
        <p className="text-xs text-[#746b61] mb-6 text-center">Enter PIN to manage master rates and margins.</p>
        <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3">
          <input 
            type="password" 
            placeholder="••••" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-3 border border-[#dcd3c9] rounded-md text-center tracking-[0.5em] focus:outline-none focus:border-[#171512]"
            autoFocus
          />
          <button type="submit" className="w-full py-3 bg-[#171512] text-white text-sm font-medium rounded-md">Unlock</button>
        </form>
      </div>
    );
  }

  // --- SETTINGS UI ---
  return (
    <div className="bg-white rounded-lg border border-[#e1d8cd] shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#e1d8cd] flex justify-between items-center bg-[#fdfcfb]">
        <div>
          <h2 className="text-lg font-medium text-gray-800">Master Configuration</h2>
          <p className="text-xs text-[#746b61] mt-1">Changes made here affect all future product calculations.</p>
        </div>
        <button 
          onClick={handleSaveToCloud}
          disabled={isSaving}
          className="px-6 py-2.5 bg-[#171512] text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50"
        >
          {isSaving ? 'Saving to Cloud...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex border-b border-[#e1d8cd] bg-[#fdfcfb]">
        <button onClick={() => setActiveTab('wood')} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'wood' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61]'}`}>Wood Master</button>
        <button onClick={() => setActiveTab('finishing')} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'finishing' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61]'}`}>Finishing Master</button>
        <button onClick={() => setActiveTab('globals')} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'globals' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61]'}`}>Global Margins</button>
      </div>

      <div className="p-6">
        {activeTab === 'wood' && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-12 gap-4 mb-3 text-xs font-bold text-[#746b61] uppercase tracking-wider px-2">
              <div className="col-span-6">Wood Type</div>
              <div className="col-span-4">Rate (₹ / CFT)</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {woods.map((w, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center mb-3">
                <input type="text" value={w.name} onChange={(e) => { const nw = [...woods]; nw[index].name = e.target.value; setWoods(nw); }} className="col-span-6 p-2 border border-[#dcd3c9] rounded-md text-sm" />
                <input type="number" value={w.rate_per_cft_premium} onChange={(e) => { const nw = [...woods]; nw[index].rate_per_cft_premium = e.target.value; setWoods(nw); }} className="col-span-4 p-2 border border-[#dcd3c9] rounded-md text-sm" />
                <button onClick={() => deleteWood(index, w.id)} className="col-span-2 text-red-500 hover:text-red-700 text-sm text-right px-2">Delete</button>
              </div>
            ))}
            <button onClick={addWood} className="mt-4 text-sm font-medium text-[#171512] border border-[#dcd3c9] px-4 py-2 rounded-md hover:bg-[#f4f1eb]">+ Add Wood Type</button>
          </div>
        )}

        {activeTab === 'finishing' && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-12 gap-4 mb-3 text-xs font-bold text-[#746b61] uppercase tracking-wider px-2">
              <div className="col-span-6">Finishing Type</div>
              <div className="col-span-4">Flat Cost (₹)</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {finishes.map((f, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center mb-3">
                <input type="text" value={f.name} onChange={(e) => { const nf = [...finishes]; nf[index].name = e.target.value; setFinishes(nf); }} className="col-span-6 p-2 border border-[#dcd3c9] rounded-md text-sm" />
                <input type="number" value={f.flat_rate} onChange={(e) => { const nf = [...finishes]; nf[index].flat_rate = e.target.value; setFinishes(nf); }} className="col-span-4 p-2 border border-[#dcd3c9] rounded-md text-sm" />
                <button onClick={() => deleteFinish(index, f.id)} className="col-span-2 text-red-500 hover:text-red-700 text-sm text-right px-2">Delete</button>
              </div>
            ))}
            <button onClick={addFinish} className="mt-4 text-sm font-medium text-[#171512] border border-[#dcd3c9] px-4 py-2 rounded-md hover:bg-[#f4f1eb]">+ Add Finish Type</button>
          </div>
        )}

        {activeTab === 'globals' && (
          <div className="max-w-md flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Default Labour Rate (₹/Hr)</label>
              <input type="number" value={globals.labour_rate} onChange={(e) => setGlobals({...globals, labour_rate: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Standard Overheads (%)</label>
              <input type="number" value={globals.overheads_percent} onChange={(e) => setGlobals({...globals, overheads_percent: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Target Profit Margin (%)</label>
              <input type="number" value={globals.margin_percent} onChange={(e) => setGlobals({...globals, margin_percent: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}