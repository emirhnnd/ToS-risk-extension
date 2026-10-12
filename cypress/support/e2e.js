/// <reference types="cypress" />

/**
 * Video için adımlar arası bekleme (npm run e2e:video → DEMO_PAUSE=1500 ms). Normal koşuda 0.
 * Süre node tarafındaki bir görevden okunur: Cypress 16'da Cypress.env() kaldırıldı,
 * cy.task her sürümde çalışır.
 */
Cypress.Commands.add('demoPause', (ms) => {
  const run = (wait) => { if (wait > 0) cy.wait(wait, { log: false }); };
  if (typeof ms === 'number') return run(ms);
  cy.task('demoPauseMs', null, { log: false }).then((wait) => run(Number(wait) || 0));
});

/** Paneldeki "analiz et" butonuna basar ve rapor (veya hata) gelene kadar bekler. */
Cypress.Commands.add('analyzePage', () => {
  cy.get('[data-testid=analyze-button]').should('be.visible').click();
  cy.get('[data-testid=loading]').should('exist');
  // Canlı Gemini 10–60 sn sürebilir; kayıttan oynatma anında döner.
  cy.get('[data-testid=risk-score], [data-testid=error]', { timeout: 150_000 }).should('exist');
  cy.get('[data-testid=error]').should('not.exist');
});
