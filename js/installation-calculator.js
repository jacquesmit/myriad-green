// Installation Calculator Logic
// Production-ready, modular, and extendable


(function() {
  // Pricing rules for both modes
  const PACKAGE_PRICES = {
    4: 10000,
    6: 12500,
    8: 15000
  };
  const BASE_PRICE = 5000; // Custom build base
  const PRICE_PER_M2 = 45;
  const ZONE_PRICE = 1200;
  const SMART_CONTROLLER_PRICE = 3500;
  const RAIN_SENSOR_PRICE = 950;
  const DRIP_LINE_PRICE = 900;
  const EXT_WARRANTY_PRICE = 1800;
  const MAINTENANCE_PLAN_PRICE = 250;

  function formatRands(val) {
    return 'R' + val.toLocaleString('en-ZA', {minimumFractionDigits: 2});
  }

  function getMode() {
    return document.getElementById('calc-mode-package').checked ? 'package' : 'custom';
  }

  function getInputs() {
    if (getMode() === 'package') {
      const zones = parseInt(document.getElementById('package-select').value, 10);
      return {
        mode: 'package',
        zones,
        packagePrice: PACKAGE_PRICES[zones],
        suburb: '',
      };
    } else {
      return {
        mode: 'custom',
        areaSize: parseInt(document.getElementById('calc-area-size').value, 10) || 0,
        zones: parseInt(document.getElementById('calc-zones').value, 10) || 0,
        smartController: document.getElementById('calc-smart-controller').checked,
        rainSensor: document.getElementById('calc-rain-sensor').checked,
        dripLine: document.getElementById('calc-drip-line').checked,
        extWarranty: document.getElementById('calc-ext-warranty').checked,
        maintenancePlan: document.getElementById('calc-maintenance-plan').checked,
        suburb: document.getElementById('calc-suburb').value.trim()
      };
    }
  }

  function calculateTotal(inputs) {
    if (inputs.mode === 'package') {
      return PACKAGE_PRICES[inputs.zones] || 0;
    } else {
      let total = BASE_PRICE;
      total += (inputs.areaSize || 0) * PRICE_PER_M2;
      total += (inputs.zones || 0) * ZONE_PRICE;
      if (inputs.smartController) total += SMART_CONTROLLER_PRICE;
      if (inputs.rainSensor) total += RAIN_SENSOR_PRICE;
      if (inputs.dripLine) total += DRIP_LINE_PRICE;
      if (inputs.extWarranty) total += EXT_WARRANTY_PRICE;
      if (inputs.maintenancePlan) total += MAINTENANCE_PLAN_PRICE * 12;
      return total;
    }
  }

  function updateSummary() {
    const inputs = getInputs();
    const total = calculateTotal(inputs);
    document.getElementById('calc-total').textContent = formatRands(total);
    localStorage.setItem('installationCalc', JSON.stringify({...inputs, total}));
  }

  function showMode(mode) {
    document.getElementById('package-options').style.display = mode === 'package' ? '' : 'none';
    document.getElementById('custom-options').style.display = mode === 'custom' ? '' : 'none';
  }

  function attachListeners() {
    // Mode toggle
    document.getElementById('calc-mode-package').addEventListener('change', function() {
      showMode('package');
      updateSummary();
    });
    document.getElementById('calc-mode-custom').addEventListener('change', function() {
      showMode('custom');
      updateSummary();
    });
    // Package select
    document.getElementById('package-select').addEventListener('change', updateSummary);
    // Custom build fields
    [
      'calc-area-size', 'calc-zones', 'calc-smart-controller',
      'calc-rain-sensor', 'calc-drip-line', 'calc-ext-warranty',
      'calc-maintenance-plan', 'calc-suburb'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateSummary);
      if (el && el.type === 'checkbox') el.addEventListener('change', updateSummary);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('installation-calculator')) {
      attachListeners();
      showMode('package');
      updateSummary();
    }
  });
})();
