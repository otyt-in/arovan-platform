'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Settings({ globalSettings, woodMaster, finishingMaster, plywoodMaster, refreshData }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState('wood');
  const [isSaving, setIsSaving] = useState(false);

  const [globals, setGlobals] = useState(globalSettings || { labour_rate: 300, overheads_percent: 20, margin_percent: 40 });
  const [woods, setWoods] = useState(woodMaster || []);
  const [finishes, setFinishes] = useState(finishingMaster || []);
  const [plywoods, setPlywoods] = useState(plywoodMaster || []);

  useEffect(() => {
    if (globalSettings) setGlobals(globalSettings);
    if (woodMaster) setWoods(woodMaster);
    if (finishingMaster) setFinishes(finishingMaster);
    if (plywoodMaster) setPlywoods(plywoodMaster);
  }, [globalSettings, woodMaster, finishingMaster, plywoodMaster]);

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
      if (globalSettings?.id) {
        await supabase.from('global_settings').update({
          labour_rate: parseFloat(globals.labour_rate),
          overheads_percent: parseFloat(globals.overheads_percent),
          margin_percent: parseFloat(globals.margin_percent)
        }).eq('id', globalSettings.id);
      }

      const existingWoods = woods.filter(w => !w.isNew).map(w => ({ id: w.id, name: w.name, rate_per_cft_premium: parseFloat(w.rate_per_cft_premium) }));
      const newWoods = woods.filter(w => w.isNew).map(w => ({ name: w.name, rate_per_cft_premium: parseFloat(w.rate_per_cft_premium) }));
      if (existingWoods.length > 0) await supabase.from('wood_master').upsert(existingWoods);
      if (newWoods.length > 0) await supabase.from('wood_master').insert(newWoods);

      const existingFinishes = finishes.filter(f => !f.isNew).map(f => ({ id: f.id, name: f.name, flat_rate: parseFloat(f.flat_rate) }));
      const newFinishes = finishes.filter(f => f.isNew).map(f => ({ name: f.name, flat_rate: parseFloat(f.flat_rate) }));
      if (existingFinishes.length > 0) await supabase.from('finishing_master').upsert(existingFinishes);
      if (newFinishes.length > 0) await supabase.from('finishing_master').insert(newFinishes);

      const existingPlywoods = plywoods.filter(p => !p.isNew).map(p => ({ id: p.id, name: p.name, rate_per_sheet: parseFloat(p.rate_per_sheet) }));
      const newPlywoods = plywoods.filter(p => p.isNew).map(p => ({ name: p.name, rate_per_sheet: parseFloat(p.rate_per_sheet) }));
      if (existingPlywoods.length > 0) await supabase.from('plywood_master').upsert(existingPlywoods);
      if (newPlywoods.length > 0) await supabase.from('plywood_master').insert(newPlywoods);

      alert("Settings successfully saved to the cloud!");
      refreshData(); 
    } catch (error) {
      alert("Error saving settings: " + error.message);
    }
    setIsSaving(false);
  };

  const addWood = () => setWoods([...woods, { isNew: true, name: 'New Wood', rate_per_cft_premium: 0 }]);
  const deleteWood = async (index, id) => {
    if (confirm("Delete this wood type?")) {
      if (id) await supabase.from('wood_master').delete().eq('id', id);
      setWoods(woods.filter((_, i) => i !== index));
      refreshData();
    }
  };

  const addFinish = () => setFinishes([...finishes, { isNew: true, name: 'New Finish', flat_rate: 0 }]);
  const deleteFinish = async (index, id) => {
    if (confirm("Delete this finish type?")) {
      if (id) await supabase.from('finishing_master').delete().eq('id', id);
      setFinishes(finishes.filter((_, i) => i !== index));
      refreshData();
    }
  };

  const addPlywood = () => setPlywoods([...plywoods, { isNew: true, name: 'New Plywood', rate_per_sheet: 0 }]);
  const deletePlywood = async (index, id) => {
    if (confirm("Delete this plywood type?")) {
      if (id) await supabase.from('plywood_master').delete().eq('id', id);
      setPlywoods(plywoods.filter((_, i) => i !== index));
      refreshData();
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-[#e1d8cd] shadow-sm max-w-sm mx-auto mt-10">
        <h2 className="font-serif text-xl mb-2 brand-serif text-[#171512]">Admin Configuration</h2>
        <p className="text-xs text-[#746b61] mb-6 text-center">Enter PIN to manage master rates and margins.</p>
        <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3">
          <input type="password" placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full p-3 border border-[#dcd3c9] rounded-md text-center tracking-[0.5em] focus:outline-none focus:border-[#171512]" autoFocus />
          <button type="submit" className="w-full py-3 bg-[#171512] text-white text-sm font-bold uppercase tracking-wider rounded-md">Unlock</button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#e1d8cd] shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#e1d8cd] flex justify-between items-center bg-[#fdfcfb]">
        <div>
          <h2 className="text-lg font-medium text-gray-800">Master Configuration</h2>
          <p className="text-xs text-[#746b61] mt-1">Changes made here affect all future product calculations.</p>
        </div>
        <button onClick={handleSaveToCloud} disabled={isSaving} className="px-6 py-2.5 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-50 transition">
          {isSaving ? 'Saving to Cloud...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex border-b border-[#e1d8cd] bg-[#fdfcfb]">
        <button onClick={() => setActiveTab('wood')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'wood' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61] hover:text-[#171512]'}`}>Wood Master</button>
        <button onClick={() => setActiveTab('finishing')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'finishing' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61] hover:text-[#171512]'}`}>Finishing Master</button>
        <button onClick={() => setActiveTab('plywood')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'plywood' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61] hover:text-[#171512]'}`}>Plywood Master</button>
        <button onClick={() => setActiveTab('globals')} className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'globals' ? 'border-[#171512] text-[#171512]' : 'border-transparent text-[#746b61] hover:text-[#171512]'}`}>Global Margins</button>
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
                <input type="text" value={w.name} onChange={(e) => { const nw = [...woods]; nw[index].name = e.target.value; setWoods(nw); }} className="col-span-6 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <input type="number" value={w.rate_per_cft_premium} onChange={(e) => { const nw = [...woods]; nw[index].rate_per_cft_premium = e.target.value; setWoods(nw); }} className="col-span-4 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <button onClick={() => deleteWood(index, w.id)} className="col-span-2 text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-wider text-right px-2 transition">Delete</button>
              </div>
            ))}
            <button onClick={addWood} className="mt-4 text-xs font-bold uppercase tracking-wider text-[#171512] border border-[#dcd3c9] px-4 py-2.5 rounded-md hover:bg-[#f4f1eb] transition">+ Add Wood Type</button>
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
                <input type="text" value={f.name} onChange={(e) => { const nf = [...finishes]; nf[index].name = e.target.value; setFinishes(nf); }} className="col-span-6 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <input type="number" value={f.flat_rate} onChange={(e) => { const nf = [...finishes]; nf[index].flat_rate = e.target.value; setFinishes(nf); }} className="col-span-4 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <button onClick={() => deleteFinish(index, f.id)} className="col-span-2 text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-wider text-right px-2 transition">Delete</button>
              </div>
            ))}
            <button onClick={addFinish} className="mt-4 text-xs font-bold uppercase tracking-wider text-[#171512] border border-[#dcd3c9] px-4 py-2.5 rounded-md hover:bg-[#f4f1eb] transition">+ Add Finish Type</button>
          </div>
        )}

        {activeTab === 'plywood' && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-12 gap-4 mb-3 text-xs font-bold text-[#746b61] uppercase tracking-wider px-2">
              <div className="col-span-6">Plywood Type</div>
              <div className="col-span-4">Rate (₹ / Sheet)</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {plywoods.map((p, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center mb-3">
                <input type="text" value={p.name} onChange={(e) => { const np = [...plywoods]; np[index].name = e.target.value; setPlywoods(np); }} className="col-span-6 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <input type="number" value={p.rate_per_sheet} onChange={(e) => { const np = [...plywoods]; np[index].rate_per_sheet = e.target.value; setPlywoods(np); }} className="col-span-4 p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
                <button onClick={() => deletePlywood(index, p.id)} className="col-span-2 text-red-400 hover:text-red-600 text-xs font-bold uppercase tracking-wider text-right px-2 transition">Delete</button>
              </div>
            ))}
            <button onClick={addPlywood} className="mt-4 text-xs font-bold uppercase tracking-wider text-[#171512] border border-[#dcd3c9] px-4 py-2.5 rounded-md hover:bg-[#f4f1eb] transition">+ Add Plywood Type</button>
          </div>
        )}

        {activeTab === 'globals' && (
          <div className="max-w-md flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Default Labour Rate (₹/Hr)</label>
              <input type="number" value={globals.labour_rate} onChange={(e) => setGlobals({...globals, labour_rate: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Standard Overheads (%)</label>
              <input type="number" value={globals.overheads_percent} onChange={(e) => setGlobals({...globals, overheads_percent: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a443e] mb-1.5">Target Profit Margin (%)</label>
              <input type="number" value={globals.margin_percent} onChange={(e) => setGlobals({...globals, margin_percent: e.target.value})} className="w-full p-2 border border-[#dcd3c9] rounded-md text-sm bg-[#fdfcfb]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}