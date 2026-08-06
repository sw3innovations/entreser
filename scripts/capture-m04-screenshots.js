#!/usr/bin/env node
/**
 * Script para capturar screenshots de todas as rotas M04 (Agendamento)
 *
 * Uso: node scripts/capture-m04-screenshots.js
 *
 * Gera PNGs em: /Users/raiffmaia/dev/sw3/entre-ser/screenshots-m04/png/
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, '../..', 'screenshots-m04/png');

// Criar diretório se não existir
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const routes = [
  { path: '/home', name: '01-home' },
  { path: '/agendar', name: '02-agendar-tipos' },
  { path: '/agendar/individual', name: '03-agendar-profissional-individual' },
  { path: '/sessoes', name: '04-minhas-sessoes-proximas' },
  { path: '/sessoes?tab=anteriores', name: '05-minhas-sessoes-anteriores' },
  { path: '/sessoes?tab=todas', name: '06-minhas-sessoes-todas' },
  { path: '/fase', name: '07-minha-fase' },
  { path: '/feed', name: '08-feed-explorar' },
  { path: '/conta', name: '09-minha-conta' },
];

async function captureScreenshots() {
  let browser;
  try {
    console.log('🚀 Iniciando navegador Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      defaultViewport: { width: 584, height: 753 }, // Mobile viewport (mesmo que os captures anteriores)
    });

    const page = await browser.newPage();

    // Aguardar que o servidor esteja disponível
    console.log('⏳ Aguardando servidor em', BASE_URL);
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle2', timeout: 5000 });
        serverReady = true;
        break;
      } catch (e) {
        console.log(`  Tentativa ${i + 1}/30...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!serverReady) {
      throw new Error('Servidor não respondeu após 30 segundos');
    }

    console.log('✅ Servidor pronto!\n');

    // Capturar screenshots de cada rota
    for (const route of routes) {
      try {
        const url = `${BASE_URL}${route.path}`;
        console.log(`📸 Capturando: ${route.name}`);
        console.log(`   URL: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

        // Aguardar um pouco para certeza de que a página carregou completamente
        await new Promise(r => setTimeout(r, 500));

        const filename = path.join(SCREENSHOTS_DIR, `${route.name}.png`);
        await page.screenshot({ path: filename, fullPage: false });

        console.log(`   ✅ Salvo em: ${filename}\n`);
      } catch (error) {
        console.error(`   ❌ Erro ao capturar ${route.name}:`, error.message, '\n');
      }
    }

    // Capturar screenshots de rotas com dados dinâmicos (profissional, slots, etc)
    console.log('📸 Capturando rotas dinâmicas...\n');

    // Ir para profissional (se existir no mock)
    try {
      await page.goto(`${BASE_URL}/agendar/individual`, { waitUntil: 'networkidle2', timeout: 10000 });

      // Clicar em "Profissional 1" para ver o perfil
      const profLinks = await page.$$('[href*="/agendar/individual/"]');
      if (profLinks.length > 0) {
        await profLinks[0].click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 500));

        const filename = path.join(SCREENSHOTS_DIR, '10-profissional-detalhe.png');
        await page.screenshot({ path: filename, fullPage: false });
        console.log('📸 Profissional detalhe');
        console.log(`   ✅ Salvo em: ${filename}\n`);
      }
    } catch (error) {
      console.log('⚠️  Não foi possível capturar profissional detalhe:', error.message, '\n');
    }

    // Ir para sessão em grupo
    try {
      console.log('📸 Capturando: sessões-em-grupo');

      await page.goto(`${BASE_URL}/agendar`, { waitUntil: 'networkidle2', timeout: 10000 });

      // Clicar em "Roda de Conversa" (grupo)
      const grupoBtns = await page.$$('button');
      let grupoBtn = null;

      for (const btn of grupoBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('Roda de Conversa') || text.includes('grupo')) {
          grupoBtn = btn;
          break;
        }
      }

      if (grupoBtn) {
        await grupoBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));

        const filename = path.join(SCREENSHOTS_DIR, '11-sessoes-em-grupo.png');
        await page.screenshot({ path: filename, fullPage: false });
        console.log(`   ✅ Salvo em: ${filename}\n`);
      }
    } catch (error) {
      console.log('⚠️  Não foi possível capturar sessões em grupo:', error.message, '\n');
    }

    // Ir para detalhe de sessão (se existir)
    try {
      console.log('📸 Capturando: detalhe-sessao');

      await page.goto(`${BASE_URL}/sessoes`, { waitUntil: 'networkidle2', timeout: 10000 });

      // Clicar na primeira sessão
      const sessaoBtns = await page.$$('button');
      let sessaoBtn = null;

      for (const btn of sessaoBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('Individual') || text.includes('Agendada')) {
          sessaoBtn = btn;
          break;
        }
      }

      if (sessaoBtn) {
        await sessaoBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));

        const filename = path.join(SCREENSHOTS_DIR, '12-detalhe-sessao.png');
        await page.screenshot({ path: filename, fullPage: false });
        console.log(`   ✅ Salvo em: ${filename}\n`);
      }
    } catch (error) {
      console.log('⚠️  Não foi possível capturar detalhe de sessão:', error.message, '\n');
    }

    console.log('========================================');
    console.log('✅ Todos os screenshots foram salvos!');
    console.log(`📁 Localização: ${SCREENSHOTS_DIR}`);
    console.log('========================================\n');

    // Listar arquivos criados
    const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
    console.log(`Total de PNGs: ${files.length}`);
    files.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

captureScreenshots();
