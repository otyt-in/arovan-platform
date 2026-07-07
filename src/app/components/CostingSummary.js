'use client';

export default function CostingSummary({ formData, globalSettings, woodMaster, finishingMaster, plywoodMaster, onSave, onReset }) {
  const parseNum = (val) => parseFloat(val) || 0;

  const selectedWood = woodMaster?.find(w => w.id.toString() === formData.woodTypeId?.toString());
  const woodRate = selectedWood ? parseNum(selectedWood.rate_per_cft_premium) : 0;
  const woodCft = parseNum(formData.woodCft);
  const totalWood = woodCft * woodRate;

  const selectedPly = plywoodMaster?.find(p => p.id.toString() === formData.plywoodTypeId?.toString());
  const plyRate = selectedPly ? parseNum(selectedPly.rate_per_sheet) : 0;
  const plyQty = parseNum(formData.plywoodQty);
  const totalPly = plyQty * plyRate;

  const labHrs = parseNum(formData.labourHours);
  const labRate = parseNum(formData.labourRate);
  const totalLab = labHrs * labRate;

  const fabMtr = parseNum(formData.fabricMeters);
  const fabRate = parseNum(formData.fabricRate);
  const foamCost = parseNum(formData.foamCost);
  const totalUph = (fabMtr * fabRate) + foamCost;

  const hardCost = parseNum(formData.hardwareCost);
  const packCost = parseNum(formData.packagingCost);
  
  const selectedFinishing = finishingMaster?.find(f => f.id.toString() === formData.finishingTypeId?.toString());
  const finCost = selectedFinishing ? parseNum(selectedFinishing.flat_rate) : 0;

  const baseCost = totalWood + totalPly + totalLab + hardCost + totalUph + finCost + packCost;
  
  const ovPct = parseNum(formData.overheadsPercent);
  const overheads = baseCost * (ovPct / 100);
  const mfgCost = baseCost + overheads;
  
  const marginPct = globalSettings ? parseNum(globalSettings.margin_percent) : 40;
  const rawSellPrice = mfgCost / (1 - (marginPct / 100));
  const sellPrice = Math.ceil(rawSellPrice / 1000) * 1000;

  return (
    <div className="flex flex-col gap-5 sticky top-[100px]">
      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#171512] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white flex items-center justify-center text-[10px]">4</span>
          Cost Summary
        </h3>
        <table className="w-full text-[13px] border-collapse mb-6">
          <tbody>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Wood Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{totalWood.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Plywood Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{totalPly.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Labour Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{totalLab.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Hardware & Misc. Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{hardCost.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Upholstery Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{totalUph.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Finishing Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{finCost.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Packaging Cost</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">₹{packCost.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2.5 border-b border-[#f0e9df] text-[#4a443e]">Overheads</td>
              <td className="py-2.5 border-b border-[#f0e9df] text-right font-semibold text-[#171512]">
                ₹{overheads.toLocaleString(undefined, {maximumFractionDigits: 0})}
              </td>
            </tr>
            <tr className="border-t-2 border-[#171512]">
              <td className="py-3 font-bold text-[#171512]">TOTAL MFG COST</td>
              <td className="py-3 text-right font-bold text-[#171512]">₹{mfgCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
            </tr>
          </tbody>
        </table>
        <div className="bg-[#fdfcfb] border border-[#e1d8cd] rounded-lg p-6 text-center mt-5">
          <div className="text-[12px] uppercase tracking-wider text-[#746b61] font-semibold mb-2">Estimated Selling Price</div>
          <div className="text-3xl font-bold text-[#171512]">₹{sellPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          <div className="text-[10px] text-[#8c8378] mt-2 italic">Rounded to nearest ₹1,000</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-[#e1d8cd] shadow-sm">
        <h3 className="text-xs uppercase font-bold tracking-wider text-[#171512] mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#171512] text-white flex items-center justify-center text-[10px]">5</span>
          Actions
        </h3>
        <div className="grid gap-3">
          <button onClick={() => onSave(mfgCost, sellPrice)} className="w-full py-3 bg-[#171512] text-white font-medium rounded-md text-[13px] hover:opacity-85 transition">
            Save Product to Cloud
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onReset} className="w-full py-2.5 bg-white border border-[#dcd3c9] text-[#171512] font-medium rounded-md text-[13px] hover:bg-[#f4f1eb] transition">
              Reset Form
            </button>
            <button className="w-full py-2.5 bg-white border border-[#dcd3c9] text-[#171512] font-medium rounded-md text-[13px] hover:bg-[#f4f1eb] transition">
              Generate Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}