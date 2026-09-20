'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateExpected,
  comparePaymentControl
} = require('../processor/payment-control-audit');

function control(overrides = {}) {
  return {
    'Control ID': 'PAY-1',
    'Contract Value (R)': 'R 10,000.00',
    'Deposit Required (R)': 'R 8,000.00',
    'Deposit Received (R)': 'R 0.00',
    'Final Invoiced (R)': 'R 2,000.00',
    'Final Received (R)': 'R 0.00',
    'Total Received (R)': 'R 0.00',
    'Overall Balance (R)': 'R 10,000.00',
    ...overrides
  };
}

test('only CLEARED allocations contribute to financial totals', () => {
  const expected = calculateExpected(control(), [
    {
      allocation_id: 'A1',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'PROOF_RECEIVED'
    },
    {
      allocation_id: 'A2',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'CLEARED'
    }
  ]);

  assert.equal(expected.deposit_received, 8000);
  assert.equal(expected.total_received, 8000);
  assert.equal(expected.overall_balance, 2000);
  assert.deepEqual(expected.cleared_allocation_ids, ['A2']);
});

test('proof-only allocation never satisfies deposit obligation', () => {
  const expected = calculateExpected(control(), [
    {
      allocation_id: 'A1',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'PROOF_RECEIVED'
    }
  ]);

  assert.equal(expected.deposit_received, 0);
  assert.equal(expected.deposit_obligation_satisfied, false);
});

test('full cleared allocations satisfy contract and final invoice facts', () => {
  const expected = calculateExpected(control(), [
    {
      allocation_id: 'A1',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'CLEARED'
    },
    {
      allocation_id: 'A2',
      control_id: 'PAY-1',
      allocation_type: 'FINAL_INVOICE',
      amount: '2000',
      allocation_state: 'CLEARED'
    }
  ]);

  assert.equal(expected.total_received, 10000);
  assert.equal(expected.overall_balance, 0);
  assert.equal(expected.contract_financially_satisfied, true);
  assert.equal(expected.final_invoice_satisfied, true);
});

test('comparison reports stale Payment Control numbers without mutating them', () => {
  const report = comparePaymentControl(control(), [
    {
      allocation_id: 'A1',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'CLEARED'
    }
  ]);

  assert.equal(report.status, 'MISMATCH');
  assert.ok(report.mismatches.some((item) => item.field === 'deposit_received'));
  assert.ok(report.mismatches.some((item) => item.field === 'overall_balance'));
});

test('comparison passes when projection matches cleared allocation facts', () => {
  const report = comparePaymentControl(control({
    'Deposit Received (R)': 'R 8,000.00',
    'Final Received (R)': 'R 2,000.00',
    'Total Received (R)': 'R 10,000.00',
    'Overall Balance (R)': 'R 0.00'
  }), [
    {
      allocation_id: 'A1',
      control_id: 'PAY-1',
      allocation_type: 'DEPOSIT',
      amount: '8000',
      allocation_state: 'CLEARED'
    },
    {
      allocation_id: 'A2',
      control_id: 'PAY-1',
      allocation_type: 'FINAL_INVOICE',
      amount: '2000',
      allocation_state: 'CLEARED'
    }
  ]);

  assert.equal(report.status, 'MATCH');
  assert.equal(report.mismatches.length, 0);
});
