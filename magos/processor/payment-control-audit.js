'use strict';

function money(value) {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clearedForControl(rows, controlId) {
  return (rows || []).filter((row) =>
    String(row.control_id || '') === String(controlId) &&
    String(row.allocation_state || '').toUpperCase() === 'CLEARED'
  );
}

function sum(rows, predicate = () => true) {
  return round2(
    rows.filter(predicate).reduce((total, row) => total + money(row.amount), 0)
  );
}

function calculateExpected(control, allocations) {
  if (!control || !control['Control ID']) {
    throw new Error('Payment Control row with Control ID is required');
  }

  const controlId = control['Control ID'];
  const cleared = clearedForControl(allocations, controlId);
  const contractValue = money(control['Contract Value (R)']);
  const depositRequired = money(control['Deposit Required (R)']);
  const finalInvoiced = money(control['Final Invoiced (R)']);

  const depositReceived = sum(
    cleared,
    (row) => String(row.allocation_type || '').toUpperCase() === 'DEPOSIT'
  );
  const finalReceived = sum(
    cleared,
    (row) => String(row.allocation_type || '').toUpperCase() !== 'DEPOSIT'
  );
  const totalReceived = sum(cleared);
  const overallBalance = round2(Math.max(contractValue - totalReceived, 0));

  return {
    control_id: controlId,
    deposit_received: depositReceived,
    final_received: finalReceived,
    total_received: totalReceived,
    overall_balance: overallBalance,
    deposit_obligation_satisfied:
      depositRequired <= 0 || depositReceived >= depositRequired,
    contract_financially_satisfied:
      contractValue > 0 && totalReceived >= contractValue,
    final_invoice_satisfied:
      finalInvoiced <= 0 || finalReceived >= finalInvoiced,
    cleared_allocation_ids: cleared
      .map((row) => row.allocation_id)
      .filter(Boolean)
  };
}

function comparePaymentControl(control, allocations) {
  const expected = calculateExpected(control, allocations);
  const observed = {
    deposit_received: money(control['Deposit Received (R)']),
    final_received: money(control['Final Received (R)']),
    total_received: money(control['Total Received (R)']),
    overall_balance: money(control['Overall Balance (R)'])
  };

  const mismatches = [];
  for (const key of [
    'deposit_received',
    'final_received',
    'total_received',
    'overall_balance'
  ]) {
    if (round2(observed[key]) !== round2(expected[key])) {
      mismatches.push({
        field: key,
        observed: round2(observed[key]),
        expected: round2(expected[key])
      });
    }
  }

  return {
    control_id: expected.control_id,
    status: mismatches.length ? 'MISMATCH' : 'MATCH',
    expected,
    observed,
    mismatches
  };
}

module.exports = {
  money,
  round2,
  calculateExpected,
  comparePaymentControl
};
