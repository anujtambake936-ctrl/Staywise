// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  // Loop over them and prevent submission
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
      }

      form.classList.add('was-validated')
    }, false)
  })
})()

// GST toggle behavior — initialize after DOM ready to reliably find checkbox
document.addEventListener('DOMContentLoaded', () => {
  const gstToggle = document.getElementById('gstToggle');
  if (!gstToggle) return;

  const formatINR = (n) => n.toLocaleString('en-IN');

  const updatePrices = (showGst) => {
    document.querySelectorAll('.card.listing-card').forEach(card => {
      const base = Number(card.dataset.price || 0);
      const gst = Math.round(base * 0.18);
      const total = base + gst;
      const priceEl = card.querySelector('.price-display');
      const gstEl = card.querySelector('.gst-info');
      if (showGst) {
        if (priceEl) priceEl.innerHTML = `<strong>₹ ${formatINR(total)}</strong> / night`;
        if (gstEl) gstEl.style.display = 'block';
      } else {
        if (priceEl) priceEl.innerHTML = `<strong>₹ ${formatINR(base)}</strong> / night`;
        if (gstEl) gstEl.style.display = 'none';
      }
    });
  };

  const saved = localStorage.getItem('showGst');
  const initial = saved === '1';
  gstToggle.checked = initial;
  updatePrices(initial);

  gstToggle.addEventListener('change', (e) => {
    const show = !!e.target.checked;
    localStorage.setItem('showGst', show ? '1' : '0');
    updatePrices(show);
  });

  // Auto-dismiss flash alerts after 2 seconds
  document.querySelectorAll('.alert').forEach((alertElement) => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
      bsAlert.close();
    }, 2000);
  });

  // Toggle a class on body when the mobile navbar is opened/closed
  const navCollapseEl = document.getElementById('navbarNavAltMarkup');
  if (navCollapseEl) {
    navCollapseEl.addEventListener('shown.bs.collapse', () => document.body.classList.add('nav-open'));
    navCollapseEl.addEventListener('hidden.bs.collapse', () => document.body.classList.remove('nav-open'));
    // fallback: toggle on show/hide start as well
    navCollapseEl.addEventListener('show.bs.collapse', () => document.body.classList.add('nav-open'));
    navCollapseEl.addEventListener('hide.bs.collapse', () => document.body.classList.remove('nav-open'));
  }
});