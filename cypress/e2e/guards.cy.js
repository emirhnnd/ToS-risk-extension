/// <reference types="cypress" />
// Demo dışı güvenlik kontrolleri (videoya girmesi gerekmez).

describe('ToS Risk Analizi – sınırlar', () => {
  it('sözleşme olmayan sayfada panel kendiliğinden açılmaz ve LLM çağrılmaz', () => {
    cy.visit('/not-a-contract.html');
    cy.wait(1500); // içerik betiğinin çalışması için (document_idle)
    cy.get('#tos-risk-panel-host').should('not.exist');
  });

  it('panel open Shadow DOM\'dadır, sayfanın stilinden etkilenmez ve uyarı her durumda görünür', () => {
    cy.visit('/terms-happy.html');
    cy.get('#tos-risk-panel-host').should(($h) => expect($h[0].shadowRoot, 'open shadow root').to.not.equal(null));
    cy.get('[data-testid=legal-disclaimer]').should('be.visible');
    cy.get('[data-testid=minimize]').click();
    cy.get('[data-testid=legal-disclaimer]').should('be.visible'); // küçültülünce bile
  });

  it('panel kapatılabilir (× düğmesi) ve küçültülünce uyarının ilk cümlesi kalır', () => {
    cy.visit('/terms-happy.html');
    cy.get('[data-testid=minimize]').click().should('have.attr', 'aria-expanded', 'false');
    cy.get('[data-testid=legal-disclaimer-core]').should('be.visible').and('have.text', 'Bu uygulama hukuki tavsiye vermez.');
    cy.get('[data-testid=analyze-button]').should('not.be.visible');
    cy.get('[data-testid=close]').click();
    cy.get('#tos-risk-panel-host').should('not.exist');
  });

  it('sayfanın agresif CSS\'i paneli ve hukuki uyarıyı gizleyemez', () => {
    cy.visit('/terms-hostile-css.html'); // #tos-risk-panel-host { display:none !important } vb.
    cy.get('#tos-risk-panel-host').should('be.visible');
    cy.get('[data-testid=legal-disclaimer]').should('be.visible');
    cy.get('[data-testid=analyze-button]').should('be.visible');
  });
});
