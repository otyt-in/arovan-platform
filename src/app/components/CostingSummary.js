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

  // 2. Unified Dynamic Components List (Single source of truth)
  const currentAddons = Array.isArray(formData.addons) ? formData.addons : [];
  const resolvedAddons = currentAddons
    .map(item => {
      const master = addonsMaster.find(a => a.id === item.addon_id);
      const isCushion = master?.name?.toLowerCase().includes('cushion');
      const isPerUnit = master?.pricing_type === 'per_unit' && !isCushion;

      const enteredVal = parseFloat(item.qty) || 0;
      const count = parseFloat(item.count ?? 1) || 0;

      const cost = isCushion
        ? enteredVal * count
        : isPerUnit
        ? enteredVal * (master?.rate || 0)
        : enteredVal;

      const label = isCushion
        ? `${master?.name || 'Fabric + Cushion'} (${count} nos)`
        : isPerUnit
        ? `${master?.name || 'Component'} (${enteredVal} ${master?.unit || 'sqft'})`
        : master?.name || 'Component';

      return {
        name: label,
        cost
      };
    })
    .filter(item => item.cost > 0);

  const addonsTotal = resolvedAddons.reduce((sum, item) => sum + item.cost, 0);

  // 3. Packaging Cost (Direct Lump Sum ₹)
  const packagingCost = parseFloat(formData.packagingCost) || 0;

  // 4. Reverse-GST Rounding (18% GST):
  // Round the GST-inclusive quote up to the nearest ₹1,000 first, then back-calculate Ex-GST & GST
  const rawSubtotal = baseWoodCost + addonsTotal + packagingCost;
  const rawInclGst = rawSubtotal * 1.18;
  const finalQuotePrice = rawInclGst > 0 ? Math.ceil(rawInclGst / 1000) * 1000 : 0;
  const adjustedExGst = finalQuotePrice > 0 ? finalQuotePrice / 1.18 : 0;
  const gstAmount = finalQuotePrice - adjustedExGst;

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

              {resolvedAddons.map((item, idx) => (
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

              {finalQuotePrice > 0 && (
                <>
                  <div className="pt-2 border-t border-[#f0eae1] flex justify-between items-center text-xs">
                    <span className="text-[#746b61]">Taxable Value (Ex-GST)</span>
                    <span className="font-semibold text-[#4a433b]">
                      ₹{Math.round(adjustedExGst).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#746b61]">GST (18%)</span>
                    <span className="font-semibold text-[#4a433b]">
                      + ₹{Math.round(gstAmount).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* FINAL QUOTE PRICE BOX */}
            <div className="bg-[#faf8f5] border border-[#dcd3c9] rounded-lg p-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#746b61] mb-1">
                Estimated Quote (Incl. 18% GST)
              </p>
              <p className="text-3xl font-extrabold text-[#171512] tracking-tight">
                ₹{finalQuotePrice.toLocaleString()}
              </p>
              <p className="text-[11px] font-medium text-[#5c5349] mt-1.5">
                Ex-GST: ₹{Math.round(adjustedExGst).toLocaleString()} • GST: ₹{Math.round(gstAmount).toLocaleString()}
              </p>
              <p className="text-[10px] italic text-[#746b61] mt-0.5">
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
              onClick={() => onSave(finalQuotePrice)}
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