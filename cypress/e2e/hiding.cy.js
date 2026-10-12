/// <reference types="cypress" />
// Gizleme teknikleri: LLM'e giden isteği yerel test sunucusundan okuyup hangi gizli metnin
// sızdığını ölçer. LLM yanıtı gerekmez (istek, yanıt beklenmeden kaydedilir).
const pad = (i) => String(i).padStart(2, '0');

function analyzeAndReadRequest(page) {
  cy.visit(page);
  cy.get('[data-testid=analyze-button]').click();
  cy.get('[data-testid=risk-score], [data-testid=error]', { timeout: 150_000 }).should('exist');
  return cy.request('/e2e-llm/last').then(({ body }) => body.body.contents[0].parts[0].text);
}

describe('Gizli metin LLM\'e gitmez (29 teknik)', () => {
  it('T01–T28 engellenir; T15 bilinen sınırlama, T29 aslında görünür', () => {
    analyzeAndReadRequest('/terms-hidden-techniques.html').then((sent) => {
      for (let i = 1; i <= 28; i++) {
        if (i === 15) continue; // README: üstü başka elemanla örtülen metin yakalanmaz
        expect(sent, `T${pad(i)} LLM'e gitmemeli`).not.to.include(`T${pad(i)} `);
      }
      expect(sent, 'T15 bilinen sınırlama (değişirse README güncellenmeli)').to.include('T15 ');
      expect(sent, 'T29 görünür, gitmeli').to.include('T29 ');
      expect(sent).to.include('tek taraflı olarak değiştirme'); // görünür sözleşme metni gitti
    });
  });
});

describe('Gerçekçi düzenlerde görünür metin atılmaz (yanlış alarm yok)', () => {
  it('kaydırılabilir kutu, "…" kısaltma, line-clamp, sütunlar, 10 px dipnot, koyu tema: hepsi LLM\'e gider', () => {
    analyzeAndReadRequest('/terms-real-layouts.html').then((sent) => {
      for (let i = 1; i <= 16; i++) {
        if (i === 14) continue; // ekran okuyucu için görsel olarak gizli etiket: atılması doğru
        expect(sent, `R${pad(i)} görünür, gitmeli`).to.include(`R${pad(i)} `);
      }
      expect(sent, 'R14 (sr-only) gitmemeli').not.to.include('R14 ');
    });
  });
});
