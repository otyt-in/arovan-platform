'use client';
import { useState, useEffect } from 'react';
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

// Helper: Calculate 18% reverse-GST rounded quote price for a product row
const computeProductQuote = (product, addonsList) => {
  const cft = parseFloat(product.wood_cft) || 0;
  const mult = parseFloat(product.multiplier) || 0;
  const baseWoodCost = cft * mult;

  const miscList = Array.isArray(product.addons) ? product.addons : [];
  const addonsCost = miscList.reduce((sum, item) => {
    const master = addonsList.find(a => a.id === item.addon_id);
    const isCushion = master?.name?.toLowerCase().includes('cushion');
    const isPerUnit = master?.pricing_type === 'per_unit' && !isCushion;

    const enteredVal = parseFloat(item.qty) || 0;
    const count = parseFloat(item.count ?? 1) || 0;

    const itemCost = isCushion
      ? enteredVal * count
      : isPerUnit
      ? enteredVal * (master?.rate || 0)
      : enteredVal;

    return sum + itemCost;
  }, 0);

  const packagingCost = parseFloat(product.packaging_cost) || 0;
  const rawSubtotal = baseWoodCost + addonsCost + packagingCost;
  const rawInclGst = rawSubtotal * 1.18;
  return rawInclGst > 0 ? Math.ceil(rawInclGst / 1000) * 1000 : 0;
};

// Helper: Append snapshot to last 3 price history entries only if price changed
const appendPriceHistory = (existingHistory, oldPrice, newPrice, reason) => {
  const history = Array.isArray(existingHistory) ? [...existingHistory] : [];
  if (!newPrice || oldPrice === newPrice) return history;

  const entry = {
    price: newPrice,
    prev_price: oldPrice || 0,
    reason,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
  };

  return [entry, ...history].slice(0, 3);
};

export default function Settings({
  woodMaster,
  addonsMaster,
  categoryWoodRules,
  productLibrary,
  refreshData
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('woods');
  const [saving, setSaving] = useState(false);
  const [addingRule, setAddingRule] = useState(false);

  // Master local states
  const [woods, setWoods] = useState([]);
  const [addons, setAddons] = useState([]);
  const [rules, setRules] = useState([]);

  // Quick-Add Rule bar states (Wood Type first, then Category)
  const [newRuleWoodId, setNewRuleWoodId] = useState('');
  const [newRuleCat, setNewRuleCat] = useState('Dining Tables');
  const [newRuleMult, setNewRuleMult] = useState('');

  // Rule Filtering & Accordion States
  const [selectedWoodFilter, setSelectedWoodFilter] = useState('all');
  const [ruleCategorySearch, setRuleCategorySearch] = useState('');
  const [expandedWoods, setExpandedWoods] = useState({});

  // Bulk % Adjustment states
  const [bulkScope, setBulkScope] = useState('component'); // 'component' or 'category'
  const [bulkTargetId, setBulkTargetId] = useState('');
  const [bulkPercent, setBulkPercent] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);

  // Helper: Prefill multiplier from existing rule or wood reference rate
  const getSuggestedRuleMultiplier = (woodId, cat, rulesList = rules, woodsList = woods) => {
    const matchedRule = (rulesList || []).find(
      r => r.category === cat && String(r.wood_type_id) === String(woodId)
    );
    if (matchedRule && Number(matchedRule.multiplier) > 0) {
      return String(matchedRule.multiplier);
    }
    const matchedWood = (woodsList || []).find(w => String(w.id) === String(woodId));
    if (matchedWood && Number(matchedWood.rate_per_cft) > 0) {
      return String(matchedWood.rate_per_cft);
    }
    return '';
  };

  useEffect(() => {
    if (woodMaster) {
      setWoods(woodMaster);
      const initialWoodId = newRuleWoodId || (woodMaster[0]?.id ? String(woodMaster[0].id) : '');
      if (!newRuleWoodId && initialWoodId) {
        setNewRuleWoodId(initialWoodId);
      }
      if (newRuleMult === '' && initialWoodId) {
        const suggested = getSuggestedRuleMultiplier(
          initialWoodId,
          newRuleCat,
          categoryWoodRules || rules,
          woodMaster
        );
        if (suggested) setNewRuleMult(suggested);
      }
    }
    if (addonsMaster) {
      setAddons(addonsMaster);
      if (bulkScope === 'component' && !bulkTargetId && addonsMaster.length > 0) {
        setBulkTargetId(String(addonsMaster[0].id));
      }
    }
    if (categoryWoodRules) {
      setRules(categoryWoodRules);
      // Expand the first wood that has rules by default
      if (categoryWoodRules.length > 0 && Object.keys(expandedWoods).length === 0) {
        const firstWoodKey = String(categoryWoodRules[0].wood_type_id);
        setExpandedWoods({ [firstWoodKey]: true });
      }
    }
  }, [woodMaster, addonsMaster, categoryWoodRules]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pinInput === '2026') {
      setUnlocked(true);
    } else {
      alert('Incorrect Admin PIN. Access Denied.');
      setPinInput('');
    }
  };

  // --- CATEGORY x WOOD RULES HANDLERS ---
  const handleSelectRuleWood = (woodId) => {
    setNewRuleWoodId(woodId);
    setNewRuleMult(getSuggestedRuleMultiplier(woodId, newRuleCat));
  };

  const handleSelectRuleCat = (cat) => {
    setNewRuleCat(cat);
    setNewRuleMult(getSuggestedRuleMultiplier(newRuleWoodId, cat));
  };

  const handleAddOrUpdateRule = async (e) => {
    e.preventDefault();
    const woodIdNum = parseInt(newRuleWoodId, 10);
    const multNum = parseFloat(newRuleMult) || 0;
    if (!newRuleCat || !woodIdNum || multNum <= 0) {
      alert('Please select a Wood Type, Product Category, and enter a valid Multiplier (> 0).');
      return;
    }

    setAddingRule(true);
    try {
      const existingRule = rules.find(
        r => r.category === newRuleCat && String(r.wood_type_id) === String(woodIdNum)
      );

      if (existingRule?.id) {
        const { error } = await supabase
          .from('category_wood_rules')
          .update({
            multiplier: multNum,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('category_wood_rules')
          .insert({
            category: newRuleCat,
            wood_type_id: woodIdNum,
            multiplier: multNum,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      setExpandedWoods(prev => ({ ...prev, [String(woodIdNum)]: true }));
      await refreshData();
      alert(`Rule saved for ${newRuleCat}!`);
    } catch (err) {
      console.error('Error saving rule:', err);
      alert('Could not save rule to database: ' + err.message);
    } finally {
      setAddingRule(false);
    }
  };

  const handleRuleMultById = (woodTypeId, category, val) => {
    const numVal = parseFloat(val) || 0;
    setRules(prev =>
      prev.map(r =>
        r.category === category && String(r.wood_type_id) === String(woodTypeId)
          ? { ...r, multiplier: numVal }
          : r
      )
    );
  };

  const deleteRuleById = async (ruleItem) => {
    if (ruleItem.id) {
      if (!confirm('Delete this Wood × Category multiplier rule?')) return;
      const { error } = await supabase.from('category_wood_rules').delete().eq('id', ruleItem.id);
      if (error) {
        alert('Failed to delete rule: ' + error.message);
        return;
      }
      await refreshData();
    } else {
      setRules(prev =>
        prev.filter(
          r => !(r.category === ruleItem.category && String(r.wood_type_id) === String(ruleItem.wood_type_id))
        )
      );
    }
  };

  const toggleWoodAccordion = (woodKey) => {
    setExpandedWoods(prev => ({ ...prev, [woodKey]: !prev[woodKey] }));
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
    setAddons([
      ...addons,
      {
        name: '',
        unit: 'lump sum',
        rate: 0,
        is_fixed_grid: false,
        pricing_type: 'lump_sum',
        isNew: true
      }
    ]);
  };

  const deleteAddonRow = async (index) => {
    const item = addons[index];
    if (item.id) {
      if (!confirm(`Delete "${item.name}" from Add-ons Master?`)) return;
      await supabase.from('addons_master').delete().eq('id', item.id);
      await refreshData();
    } else {
      setAddons(addons.filter((_, i) => i !== index));
    }
  };

  // --- SAVE ALL SETTINGS & AUTO-RECALCULATE MATCHING PRODUCTS ---
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
        .map(({ name, unit, rate, pricing_type }) => ({
          name: name.trim(),
          unit: unit.trim() || 'lump sum',
          rate: rate || 0,
          is_fixed_grid: false,
          pricing_type: pricing_type || 'lump_sum'
        }));

      const savedAddonsSnapshot = [
        ...existingAddons.map(({ id, name, unit, rate, pricing_type }) => ({
          id,
          name: name.trim(),
          unit: unit.trim() || 'lump sum',
          rate: rate || 0,
          is_fixed_grid: false,
          pricing_type: pricing_type || 'lump_sum'
        })),
        ...newAddons
      ];

      if (existingAddons.length > 0) {
        const cleanExistingAddons = existingAddons.map(
          ({ id, name, unit, rate, pricing_type }) => ({
            id,
            name: name.trim(),
            unit: unit.trim() || 'lump sum',
            rate: rate || 0,
            is_fixed_grid: false,
            pricing_type: pricing_type || 'lump_sum'
          })
        );
        const { error } = await supabase.from('addons_master').upsert(cleanExistingAddons);
        if (error) throw error;
      }
      if (newAddons.length > 0) {
        const { error } = await supabase.from('addons_master').insert(newAddons);
        if (error) throw error;
      }

      // 3. Save Wood x Category Rules (split existing vs new)
      const validRules = rules.filter(r => r.category && r.wood_type_id && r.multiplier > 0);
      const existingRules = validRules
        .filter(r => r.id)
        .map(r => ({
          id: r.id,
          category: r.category,
          wood_type_id: parseInt(r.wood_type_id, 10),
          multiplier: parseFloat(r.multiplier) || 0,
          updated_at: new Date().toISOString()
        }));
      const newRules = validRules
        .filter(r => !r.id)
        .map(r => ({
          category: r.category,
          wood_type_id: parseInt(r.wood_type_id, 10),
          multiplier: parseFloat(r.multiplier) || 0,
          updated_at: new Date().toISOString()
        }));

      if (existingRules.length > 0) {
        const { error } = await supabase
          .from('category_wood_rules')
          .upsert(existingRules);
        if (error) throw error;
      }
      if (newRules.length > 0) {
        const { error } = await supabase
          .from('category_wood_rules')
          .insert(newRules);
        if (error) throw error;
      }

      // 4. Auto-Recalculate Configured Products in product_master
      let updatedProductsCount = 0;
      if (Array.isArray(productLibrary) && productLibrary.length > 0) {
        const productUpdates = [];

        for (const prod of productLibrary) {
          const matchingRule = validRules.find(
            r =>
              r.category === prod.category &&
              String(r.wood_type_id) === String(prod.wood_type_id)
          );

          const effectiveMultiplier = matchingRule
            ? parseFloat(matchingRule.multiplier)
            : parseFloat(prod.multiplier) || 0;

          const updatedProd = {
            ...prod,
            multiplier: effectiveMultiplier
          };

          const oldPrice = computeProductQuote(prod, addonsMaster);
          const newPrice = computeProductQuote(updatedProd, savedAddonsSnapshot);

          const multChanged =
            matchingRule && parseFloat(prod.multiplier) !== parseFloat(matchingRule.multiplier);
          const priceChanged = oldPrice !== newPrice;

          if (multChanged || priceChanged) {
            const updatedHistory = appendPriceHistory(
              prod.price_history,
              oldPrice,
              newPrice,
              multChanged ? 'Rule sync' : 'Rate sync'
            );

            productUpdates.push({
              sku: prod.sku,
              multiplier: effectiveMultiplier,
              estimated_selling_price: newPrice,
              price_history: updatedHistory,
              modified_at: new Date().toISOString()
            });
          }
        }

        if (productUpdates.length > 0) {
          for (const upd of productUpdates) {
            const { error: prodErr } = await supabase
              .from('product_master')
              .update({
                multiplier: upd.multiplier,
                estimated_selling_price: upd.estimated_selling_price,
                price_history: upd.price_history,
                modified_at: upd.modified_at
              })
              .eq('sku', upd.sku);
            if (prodErr) throw prodErr;
          }
          updatedProductsCount = productUpdates.length;
        }
      }

      await refreshData();
      alert(
        updatedProductsCount > 0
          ? `Configuration saved! ${updatedProductsCount} product(s) automatically recalculated and logged.`
          : 'Configuration saved! All rates are synced.'
      );
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- BULK % PRICE ADJUSTMENT HANDLER ---
  const matchingBulkProducts = (productLibrary || []).filter(prod => {
    if (!bulkTargetId) return false;
    if (bulkScope === 'category') {
      return prod.category === bulkTargetId;
    }
    const list = Array.isArray(prod.addons) ? prod.addons : [];
    return list.some(a => String(a.addon_id) === String(bulkTargetId));
  });

  const handleApplyBulkAdjustment = async () => {
    const pct = parseFloat(bulkPercent);
    if (isNaN(pct) || pct === 0) {
      alert('Please enter a non-zero percentage (e.g. 10 for +10%, or -5 for -5%).');
      return;
    }
    if (matchingBulkProducts.length === 0) {
      alert('No saved products match this selection.');
      return;
    }

    const factor = 1 + pct / 100;
    const signLabel = pct > 0 ? `+${pct}%` : `${pct}%`;
    const targetName =
      bulkScope === 'category'
        ? bulkTargetId
        : addons.find(a => String(a.id) === String(bulkTargetId))?.name || 'Component';

    if (
      !confirm(
        `Apply ${signLabel} adjustment to "${targetName}" across ${matchingBulkProducts.length} product(s)?`
      )
    ) {
      return;
    }

    setBulkRunning(true);
    try {
      if (bulkScope === 'component') {
        const targetAddon = addons.find(a => String(a.id) === String(bulkTargetId));
        const isPerUnit =
          targetAddon?.pricing_type === 'per_unit' &&
          !targetAddon?.name?.toLowerCase().includes('cushion');

        let updatedAddonsList = [...addons];
        if (isPerUnit && targetAddon) {
          const newRate = Math.round((parseFloat(targetAddon.rate) || 0) * factor);
          const { error: addonErr } = await supabase
            .from('addons_master')
            .update({ rate: newRate })
            .eq('id', targetAddon.id);
          if (addonErr) throw addonErr;

          updatedAddonsList = addons.map(a =>
            a.id === targetAddon.id ? { ...a, rate: newRate } : a
          );
        }

        for (const prod of matchingBulkProducts) {
          const oldPrice = computeProductQuote(prod, addonsMaster);
          const updatedProdAddons = (prod.addons || []).map(item => {
            if (String(item.addon_id) !== String(bulkTargetId)) return item;
            if (!isPerUnit) {
              return {
                ...item,
                qty: Math.round((parseFloat(item.qty) || 0) * factor)
              };
            }
            return item;
          });

          const updatedProd = {
            ...prod,
            addons: updatedProdAddons
          };

          const newPrice = computeProductQuote(updatedProd, updatedAddonsList);
          const updatedHistory = appendPriceHistory(
            prod.price_history,
            oldPrice,
            newPrice,
            `Bulk ${signLabel} (${targetName})`
          );

          const { error } = await supabase
            .from('product_master')
            .update({
              addons: updatedProdAddons,
              estimated_selling_price: newPrice,
              price_history: updatedHistory,
              modified_at: new Date().toISOString()
            })
            .eq('sku', prod.sku);
          if (error) throw error;
        }
      } else {
        for (const prod of matchingBulkProducts) {
          const oldPrice = computeProductQuote(prod, addonsMaster);
          const newMult = Math.round((parseFloat(prod.multiplier) || 0) * factor);
          const updatedProdAddons = (prod.addons || []).map(item => {
            const master = addonsMaster.find(a => a.id === item.addon_id);
            const isPerUnit =
              master?.pricing_type === 'per_unit' &&
              !master?.name?.toLowerCase().includes('cushion');
            if (!isPerUnit) {
              return {
                ...item,
                qty: Math.round((parseFloat(item.qty) || 0) * factor)
              };
            }
            return item;
          });

          const updatedProd = {
            ...prod,
            multiplier: newMult,
            addons: updatedProdAddons
          };

          const newPrice = computeProductQuote(updatedProd, addonsMaster);
          const updatedHistory = appendPriceHistory(
            prod.price_history,
            oldPrice,
            newPrice,
            `Bulk ${signLabel} (${targetName})`
          );

          const { error } = await supabase
            .from('product_master')
            .update({
              multiplier: newMult,
              addons: updatedProdAddons,
              estimated_selling_price: newPrice,
              price_history: updatedHistory,
              modified_at: new Date().toISOString()
            })
            .eq('sku', prod.sku);
          if (error) throw error;
        }
      }

      setBulkPercent('');
      await refreshData();
      alert(`Bulk ${signLabel} adjustment applied across ${matchingBulkProducts.length} product(s)!`);
    } catch (err) {
      console.error('Bulk adjustment error:', err);
      alert('Failed to apply bulk adjustment: ' + err.message);
    } finally {
      setBulkRunning(false);
    }
  };

  // --- GROUP & FILTER RULES BY WOOD TYPE ---
  const filteredRules = rules.filter(r => {
    const matchesWood =
      selectedWoodFilter === 'all' || String(r.wood_type_id) === String(selectedWoodFilter);
    const q = ruleCategorySearch.toLowerCase().trim();
    const matchesCat = !q || (r.category || '').toLowerCase().includes(q);
    return matchesWood && matchesCat;
  });

  const groupedRulesByWood = filteredRules.reduce((acc, rule) => {
    const key = String(rule.wood_type_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(rule);
    return acc;
  }, {});

  const woodGroupsSorted = Object.entries(groupedRulesByWood).sort(([keyA], [keyB]) => {
    const nameA = woods.find(w => String(w.id) === keyA)?.name || '';
    const nameB = woods.find(w => String(w.id) === keyB)?.name || '';
    return nameA.localeCompare(nameB);
  });

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
    <div className="max-w-5xl mx-auto bg-white rounded-lg border border-[#e1d8cd] shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#e1d8cd] bg-[#faf8f5]">
        <div>
          <h2 className="font-serif text-xl text-[#171512]">Master Rate Configuration</h2>
          <p className="text-xs text-[#746b61] mt-0.5">
            Saving rules or rates automatically recalculates affected products and logs price changes.
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-5 py-2.5 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-black transition disabled:opacity-50"
        >
          {saving ? 'Saving & Recalculating...' : 'Save & Recalculate All'}
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-[#e1d8cd] px-6 bg-white no-scrollbar">
        <button
          onClick={() => setActiveTab('woods')}
          className={`shrink-0 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'woods'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Wood Types ({woods.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`shrink-0 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'rules'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Cat × Wood Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('addons')}
          className={`shrink-0 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'addons'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Add-ons ({addons.length})
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`shrink-0 py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'bulk'
              ? 'border-[#171512] text-[#171512]'
              : 'border-transparent text-[#746b61] hover:text-[#171512]'
          }`}
        >
          Bulk Adjust
        </button>
      </div>

      {/* TAB 1: WOOD TYPES */}
      {activeTab === 'woods' && (
        <div className="p-6">
          <div className="mb-4 p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349]">
            Manage your wood species and base reference rates here; these pre-fill multipliers in <strong>Cat × Wood Rules</strong>.
          </div>

          <div className="space-y-3">
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-[#746b61] px-2">
              <div className="col-span-7">Wood Species</div>
              <div className="col-span-4">Base Reference Multiplier (₹ / CFT)</div>
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

      {/* TAB 2: WOOD x CATEGORY MULTIPLIER RULES (GROUPED BY WOOD + FILTERABLE) */}
      {activeTab === 'rules' && (
        <div className="p-6 space-y-5">
          <div className="p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349]">
            Pick a <strong>Wood Type</strong> first—the multiplier pre-fills from the wood&apos;s base rate or existing rule so you can adjust it per <strong>Product Category</strong>. Click <strong>Save &amp; Recalculate All</strong> at top right to sync saved products.
          </div>

          {/* Quick-Add Bar: Wood Type first, Product Category second */}
          <form
            onSubmit={handleAddOrUpdateRule}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-[#faf8f5] p-4 rounded-lg border border-[#e1d8cd]"
          >
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1">
                Wood Type
              </label>
              <select
                value={newRuleWoodId}
                onChange={(e) => handleSelectRuleWood(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              >
                {woods.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1">
                Product Category
              </label>
              <select
                value={newRuleCat}
                onChange={(e) => handleSelectRuleCat(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1">
                Multiplier (₹/CFT)
              </label>
              <input
                type="number"
                value={newRuleMult}
                onChange={(e) => setNewRuleMult(e.target.value)}
                placeholder="e.g. 14000"
                className="w-full h-9 px-2.5 text-xs font-semibold bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addingRule}
                className="w-full h-9 bg-[#171512] text-white text-[11px] font-bold uppercase tracking-wider rounded-md hover:bg-black transition disabled:opacity-50"
              >
                {addingRule ? 'Saving...' : '+ Add Rule'}
              </button>
            </div>
          </form>

          {/* Filter Pills + Category Filter Input */}
          {rules.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedWoodFilter('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                    selectedWoodFilter === 'all'
                      ? 'bg-[#171512] text-white'
                      : 'bg-[#f4f1eb] text-[#5c5349] hover:bg-[#e8e1d7]'
                  }`}
                >
                  All ({rules.length})
                </button>
                {woods.map(w => {
                  const countForWood = rules.filter(r => String(r.wood_type_id) === String(w.id)).length;
                  if (countForWood === 0) return null;
                  const active = String(selectedWoodFilter) === String(w.id);
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setSelectedWoodFilter(String(w.id));
                        setExpandedWoods(prev => ({ ...prev, [String(w.id)]: true }));
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
                        active
                          ? 'bg-[#171512] text-white'
                          : 'bg-[#f4f1eb] text-[#5c5349] hover:bg-[#e8e1d7]'
                      }`}
                    >
                      {w.name} ({countForWood})
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={ruleCategorySearch}
                onChange={(e) => setRuleCategorySearch(e.target.value)}
                placeholder="Filter category (e.g. Chairs)..."
                className="w-full sm:w-56 h-8 px-3 text-xs border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              />
            </div>
          )}

          {/* Collapsible Wood Accordions */}
          {woodGroupsSorted.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-[#dcd3c9] rounded-lg">
              <p className="text-xs text-[#746b61]">
                No matching Wood × Category rules found.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {woodGroupsSorted.map(([woodKey, woodRules]) => {
                const woodName =
                  woods.find(w => String(w.id) === woodKey)?.name || 'Wood';
                const isOpen =
                  ruleCategorySearch.trim() !== '' || selectedWoodFilter !== 'all'
                    ? true
                    : Boolean(expandedWoods[woodKey]);

                const sortedWoodRules = [...woodRules].sort((a, b) =>
                  (a.category || '').localeCompare(b.category || '')
                );

                return (
                  <div
                    key={woodKey}
                    className="border border-[#e1d8cd] rounded-lg overflow-hidden bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggleWoodAccordion(woodKey)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-[#faf8f5] hover:bg-[#f4f1eb] transition text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-[#171512]">{woodName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8e1d7] text-[#5c5349]">
                          {sortedWoodRules.length} {sortedWoodRules.length === 1 ? 'category' : 'categories'}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-[#746b61]">
                        {isOpen ? '▲ Hide' : '▼ View'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="p-3.5 space-y-2 border-t border-[#e1d8cd]">
                        {sortedWoodRules.map((rule) => {
                          const affectedCount = (productLibrary || []).filter(
                            p =>
                              p.category === rule.category &&
                              String(p.wood_type_id) === String(rule.wood_type_id)
                          ).length;

                          return (
                            <div
                              key={rule.id || `${rule.wood_type_id}-${rule.category}`}
                              className="grid grid-cols-12 gap-2.5 items-center px-3 py-2 rounded-md bg-[#faf8f5] border border-[#ece5dc]"
                            >
                              <div className="col-span-6 sm:col-span-6 flex items-center gap-2">
                                <span className="text-xs font-semibold text-[#171512]">
                                  {rule.category}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e8e1d7] text-[#5c5349] font-medium">
                                  {affectedCount} prod
                                </span>
                              </div>

                              <div className="col-span-4 sm:col-span-4">
                                <input
                                  type="number"
                                  value={rule.multiplier}
                                  onChange={(e) =>
                                    handleRuleMultById(rule.wood_type_id, rule.category, e.target.value)
                                  }
                                  className="w-full h-8 px-2.5 text-xs font-bold bg-white border border-[#dcd3c9] rounded focus:outline-none focus:border-[#171512]"
                                />
                              </div>

                              <div className="col-span-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteRuleById(rule)}
                                  className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-1"
                                >
                                  Del
                                </button>
                              </div>
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

      {/* TAB 3: ADD-ONS & COMPONENTS MASTER */}
      {activeTab === 'addons' && (
        <div className="p-6">
          <div className="mb-4 p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349]">
            <strong>Per-Unit (Qty × Rate):</strong> Used for Rattan &amp; Plywood (calculates automatically).{' '}
            <strong>Lump-Sum (Ref Hint):</strong> Shows the rate as a reference hint while you enter manual pricing per product.
          </div>

          <div className="space-y-3">
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-[#746b61] px-2">
              <div className="col-span-4">Component Name</div>
              <div className="col-span-3">Pricing Mode</div>
              <div className="col-span-2">Unit</div>
              <div className="col-span-2">Rate / Ref (₹)</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {addons.map((item, idx) => (
              <div
                key={item.id || `new-addon-${idx}`}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 sm:p-2 border sm:border-0 border-[#e1d8cd] rounded-md bg-[#faf8f5] sm:bg-transparent"
              >
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleAddonChange(idx, 'name', e.target.value)}
                    placeholder="e.g. Rattan / Door Handles"
                    className="w-full p-2 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={item.pricing_type || 'lump_sum'}
                    onChange={(e) => handleAddonChange(idx, 'pricing_type', e.target.value)}
                    className="w-full p-2 text-xs font-semibold bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  >
                    <option value="per_unit">Per-Unit (Qty × Rate)</option>
                    <option value="lump_sum">Lump-Sum (Ref Hint)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => handleAddonChange(idx, 'unit', e.target.value)}
                    placeholder="sqft / nos"
                    className="w-full p-2 text-sm border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleAddonChange(idx, 'rate', e.target.value)}
                    placeholder="0"
                    className="w-full p-2 text-sm font-medium border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                  />
                </div>

                <div className="sm:col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => deleteAddonRow(idx)}
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
            onClick={addAddonRow}
            className="mt-5 px-4 py-2 border border-dashed border-[#746b61] text-xs font-bold uppercase tracking-wider text-[#171512] rounded-md hover:bg-[#f4f1eb] transition"
          >
            + Add New Component
          </button>
        </div>
      )}

      {/* TAB 4: BULK % PRICE ADJUSTMENT */}
      {activeTab === 'bulk' && (
        <div className="p-6 space-y-5">
          <div className="p-3 bg-[#f4f1eb] rounded-md text-xs text-[#5c5349] leading-relaxed">
            Use this tool when material costs rise (e.g. <strong>Fabric + Cushion +12%</strong>) or when adjusting an entire category. Every updated product automatically logs its previous price.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-[#faf8f5] p-5 rounded-lg border border-[#e1d8cd]">
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1.5">
                Adjust By
              </label>
              <select
                value={bulkScope}
                onChange={(e) => {
                  const newScope = e.target.value;
                  setBulkScope(newScope);
                  if (newScope === 'category') {
                    setBulkTargetId(CATEGORIES[0]);
                  } else {
                    setBulkTargetId(addons[0]?.id ? String(addons[0].id) : '');
                  }
                }}
                className="w-full h-10 px-3 text-xs font-semibold bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              >
                <option value="component">Component (e.g. Fabric)</option>
                <option value="category">Product Category</option>
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1.5">
                {bulkScope === 'component' ? 'Select Component' : 'Select Category'}
              </label>
              {bulkScope === 'component' ? (
                <select
                  value={bulkTargetId}
                  onChange={(e) => setBulkTargetId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                >
                  {addons.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={bulkTargetId}
                  onChange={(e) => setBulkTargetId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#746b61] mb-1.5">
                Change (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                placeholder="e.g. 10 or -5"
                className="w-full h-10 px-3 text-xs font-bold bg-white border border-[#dcd3c9] rounded-md focus:outline-none focus:border-[#171512]"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={bulkRunning || matchingBulkProducts.length === 0}
                onClick={handleApplyBulkAdjustment}
                className="w-full h-10 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-black transition disabled:opacity-40"
              >
                {bulkRunning
                  ? 'Updating...'
                  : `Apply (${matchingBulkProducts.length} items)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}