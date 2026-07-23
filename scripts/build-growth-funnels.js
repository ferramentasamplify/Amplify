const fs = require('fs');

const CREATOR_DB = '2efb0bbe-f153-813a-92a5-c3e20c6130b2';
const BRAND_DB = '365b0bbe-f153-801f-a115-f78dc730a1df';
const SNIPER_DB = '344b0bbef153803d9fe9f956e2f67f20';
const COVERAGE_FROM = process.env.FUNNEL_COVERAGE_FROM || '2026-07-01';
const OUTPUT = process.env.FUNNEL_SNAPSHOT_OUTPUT || '/tmp/growth-funnels-live.json';
const BITRIX_WORKFLOW = process.env.BITRIX_WORKFLOW_PATH || '/tmp/bitrix-workflow.json';

function nestedStrings(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => nestedStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => nestedStrings(item, output));
  return output;
}

function bitrixBase() {
  const workflow = JSON.parse(fs.readFileSync(BITRIX_WORKFLOW, 'utf8'));
  const match = nestedStrings(workflow)
    .map((value) => value.match(/https:\/\/[^\s"']+\.bitrix24\.com\.br\/rest\/\d+\/[^/]+\//i))
    .find(Boolean);
  if (!match) throw new Error('Bitrix webhook not found in approved workflow');
  return match[0];
}

async function bitrixCall(base, method, parameters = {}) {
  const url = new URL(`${base}${method}.json`);
  Object.entries(parameters).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(`${key}[]`, String(item)));
    else url.searchParams.append(key, String(value));
  });
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(`Bitrix ${method} failed ${response.status} ${data.error || ''}`);
  return data;
}

async function queryAllDeals(base, categoryId) {
  const rows = [];
  let start = 0;
  do {
    const data = await bitrixCall(base, 'crm.deal.list', {
      'filter[CATEGORY_ID]': categoryId,
      'order[ID]': 'ASC',
      select: [
        'ID', 'TITLE', 'CATEGORY_ID', 'STAGE_ID', 'DATE_CREATE', 'DATE_MODIFY', 'OPPORTUNITY', 'CURRENCY_ID',
        'PHONE', 'EMAIL', 'UF_CRM_1782820123479', 'UF_CRM_1783518223560',
        'UF_CRM_1784577505498', 'UF_CRM_1784577523021', 'UF_CRM_1784577552485',
      ],
      start,
    });
    rows.push(...(data.result || []));
    if (data.next == null) break;
    start = data.next;
  } while (true);
  return rows;
}

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

function firstPlain(page, names) {
  for (const name of names) {
    const value = plain(page?.properties?.[name]);
    if (value) return value;
  }
  return '';
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-11) : '';
}

function normalizeEmail(value) {
  const email = normalize(value);
  return email.includes('@') ? email : '';
}

function dealScalar(value) {
  if (Array.isArray(value)) return value.map((item) => item?.VALUE || item?.value || item).filter(Boolean).join(' ');
  return value == null ? '' : String(value);
}

function sniperBitrixRank(deal) {
  if (!deal) return null;
  const category = Number(deal.CATEGORY_ID);
  const stage = String(deal.STAGE_ID || '');
  if (category === 7) {
    if (['C7:EXECUTING', 'C7:WON'].includes(stage)) return 6;
    if (stage === 'C7:PREPAYMENT_INVOICE') return 5;
    if (['C7:PREPARATION', 'C7:UC_5P8W7H', 'C7:UC_W4KDQY', 'C7:UC_Y5A7KO'].includes(stage)) return 4;
    return 3;
  }
  if (category === 5) {
    if (['C5:EXECUTING', 'C5:UC_0QVPA2', 'C5:FINAL_INVOICE', 'C5:WON'].includes(stage)) return 3;
    if (stage === 'C5:PREPAYMENT_INVOICE') return 2;
    return 1;
  }
  return null;
}

function brandBitrixRank(deal) {
  if (!deal) return null;
  const category = Number(deal.CATEGORY_ID);
  const stage = String(deal.STAGE_ID || '');
  if (category === 0) {
    if (['UC_TSZ6T0', 'FINAL_INVOICE', 'UC_O2M6SW', 'UC_0N932N', 'WON'].includes(stage)) return 6;
    if (['NEW', 'UC_7GD3LJ', 'PREPARATION'].includes(stage)) return 5;
    return 4;
  }
  if (category === 1) {
    if (['C1:EXECUTING', 'C1:WON'].includes(stage)) return 3;
    if (stage === 'C1:PREPAYMENT_INVOICE') return 2;
    if (['C1:PREPARATION', 'C1:UC_BCE7E7', 'C1:UC_1U0AND', 'C1:UC_Z0Y21M', 'C1:UC_T4OSDK', 'C1:UC_DMX2HZ', 'C1:UC_M3NHPY'].includes(stage)) return 1;
    return 0;
  }
  return null;
}

function preferDeal(current, candidate, ranker) {
  if (!current) return candidate;
  const currentRank = ranker(current) ?? -1;
  const candidateRank = ranker(candidate) ?? -1;
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  return Number(candidate.ID) > Number(current.ID) ? candidate : current;
}

function buildSniperDealIndex(deals) {
  const byTitle = new Map();
  const byName = new Map();
  const byPhone = new Map();
  for (const deal of deals) {
    const title = normalize(deal.TITLE);
    const name = normalize(deal.UF_CRM_1784577505498);
    const phone = normalizePhone(deal.UF_CRM_1784577523021 || dealScalar(deal.PHONE));
    if (title) byTitle.set(title, preferDeal(byTitle.get(title), deal, sniperBitrixRank));
    if (name) byName.set(name, preferDeal(byName.get(name), deal, sniperBitrixRank));
    if (phone) byPhone.set(phone, preferDeal(byPhone.get(phone), deal, sniperBitrixRank));
  }
  return { byTitle, byName, byPhone };
}

function matchSniperDeal(page, index) {
  const creatorId = normalize(firstPlain(page, ['Creator ID', 'ID Creator']));
  if (creatorId && index.byTitle.has(creatorId)) return { deal: index.byTitle.get(creatorId), method: 'creator_id' };
  const name = normalize(firstPlain(page, ['Nome do Criador', 'Nome']));
  if (name && index.byName.has(name)) return { deal: index.byName.get(name), method: 'name' };
  const phone = normalizePhone(firstPlain(page, ['WhatsApp', 'Whatsapp', 'Whats']));
  if (phone && index.byPhone.has(phone)) return { deal: index.byPhone.get(phone), method: 'phone' };
  return { deal: null, method: null };
}

function buildBrandDealIndex(deals) {
  const byPhone = new Map();
  const byEmail = new Map();
  for (const deal of deals) {
    const phone = normalizePhone(deal.UF_CRM_1782820123479 || dealScalar(deal.PHONE));
    const email = normalizeEmail(deal.UF_CRM_1783518223560 || dealScalar(deal.EMAIL));
    if (phone) byPhone.set(phone, preferDeal(byPhone.get(phone), deal, brandBitrixRank));
    if (email) byEmail.set(email, preferDeal(byEmail.get(email), deal, brandBitrixRank));
  }
  return { byPhone, byEmail };
}

function matchBrandDeal(page, index) {
  const phone = normalizePhone(firstPlain(page, ['Whats', 'WhatsApp', 'Whatsapp']));
  const email = normalizeEmail(firstPlain(page, ['Email', 'E-mail']));
  const byPhone = phone ? index.byPhone.get(phone) : null;
  const byEmail = email ? index.byEmail.get(email) : null;
  if (byPhone && byEmail && byPhone.ID !== byEmail.ID) return { deal: preferDeal(byPhone, byEmail, brandBitrixRank), method: 'phone_or_email' };
  if (byPhone) return { deal: byPhone, method: 'phone' };
  if (byEmail) return { deal: byEmail, method: 'email' };
  return { deal: null, method: null };
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

function compactSniper(page, dealIndex) {
  const date = localDate(propertyDate(page, 'Data do primeiro Huggy') || page.created_time);
  if (!date || date < COVERAGE_FROM) return null;
  const phase = plain(page.properties?.['Status de contato']);
  const match = matchSniperDeal(page, dealIndex);
  return {
    d: date,
    c: 'sniper',
    r: creatorRank(phase),
    b: match.deal ? sniperBitrixRank(match.deal) : null,
    x: Boolean(match.deal),
    j: match.method,
    g: propertyNumber(page.properties?.GMV),
    s: 'sniper',
  };
}

function compactBrand(page, dealIndex) {
  const date = localDate(page.created_time);
  if (!date) return null;
  const match = matchBrandDeal(page, dealIndex);
  return {
    d: date,
    c: brandChannel(page),
    r: match.deal ? brandBitrixRank(match.deal) : 0,
    x: Boolean(match.deal),
    j: match.method,
    s: 'sales',
  };
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

  const base = bitrixBase();
  const [creatorPages, brandPages, sniperPages, brandCloserDeals, brandSdrDeals, sniperSdrDeals, sniperCloserDeals] = await Promise.all([
    queryAll(token, CREATOR_DB, createdSinceFilter()),
    queryAll(token, BRAND_DB, createdSinceFilter()),
    queryAll(token, SNIPER_DB, null),
    queryAllDeals(base, 0),
    queryAllDeals(base, 1),
    queryAllDeals(base, 5),
    queryAllDeals(base, 7),
  ]);

  const sniperDealIndex = buildSniperDealIndex([...sniperSdrDeals, ...sniperCloserDeals]);
  const brandDealIndex = buildBrandDealIndex([...brandSdrDeals, ...brandCloserDeals]);
  const creators = [
    ...creatorPages.map(compactCreator),
    ...sniperPages.map((page) => compactSniper(page, sniperDealIndex)),
  ].filter(Boolean);
  const brandWithoutTests = brandPages.filter((page) => !isTestBrand(page));
  const seenBrands = new Set();
  const uniqueBrandPages = brandWithoutTests.filter((page) => {
    const identity = brandIdentity(page);
    if (seenBrands.has(identity)) return false;
    seenBrands.add(identity);
    return true;
  });
  const brands = uniqueBrandPages.map((page) => compactBrand(page, brandDealIndex)).filter(Boolean);
  const sniperRows = creators.filter((row) => row.s === 'sniper');
  const matchedSniperRows = sniperRows.filter((row) => row.x);
  const matchedBrandRows = brands.filter((row) => row.x);
  const output = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    coverage: { from: COVERAGE_FROM, to: localDate(new Date().toISOString()) },
    methodology: {
      cohort: 'Leads criados no periodo; etapas representam o estado atual desses mesmos leads.',
      creators: 'Maquina usa Base Novos Creators. Sniper usa entradas da Base Leads Outbound e etapas atuais dos funis SDR/Closer de Aquisicao no Bitrix. Renovacoes excluidas. GMV e o valor atual registrado na coorte, nao o GMV gerado dentro do intervalo.',
      brands: 'Leads unicos e atribuicao vem do Notion/LP; testes e duplicados sao removidos. Etapas comerciais vem dos funis SDR/Closer de Marcas no Bitrix, ligados por WhatsApp ou e-mail. Ganho mensal e tratado como conversao operacional mesmo quando o stage Bitrix ainda esta configurado como em processo.',
    },
    sources: {
      bitrix: {
        status: 'live',
        pipelines: {
          brands: { sdrCategoryId: 1, closerCategoryId: 0, sdrDeals: brandSdrDeals.length, closerDeals: brandCloserDeals.length },
          sniper: { sdrCategoryId: 5, closerCategoryId: 7, sdrDeals: sniperSdrDeals.length, closerDeals: sniperCloserDeals.length },
        },
      },
    },
    creators: {
      rows: creators,
      coverage: { stages: true, sniperBitrixStages: true, channel: true, gmv: true },
      sourceCounts: countBy(creators, 's'),
      bitrixQuality: {
        sniperLeads: sniperRows.length,
        matchedLeads: matchedSniperRows.length,
        unmatchedLeads: sniperRows.length - matchedSniperRows.length,
        matchMethods: countBy(matchedSniperRows, 'j'),
        sdrDeals: sniperSdrDeals.length,
        closerDeals: sniperCloserDeals.length,
      },
    },
    brands: {
      rows: brands,
      coverage: { stages: true, channel: true, gmv: false, bitrixJoin: true },
      sourceCounts: countBy(brands, 's'),
      quality: {
        rawSubmissions: brandPages.length,
        excludedTests: brandPages.length - brandWithoutTests.length,
        excludedDuplicates: brandWithoutTests.length - uniqueBrandPages.length,
        uniqueLeads: brands.length,
        bitrixMatchedLeads: matchedBrandRows.length,
        bitrixUnmatchedLeads: brands.length - matchedBrandRows.length,
        bitrixMatchMethods: countBy(matchedBrandRows, 'j'),
        sdrDeals: brandSdrDeals.length,
        closerDeals: brandCloserDeals.length,
      },
    },
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output));
  console.log(JSON.stringify({ output: OUTPUT, creators: creators.length, brands: brands.length, generatedAt: output.generatedAt }));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
