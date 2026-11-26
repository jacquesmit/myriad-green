'use strict';
// Draft-only calculation. Integer cents and thousandths of a unit.
// Owner-entered inputs are not independently verified supplier prices.
function calculateQuotation(input){
 const fail=reason_code=>({schema_version:'MAGOS_QUOTE_CALC_V1',state:'INVALID_INPUT',reason_code,side_effects:false});
 if(!input||!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)return fail('LINE_COUNT_INVALID');
 const scaled=(v,places,max)=>{
  if(typeof v!=='string'||!new RegExp('^\\d{1,9}(?:\\.\\d{1,'+places+'})?$').test(v))throw Error('INVALID_DECIMAL');
  const [whole,fraction='']=v.split('.');
  const n=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
  if(n>max)throw Error('VALUE_LIMIT_EXCEEDED');
  return n;
 };
 const round=(n,d)=>(n+d/2n)/d;
 const money=n=>Number(n)/100;
 const rows=[];let cost=0n,sale=0n;
 try{
  for(const line of input.lines){
   if(!line||typeof line.description!=='string'||!line.description.trim()||line.description.length>240||
    !['MATERIALS','LABOUR','OTHER_DIRECT'].includes(line.category))return fail('LINE_DESCRIPTION_OR_CATEGORY_INVALID');
   const qty=scaled(line.quantity,3,1000000000n);
   if(qty===0n)return fail('QUANTITY_MUST_BE_POSITIVE');
   const unitCost=scaled(line.unit_cost,2,10000000000n);
   const unitSale=scaled(line.unit_selling_price,2,10000000000n);
   if(unitCost===0n)return fail('ZERO_COST_REQUIRES_REVIEW');
   const lineCost=round(qty*unitCost,1000n),lineSale=round(qty*unitSale,1000n);
   if(lineCost===0n)return fail('ROUNDED_COST_ZERO');
   cost+=lineCost;sale+=lineSale;
   rows.push({description:line.description.trim(),category:line.category,quantity:Number(qty)/1000,unit_cost:money(unitCost),unit_selling_price:money(unitSale),cost:money(lineCost),selling:money(lineSale),gross_profit:money(lineSale-lineCost),positive_margin:lineSale>lineCost});
  }
 }catch(e){return fail(e.message);}
 if(cost>10000000000000n||sale>10000000000000n)return fail('TOTAL_LIMIT_EXCEEDED');
 const blockers=['SOURCE_COSTS_NOT_INDEPENDENTLY_VERIFIED','TAX_TREATMENT_NOT_VERIFIED'];
 if(sale<=cost||rows.some(row=>!row.positive_margin))blockers.push('NON_POSITIVE_LINE_OR_TOTAL_MARGIN');
 return {schema_version:'MAGOS_QUOTE_CALC_V1',state:'DRAFT_CALCULATED',lines:rows,totals:{cost:money(cost),selling:money(sale),gross_profit:money(sale-cost),gross_margin_percent:sale===0n?null:Number((sale-cost)*10000n/sale)/100},blockers,source_costs_verified:false,tax_treatment_verified:false,issuance_authorized:false,side_effects:false};
}
module.exports={calculateQuotation};
