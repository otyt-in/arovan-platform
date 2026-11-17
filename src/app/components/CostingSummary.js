'use client';

export default function CostingSummary({
  formData,
  addonsMaster,
  onSave,
  onReset,
  isClientView
}) {
  // 1. Base Wood Value = CFT * Multiplier
  const woodCft = parseFloat(formData.woodCft) || 0;
  const multiplier = parseFloat(formData.multiplier) || 0;
  const baseWoodCost = woodCft * multiplier;

  // 2. Fixed Common Grid Add-ons (Rattan & Fabric + Cushion)
  const rattanMaster = addonsMaster.find(a => a.name.toLowerCase() === 'rattan');
  const cushionMaster = addonsMaster.find(a => a.name.toLowerCase().includes('cushion'));

  const rattanQty = parseFloat(formData.rattanSqft) || 0;
  const rattanCost = rattanQty * (rattanMaster?.rate || 0);

  const cushionQty = parseFloat(formData.cushionQty) || 0;
  const cushionCost = cushionQty * (cushionMaster?.rate || 0);

  // 3. Dynamic Misc Add-ons (Plywood, Brass, Metal, Hinges, Door Handles, etc.)
  const currentAddons = Array.isArray(formData.addons) ? formData.addons : [];
  const resolvedMiscAddons = currentAddons
    .map(item => {
      const master = addonsMaster.find(a => a.id === item.addon_id);
      const qty = parseFloat(item.qty) || 0;
      const cost = qty * (master?.rate || 0);
      return {
        name: master?.name || 'Component',
        qty,
        unit: master?.unit || '',
        cost
      };
    })
    .filter(item => item.cost > 0);

  const miscAddonsTotal = resolvedMiscAddons.reduce((sum, item) => sum + item.cost, 0);

  // 4. Packaging Cost
  const packagingCost = parseFloat(formData.packagingCost) || 0;

  // 5. Final Selling Price (Rounded up to nearest ₹1,000)
  const rawTotal = baseWoodCost + rattanCost + cushionCost + miscAddonsTotal + packagingCost;
  const estimatedSellingPrice = rawTotal > 0 ? Math.ceil(rawTotal / 1000) * 1000 : 0;

  return (
    <div className="space-y-6 sticky top-24">
      {/* SECTION 4: COST SUMMARY */}
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
            4
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
            Cost Summary
          </h2>
        </div>

        {isClientView ? (
          <div className="py-8 px-4 bg-[#faf8f5] border border-[#e1d8cd] rounded-md text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#746b61] mb-1">
              Arovan Bespoke Collection
            </p>
            <p className="font-serif text-xl text-[#171512]">Exquisite Craft</p>
            <p className="text-[11px] text-[#746b61] mt-2">
              Pricing hidden in Client Presentation Mode
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm border-b border-[#e1d8cd] pb-4 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-[#5c5349] font-medium">Base Wood Value</span>
                <span className="font-bold text-[#171512]">
                  ₹{Math.round(baseWoodCost).toLocaleString()}
                </span>
              </div>

              {rattanCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#5c5349] font-medium">Rattan</span>
                  <span className="font-bold text-[#171512]">
                    ₹{Math.round(rattanCost).toLocaleString()}
                  </span>
                </div>
              )}

              {cushionCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#5c5349] font-medium">Fabric + Cushion</span>
                  <span className="font-bold text-[#171512]">
                    ₹{Math.round(cushionCost).toLocaleString()}
                  </span>
                </div>
              )}

              {resolvedMiscAddons.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-[#5c5349] font-medium">{item.name}</span>
                  <span className="font-bold text-[#171512]">
                    ₹{Math.round(item.cost).toLocaleString()}
                  </span>
                </div>
              ))}

              {packagingCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#5c5349] font-medium">Packaging Cost</span>
                  <span className="font-bold text-[#171512]">
                    ₹{Math.round(packagingCost).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* FINAL ESTIMATED SELLING PRICE BOX */}
            <div className="bg-[#faf8f5] border border-[#dcd3c9] rounded-lg p-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#746b61] mb-1">
                Estimated Selling Price
              </p>
              <p className="text-3xl font-extrabold text-[#171512] tracking-tight">
                ₹{estimatedSellingPrice.toLocaleString()}
              </p>
              <p className="text-[10px] italic text-[#746b61] mt-1">
                Rounded up to nearest ₹1,000
              </p>
            </div>
          </>
        )}
      </div>

      {/* SECTION 5: ACTIONS */}
      {!isClientView && (
        <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-5 h-5 rounded-full bg-[#171512] text-white text-[11px] font-bold flex items-center justify-center">
              5
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#171512]">
              Actions
            </h2>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => onSave(estimatedSellingPrice)}
              className="w-full py-3 bg-[#171512] text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-black transition shadow-sm"
            >
              Save Product to Cloud
            </button>

            <button
              type="button"
              onClick={onReset}
              className="w-full py-2.5 bg-white border border-[#dcd3c9] text-[#171512] text-xs font-bold uppercase tracking-wider rounded-md hover:bg-[#faf8f5] transition"
            >
              Reset Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}