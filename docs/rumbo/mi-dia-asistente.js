/* Complemento no destructivo de «Mi día». No modifica los almacenes actuales. */
(() => {
  'use strict';
  const host = document.getElementById('mi-dia');
  if (!host) return;
  const mount = () => {
    if (document.getElementById('rumbo-day-companion')) return;
    const body = host.querySelector('.assistant-body');
    if (!body) return;
    const section = document.createElement('section');
    section.id = 'rumbo-day-companion';
    section.className = 'assistant-card rumbo-companion';
    section.setAttribute('aria-label', 'Asistente de Mi día');
    section.innerHTML = `
      <div class="rumbo-companion-head">
        <div><div class="eyebrow">ASISTENTE PERSONAL</div><h3>Tu día, en un solo lugar</h3>
          <p class="assistant-muted">Consulta tus prioridades y captura ideas sin abandonar «Mi día».</p></div>
        <button type="button" class="button secondary" id="rumbo-companion-refresh">Actualizar resumen</button>
      </div>
      <div class="rumbo-companion-summary" id="rumbo-companion-summary" role="status" aria-live="polite"></div>
      <div class="rumbo-companion-actions">
        <button type="button" class="button primary" id="rumbo-companion-next">¿Qué hago ahora?</button>
        <button type="button" class="button secondary" id="rumbo-companion-capture">Anotar una idea</button>
        <button type="button" class="button secondary" id="rumbo-companion-voice">Dictar una nota</button>
        <a class="button secondary" href="#productividad">Registrar tiempo</a>
      </div>
      <p class="assistant-muted" id="rumbo-companion-message">El dictado utiliza el reconocimiento de voz del navegador, si está disponible. No envía notas a una IA.</p>
    `;
    body.prepend(section);
    const byId = id => document.getElementById(id);
    const summary = byId('rumbo-companion-summary');
    function refresh() {
      const priorities = byId('assistant-priorities');
      const priorityText = priorities?.innerText?.trim() || '';
      const pending = priorities?.querySelectorAll('input[type="checkbox"]:not(:checked)').length || 0;
      const when = byId('assistant-time-available')?.textContent?.trim() || '';
      const energy = byId('assistant-energy')?.selectedOptions?.[0]?.textContent || 'No indicada';
      summary.replaceChildren();
      const pieces = [
        ['Prioridades', priorityText ? (pending ? pending + ' pendientes' : 'Revisar lista') : 'Sin prioridades'],
        ['Energía', energy],
        ['Próximo compromiso', when || 'Sin compromiso registrado']
      ];
      for (const [heading,value] of pieces) {
        const card = document.createElement('div');
        const strong = document.createElement('strong');
        const span = document.createElement('span');
        strong.textContent = heading; span.textContent = value;
        card.append(strong,span);summary.append(card);
      }
    }
    byId('rumbo-companion-refresh').addEventListener('click',refresh);
    byId('rumbo-companion-next').addEventListener('click',() => {
      byId('assistant-what')?.click();
      byId('assistant-advice')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
    byId('rumbo-companion-capture').addEventListener('click',() => {
      const field = byId('assistant-capture')?.elements?.namedItem('text');
      field?.focus();field?.scrollIntoView({behavior:'smooth',block:'center'});
    });
    const voice = byId('rumbo-companion-voice');
    const message = byId('rumbo-companion-message');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      voice.disabled = true;
      message.textContent = 'Este navegador no admite dictado aquí. Puedes escribir una nota en «Captura rápida».';
    } else {
      let recognition = null;
      voice.addEventListener('click',() => {
        if (recognition) {recognition.stop();return;}
        const field=byId('assistant-capture')?.elements?.namedItem('text');
        if (!field) {message.textContent='No se encontró el campo de captura.';return;}
        recognition=new Recognition();
        recognition.lang='es-ES';recognition.interimResults=false;recognition.maxAlternatives=1;
        voice.textContent='Detener dictado';
        message.textContent='Escuchando… Comprueba el texto antes de guardarlo.';
        recognition.onresult=e => {
          const transcript=e.results?.[0]?.[0]?.transcript?.trim();
          if (transcript) {field.value=(field.value ? field.value+' ' : '')+transcript;field.focus();}
          message.textContent='Nota transcrita. Pulsa «Guardar» en Captura rápida para conservarla.';
        };
        recognition.onerror=() => {message.textContent='No se pudo completar el dictado. Escribe la nota manualmente.';};
        recognition.onend=() => {recognition=null;voice.textContent='Dictar una nota';};
        try {recognition.start();} catch {recognition=null;voice.textContent='Dictar una nota';message.textContent='No se pudo iniciar el micrófono.';}
      });
    }
    byId('assistant-energy')?.addEventListener('change',refresh);
    byId('assistant-capture')?.addEventListener('submit',() => setTimeout(refresh,0));
    byId('assistant-priorities')?.addEventListener('change',() => setTimeout(refresh,0));
    refresh();
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
