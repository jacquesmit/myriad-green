'use strict';
// Aspire/LMN benchmark: cost visibility must distinguish a provisional crew-day
// estimate from actual time entries and independently verified labour expenses.
const val=x=>String(x??'').trim();
const up=x=>val(x).toUpperCase();
const num=x=>{
 const v=val(x).replace(/^(R|ZAR)\s*/i,'').replace(/[\s\u00a0]/g,'');
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(v))return null;
 const n=Number(v.replace(/,/g,''));return Number.isFinite(n)&&n>=0?n:null;
};
function inspectLabourCostRegister({rateRows,marginRows}={}){
 if(!Array.isArray(rateRows)||!Array.isArray(marginRows))
  return {schema_version:'MAGOS_LABOUR_RECONCILIATION_V1',
   state:'UNAVAILABLE',records:[],rates:[],writes:[],side_effects:false};
 const seen=new Set(),rateIssues=[],rates=[];
 for(const row of rateRows){
  const id=val(row.labour_rate_id),rate=num(row.rate);
  const issue=[];
  if(!id||seen.has(id))issue.push('DUPLICATE_OR_MISSING_LABOUR_RATE_ID');
  seen.add(id);
  if(rate===null)issue.push('INVALID_LABOUR_RATE');
  if(!['PER_DAY','PER_HOUR'].includes(up(row.rate_basis)))
   issue.push('UNSUPPORTED_LABOUR_RATE_BASIS');
  if(up(row.currency)!=='ZAR')issue.push('UNSUPPORTED_LABOUR_RATE_CURRENCY');
  if(!val(row.effective_from))issue.push('RATE_EFFECTIVE_DATE_MISSING');
  rateIssues.push(...issue.map(x=>x+':'+(id||'UNKNOWN')));
  rates.push({id,role:val(row.person_role),basis:val(row.rate_basis),
   rate_zar:rate,issue_count:issue.length});
 }
 const jobsSeen=new Set(),records=[];
 for(const row of marginRows){
  const id=val(row.job_id),issues=[];
  if(!id||jobsSeen.has(id))issues.push('DUPLICATE_OR_MISSING_JOB_ID');
  jobsSeen.add(id);
  const daily=num(row.crew_daily_rate_total),days=num(row.crew_days),
   provisional=num(row.provisional_labour_cost);
  if(daily===null)issues.push('CREW_DAILY_RATE_UNVERIFIED');
  if(days===null)issues.push('CREW_DAYS_UNVERIFIED');
  if(provisional===null)issues.push('PROVISIONAL_LABOUR_COST_UNVERIFIED');
  let calculated=null;
  if(daily!==null&&days!==null){
   calculated=Math.round(daily*days*100)/100;
   if(provisional!==null&&Math.abs(calculated-provisional)>0.01)
    issues.push('CREW_RATE_DAYS_COST_MISMATCH');
  }
  // This is not a worker assignment or a verified time entry. A roll-up can
  // agree arithmetically while having no audit trail to actual worker shifts.
  issues.push('WORKER_ASSIGNMENT_AND_ACTUAL_TIME_NOT_VERIFIED');
  if(rateIssues.length)issues.push('LABOUR_RATE_REGISTER_REVIEW_REQUIRED');
  records.push({id,margin_record_id:val(row.margin_record_id),
   crew_daily_rate_zar:daily,crew_days:days,provisional_labour_cost_zar:provisional,
   calculated_crew_cost_zar:calculated,
   status:issues.length?'REVIEW_REQUIRED':'RECONCILED',
   blockers:issues,
   next_action:issues.includes('CREW_RATE_DAYS_COST_MISMATCH')?
    'Correct crew-day calculation against original timesheets and approved rates':
    'Capture worker IDs, approved shifts and actual hours before final job costing',
   final_actual_labour_verified:false,payroll_authorized:false,
   profit_verified:false});
 }
 return {schema_version:'MAGOS_LABOUR_RECONCILIATION_V1',
  state:rateIssues.length?'PARTIAL':'READ_ONLY_REVIEW',
  counts:{jobs:records.length,
   provisional_calculations_matched:records.filter(r=>r.calculated_crew_cost_zar!==null&&
    r.provisional_labour_cost_zar!==null&&
    Math.abs(r.calculated_crew_cost_zar-r.provisional_labour_cost_zar)<=0.01).length,
   actual_labour_verified:0,
   requires_review:records.filter(r=>r.status==='REVIEW_REQUIRED').length,
   rate_issues:rateIssues.length},
  rate_issues:rateIssues,rates,records,writes:[],side_effects:false};
}
module.exports={inspectLabourCostRegister};
