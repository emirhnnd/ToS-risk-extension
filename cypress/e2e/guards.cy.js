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
});
