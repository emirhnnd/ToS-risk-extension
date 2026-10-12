/// <reference types="cypress" />

/**
 * Video için adımlar arası bekleme: `npm run e2e:video` → DEMO_PAUSE=2000 ms; normal koşuda 0.
 * Argüman bir çarpandır (demoPause(2) = 2 × taban). Süre node tarafındaki bir görevden okunur:
 * Cypress 16'da Cypress.env() kaldırıldı, cy.task her sürümde çalışır.
 */
Cypress.Commands.add('demoPause', (factor = 1) => {
  cy.task('demoPauseMs', null, { log: false }).then((base) => {
    const wait = Math.round((Number(base) || 0) * factor);
    if (wait > 0) cy.wait(wait, { log: false });
  });
});

/**
 * Demo videosu için ekranın altında kısa açıklama. Yalnızca analiz SONRASI kullanılır
 * (analizden önce eklenirse LLM'e giden metni değiştirir). Paneli örtmez.
 */
Cypress.Commands.add('caption', (text) => {
  cy.document({ log: false }).then((doc) => {
    let el = doc.getElementById('demo-caption');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('style', [
        'position:fixed', 'left:16px', 'bottom:16px', 'max-width:calc(100vw - 440px)', 'min-width:280px', 'z-index:2147483646',
        'background:rgba(17,24,39,.94)', 'color:#fff', 'font:600 20px/1.35 system-ui,sans-serif', 'padding:12px 16px',
        'border-radius:10px', 'box-shadow:0 6px 24px rgba(0,0,0,.35)', 'pointer-events:none',
      ].join(';'));
      doc.body.appendChild(el);
    }
    el.textContent = text;
  });
  cy.log(`🎬 ${text}`);
});

/** Paneldeki "analiz et" butonuna basar ve rapor (veya hata) gelene kadar bekler. */
Cypress.Commands.add('analyzePage', () => {
  cy.get('[data-testid=analyze-button]').should('be.visible').click();
  cy.get('[data-testid=loading]').should('exist');
  // Canlı Gemini 10–60 sn sürebilir; kayıttan oynatma anında döner.
  cy.get('[data-testid=risk-score], [data-testid=error]', { timeout: 150_000 }).should('exist');
  cy.get('[data-testid=error]').should('not.exist');
});
