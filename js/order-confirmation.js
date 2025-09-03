// Shared order confirmation and email logic for thank-you pages
(function(){
  emailjs.init("ONUJ8lbw4WfuQVpFf");
})();

function renderOrderSummary(order, list, totalEl) {
  let total = 0;
  list.innerHTML = "";
  order.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = `✔️ ${item.quantity} × ${item.name} — R${(item.price * item.quantity).toFixed(2)}`;
    li.style.animationDelay = `${0.3 + i * 0.3}s`;
    list.appendChild(li);
    total += item.price * item.quantity;
  });
  totalEl.innerHTML = `Total Paid: <strong>R${total.toFixed(2)}</strong>`;
  return total;
}

function sendOrderConfirmationEmail(order, client, total) {
  emailjs.send("service_xjwengk", "template_p2m1av4", {
    to_email: client.email || "customer@email.com",
    email: client.email || "customer@email.com",
    customer_name: client.name || "Customer",
    customer_phone: client.phone || "",
    order_summary: order.map(item => `${item.quantity} x ${item.name}`).join(", "),
    order_total: total.toFixed(2),
    company_name: "Myriad Green",
    company_phone: "+27 12 345 6789",
    company_email: "info@myriadgreen.co.za"
  })
  .then(function(response) {
    console.log("Confirmation email sent!", response.status, response.text);
  }, function(error) {
    console.error("EmailJS error:", error);
  });
}

// Expose helpers for pages that already render the order (e.g., thank-you-order.html)
window.renderOrderSummary = renderOrderSummary;
window.sendOrderConfirmationEmail = sendOrderConfirmationEmail;

window.initOrderConfirmation = function() {
  const urlParams = new URLSearchParams(window.location.search);
  const emailSentFlag = urlParams.get('es');
  const order = JSON.parse(localStorage.getItem("lastOrder")) || [];
  const client = JSON.parse(localStorage.getItem("lastOrderClient")) || {};
  const list = document.getElementById("orderSummaryList");
  const totalEl = document.getElementById("orderTotal");
  const countdown = document.getElementById("countdown");
  const total = renderOrderSummary(order, list, totalEl);
  if (emailSentFlag !== '1') {
    sendOrderConfirmationEmail(order, client, total);
  }
  localStorage.removeItem("cart");
  localStorage.removeItem("lastOrder");
};
