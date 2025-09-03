async function initRelatedProducts(){
  const wrap = document.getElementById('related-products');
  if (!wrap) return;
  const sectionPath = wrap.getAttribute('data-section-path') || '';
  try {
    const res = await fetch('/data/related-products.json', { cache: 'no-store' });
    if (!res.ok) return;
    const map = await res.json();
    const slugs = map[sectionPath];
    if (!Array.isArray(slugs) || !slugs.length) return;
    const ul = document.createElement('ul');
    ul.className = 'related-products-list';
    for (const slug of slugs) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      // Use extensionless product URLs to match server routing and canonical
      a.href = `/shop/${slug}`;
      a.textContent = slug.replace(/[-_]/g, ' ');
      li.appendChild(a);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  } catch (e) {
    // silent fail
  }
}

initRelatedProducts();
