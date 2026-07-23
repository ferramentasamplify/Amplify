const fs = require('fs');

const CREATOR_DB = '2efb0bbe-f153-813a-92a5-c3e20c6130b2';
const BRAND_DB = '365b0bbe-f153-801f-a115-f78dc730a1df';
const SNIPER_DB = '344b0bbef153803d9fe9f956e2f67f20';
const COVERAGE_FROM = process.env.FUNNEL_COVERAGE_FROM || '2026-07-01';
const OUTPUT = process.env.FUNNEL_SNAPSHOT_OUTPUT || '/tmp/growth-funnels-live.json';

function plain(property) {
  if (!property) return '';
  if (property.type === 'rich_text') return (property.rich_text || []).map((item) => item.plain_text || '').join('');
  if (property.type === 'title') return (property.title || []).map((item) => item.plain_text || '').join('');
  if (property.type === 'select') return property.select?.name || '';
  if (property.type === 'status') return property.status?.name || '';
  if (property.type === 'email') return property.email || '';
  if (property.type === 'phone_number') return property.phone_number || '';
  if (property.type === 'formula') return String(property.formula?.string ?? property.formula?.number ?? '');
  return '';
}

function propertyDate(page, name) {
  return page?.properties?.[name]?.date?.start || null;
}

function propertyNumber(property) {
  if (!property) return 0;
  if (property.type === 'number') return Number(property.number) || 0;
  if (property.type === 'formula') return Number(property.formula?.number ?? property.formula?.string) || 0;
  if (property.type === 'rollup') return Number(property.rollup?.number) || 0;
  return Number(plain(property).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function localDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10) || null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function isRenewal(page) {
  return normalize(plain(page?.properties?.['Qual a plataforma de atendimento?'])).includes('renov');
}

function isTestBrand(page) {
  const fields = ['Nome', 'Empresa', 'Origem', '_source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  return fields.some((field) => /(^|\b)(test|teste|qa|interno)(\b|$)/i.test(normalize(plain(page.properties?.[field]))));
}

function brandIdentity(page) {
  const phone = plain(page.properties?.Whats).replace(/\D/g, '');
  if (phone.length >= 8) return `phone:${phone}`;
  const email = normalize(plain(page.properties?.Email));
  if (email) return `email:${email}`;
  const instagram = normalize(plain(page.properties?.Instagram)).replace(/^@/, '');
  if (instagram) return `instagram:${instagram}`;
  return `page:${page.id}`;
}

function creatorChannel(origin) {
  const value = normalize(origin);
  if (value.includes('indique')) return 'referral';
  if (value.includes('organico meta')) return 'instagram-organic';
  if (value.includes('organico tiktok')) return 'tiktok-organic';
  if (value.includes('ads meta') || value.includes('desconhecida')) return 'paid-meta';
  return 'other';
}

function brandChannel(page) {
  const medium = normalize(plain(page.properties?.utm_medium));
  const campaign = normalize(plain(page.properties?.utm_campaign));
  const source = normalize(plain(page.properties?.utm_source));
  const origin = normalize(plain(page.properties?.Origem));
  if (['paid', 'paid_social'].includes(medium) || campaign.startsWith('marcas') || campaign.startsWith('af-leads-marcas') || source === 'meta') return 'paid-meta';
  if (origin === 'instagram' || source === 'instagram' || source === 'ig') return 'instagram-organic';
  if (origin === 'tiktok') return 'tiktok-organic';
  if (origin.includes('mansao live shop')) return 'events';
  if (origin.includes('indicacao')) return 'referral';
  if (origin.includes('pagina na internet')) return 'site';
  return 'other';
}

function creatorRank(phase) {
  const value = normalize(phase);
  if (value.includes('agenciado') || value.includes('convite aceito')) return 4;
  if (value.includes('convite')) return 3;
  if (value.includes('qualificado')) return 2;
  return 1;
}

function brandRank(phase) {
  const value = normalize(phase);
  if (!value) return null;
  if (value.includes('fech') || value.includes('ganho') || value.includes('cliente')) return 5;
  if (value.includes('proposta')) return 4;
  if (value.includes('reuniao')) return 3;
  if (value.includes('qualific')) return 2;
  if (value.includes('contato') || value.includes('atendimento') || value.includes('progresso')) return 1;
  return null;
}

async function queryAll(token, databaseId, filter = null) {
  const results = [];
  let cursor;
  do {
    const body = { page_size: 100, sorts: [{ timestamp: 'created_time', direction: 'ascending' }] };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Notion query failed ${response.status} ${data.code || ''}`);
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function createdSinceFilter() {
  return { timestamp: 'created_time', created_time: { on_or_after: `${COVERAGE_FROM}T00:00:00-03:00` } };
}

function compactCreator(page) {
  const date = localDate(page.created_time);
  if (!date || isRenewal(page)) return null;
  const phase = plain(page.properties?.['Qual fase do agenciamento?']);
  return { d: date, c: creatorChannel(plain(page.properties?.Origem)), r: creatorRank(phase), g: propertyNumber(page.properties?.GMV), s: 'machine' };
}

function compactSniper(page) {
  const date = localDate(propertyDate(page, 'Data do primeiro Huggy') || page.created_time);
  if (!date || date < COVERAGE_FROM) return null;
  const phase = plain(page.properties?.['Status de contato']);
  return { d: date, c: 'sniper', r: creatorRank(phase), g: propertyNumber(page.properties?.GMV), s: 'sniper' };
}

function compactBrand(page) {
  const date = localDate(page.created_time);
  if (!date) return null;
  const phase = plain(page.properties?.['Qual a fase do atendimento?']);
  return { d: date, c: brandChannel(page), r: brandRank(phase), s: 'sales' };
}

function countBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] ?? 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const credentials = JSON.parse(fs.readFileSync('/tmp/creds.json', 'utf8'));
  const credential = credentials.find((item) => item.name === 'Notion <> Amplify');
  const token = credential?.data?.apiKey || credential?.data?.apiToken || credential?.data?.token;
  if (!token) throw new Error('Notion credential not found');

  const [creatorPages, brandPages, sniperPages] = await Promise.all([
    queryAll(token, CREATOR_DB, createdSinceFilter()),
    queryAll(token, BRAND_DB, createdSinceFilter()),
    queryAll(token, SNIPER_DB, null),
  ]);

  const creators = [...creatorPages.map(compactCreator), ...sniperPages.map(compactSniper)].filter(Boolean);
  const brandWithoutTests = brandPages.filter((page) => !isTestBrand(page));
  const seenBrands = new Set();
  const uniqueBrandPages = brandWithoutTests.filter((page) => {
    const identity = brandIdentity(page);
    if (seenBrands.has(identity)) return false;
    seenBrands.add(identity);
    return true;
  });
  const brands = uniqueBrandPages.map(compactBrand).filter(Boolean);
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    coverage: { from: COVERAGE_FROM, to: localDate(new Date().toISOString()) },
    methodology: {
      cohort: 'Leads criados no periodo; etapas representam o estado atual desses mesmos leads.',
      creators: 'Base Novos Creators + Leads Outbound/Sniper; renovacoes excluidas. GMV e o valor atual registrado na coorte, nao o GMV gerado dentro do intervalo do filtro.',
      brands: 'Leads unicos do funil de vendas; testes e envios duplicados por WhatsApp sao removidos. Canal pago identificado por UTM. Etapas comerciais ficam vazias enquanto a fase nao for preenchida na fonte.',
    },
    creators: {
      rows: creators,
      coverage: { stages: true, channel: true, gmv: true },
      sourceCounts: countBy(creators, 's'),
    },
    brands: {
      rows: brands,
      coverage: { stages: brands.some((row) => row.r != null), channel: true, gmv: false },
      sourceCounts: countBy(brands, 's'),
      quality: {
        rawSubmissions: brandPages.length,
        excludedTests: brandPages.length - brandWithoutTests.length,
        excludedDuplicates: brandWithoutTests.length - uniqueBrandPages.length,
        uniqueLeads: brands.length,
      },
    },
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output));
  console.log(JSON.stringify({ output: OUTPUT, creators: creators.length, brands: brands.length, generatedAt: output.generatedAt }));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
