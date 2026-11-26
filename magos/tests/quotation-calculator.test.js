'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {calculateQuotation}=require('../processor/quotation-calculator');
const line={description:'Pipe',category:'MATERIALS',quantity:'2.5',unit_cost:'100.01',unit_selling_price:'160.00'};
test('draft quote uses exact cents, fractional quantities and gross margin',()=>{
 const r=calculateQuotation({lines:[line,{description:'Labour',category:'LABOUR',quantity:'1',unit_cost:'100',unit_selling_price:'200'}]});
 assert.equal(r.state,'DRAFT_CALCULATED');assert.equal(r.totals.cost,350.03);assert.equal(r.totals.selling,600);assert.equal(r.totals.gross_profit,249.97);assert.equal(r.totals.gross_margin_percent,41.66);assert.equal(r.issuance_authorized,false);assert.equal(r.side_effects,false);
});
test('invalid values, missing cost, zero cost and oversized lines fail closed',()=>{
 for(const l of [{...line,quantity:'0'},{...line,unit_cost:''},{...line,unit_cost:'0'},{...line,unit_cost:'1e3'},{...line,unit_cost:'-2'},{...line,unit_cost:12},{...line,quantity:'1.0001'},{...line,unit_cost:'1.001'},{...line,category:'UNKNOWN'}])assert.equal(calculateQuotation({lines:[l]}).state,'INVALID_INPUT');
 assert.equal(calculateQuotation({lines:Array(101).fill(line)}).state,'INVALID_INPUT');
});
test('losses cannot be concealed by profitable other lines',()=>{
 const r=calculateQuotation({lines:[{...line,unit_selling_price:'10'}, {...line,unit_selling_price:'1000'}]});assert.ok(r.blockers.includes('NON_POSITIVE_LINE_OR_TOTAL_MARGIN'));assert.equal(r.issuance_authorized,false);
});
test('zero selling price does not produce invalid division',()=>{const r=calculateQuotation({lines:[{...line,unit_selling_price:'0'}]});assert.equal(r.totals.gross_margin_percent,null);assert.equal(r.issuance_authorized,false);});
