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

function clearedAllocations(rows, controlId) {
  return (rows || []).filter((row) =>
    String(row.control_id || '') === String(controlId) &&
    String(row.allocation_state || '').toUpperCase() === 'CLEARED'
  );
}

function sum(rows, predicate = () => true) {
  return round2(rows.filter(predicate).reduce((total, row) => total + money(row.amount), 0));
}

function computePaymentControlProjection(control, allocationRows = []) {
  if (!control || !control['Control ID']) {
    throw new Error('Payment Control row with Control ID is required');
  }

  const controlId = control['Control ID'];
  const cleared = clearedAllocations(allocationRows, controlId);

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

  const totalReceived = round2(sum(cleared));
  const overallBalance = round2(Math.max(contractValue - totalReceived, 0));

  const depositNotRequired = depositRequired <= 0;
  const depositCleared = depositNotRequired || depositReceived >= depositRequired;
  const fullPaymentRequired = depositRequired > 0 && depositRequired >= contractValue && contractValue > 0;
  const fullyPaid = contractValue > 0 && totalReceived >= contractValue;

  let depositStatus = control['Deposit Status'] || '';
  if (depositNotRequired) {
    depositStatus = 'NOT_REQUIRED';
  } else if (depositReceived >= depositRequired) {
    depositStatus = 'CLEARED';
  }

  let financialStatus = control['Financial Status'] || '';
  if (fullyPaid) {
    financialStatus = 'FINANCIALLY_CLOSED';
  } else if (fullPaymentRequired) {
    financialStatus = 'FULL_PAYMENT_INVOICED_AWAITING_CLEARANCE';
  } else if (depositCleared && finalInvoiced > finalReceived) {
    financialStatus = 'FINAL_INVOICE_OUTSTANDING';
  } else if (depositCleared && overallBalance > 0) {
    financialStatus = 'DEPOSIT_CLEARED_BALANCE_DUE';
  }

  let releaseGate;
  if (fullyPaid || depositNotRequired || (!fullPaymentRequired && depositCleared)) {
    releaseGate = 'UNBLOCKED';
  } else {
    releaseGate = 'BLOCKED_PENDING_FULL_PAYMENT_CLEARANCE';
  }

  return {
    control_id: controlId,
    metrics: {
      contract_value: contractValue,
      deposit_required: depositRequired,
      deposit_received: depositReceived,
      final_invoiced: finalInvoiced,
      final_received: finalReceived,
      total_received: totalReceived,
      overall_balance: overallBalance
    },
    state: {
      deposit_status: depositStatus,
      financial_status: financialStatus,
      deposit_release_gate: releaseGate
    },
    evidence: {
      cleared_allocation_ids: cleared.map((row) => row.allocation_id).filter(Boolean),
      cleared_allocation_count: cleared.length
    }
  };
}

module.exports = {
  money,
  round2,
  clearedAllocations,
  computePaymentControlProjection
};
