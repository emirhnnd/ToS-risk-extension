/// <reference types="cypress" />

/** Video için adımlar arası bekleme (npm run e2e:video → DEMO_PAUSE=1500). Normal koşuda 0. */
Cypress.Commands.add('demoPause', (ms) => {
  const wait = ms ?? Number(Cypress.env('DEMO_PAUSE') || 0);
  if (wait > 0) cy.wait(wait, { log: false });
});

/** Paneldeki "analiz et" butonuna basar ve rapor (veya hata) gelene kadar bekler. */
Cypress.Commands.add('analyzePage', () => {
  cy.get('[data-testid=analyze-button]').should('be.visible').click();
  cy.get('[data-testid=loading]').should('exist');
  // Canlı Gemini 10–60 sn sürebilir; kayıttan oynatma anında döner.
  cy.get('[data-testid=risk-score], [data-testid=error]', { timeout: 150_000 }).should('exist');
  cy.get('[data-testid=error]').should('not.exist');
});
