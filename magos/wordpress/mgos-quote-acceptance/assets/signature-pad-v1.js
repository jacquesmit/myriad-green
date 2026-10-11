'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-mgos-signature]').forEach(wrapper=>{
  const section=wrapper.closest('.mg-quote-accept');
  const form=section?.querySelector('form.frm-fluent-form, form.fluent_form, form');
  const canvas=wrapper.querySelector('canvas');
  if(!form||!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  ctx.lineWidth=2.7;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#162a20';
  canvas.style.touchAction='none';
  let active=false,strokeCount=0;
  const coordinates=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;active=true;canvas.setPointerCapture(e.pointerId);const p=coordinates(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()});
  canvas.addEventListener('pointermove',e=>{if(!active||!e.isPrimary)return;const p=coordinates(e);ctx.lineTo(p.x,p.y);ctx.stroke();strokeCount++;e.preventDefault()});
  const stop=e=>{active=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)};
  canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
  wrapper.querySelector('[data-mgos-clear]')?.addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);strokeCount=0});
  const put=(name,value)=>{let input=form.querySelector('input[name="'+name+'"]');if(!input){input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input)}input.value=value};
  let message=document.createElement('p');message.setAttribute('role','alert');message.style.color='#9e241d';wrapper.appendChild(message);
  // Capture at submission time, never mark the form signed merely because a canvas exists.
  form.addEventListener('submit',e=>{
   if(strokeCount<5){e.preventDefault();e.stopImmediatePropagation();message.textContent='Please draw your signature before submitting.';canvas.focus();return}
   const params=new URLSearchParams(location.search);
   const token=params.get('accept_token')||'';
   if(!token){e.preventDefault();e.stopImmediatePropagation();message.textContent='This quotation link is unavailable. Request a new link.';return}
   const png=canvas.toDataURL('image/png');
   if(png.length>125000){e.preventDefault();e.stopImmediatePropagation();message.textContent='Signature is too large; clear and draw it again.';return}
   put('mgos_quote_token',token);put('mgos_signature_png',png);message.textContent='';
  },true);
 });
});