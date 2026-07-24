export const GAMIFICATIONS_DATA_SOURCE_ID = process.env.GAMIFICATIONS_DATA_SOURCE_ID || "3a383593-d74d-8150-9c40-000ba751d928";
export const GAMIFICATIONS_DATABASE_ID = process.env.GAMIFICATIONS_DATABASE_ID || "3a383593-d74d-8127-ace4-c98e61c1604b";
export const GAMIFICATION_UPDATES_DATA_SOURCE_ID = process.env.GAMIFICATION_UPDATES_DATA_SOURCE_ID || process.env.GAMIFICATION_UPDATES_DATABASE_ID || "351c1f61-63a7-49db-9645-dacf6f9cd71c";
export const NOTION_VERSION = "2025-09-03";
export function getNotionToken(){ return process.env.NOTION_TOKEN || process.env.NOTION_SECRET || process.env.NOTION_API_KEY || ""; }
export function textFromRichText(items=[]){ return (items||[]).map(i=>i?.plain_text||i?.text?.content||"").join("").trim(); }
export function propText(prop){
  if(!prop) return "";
  if(prop.type==="title") return textFromRichText(prop.title);
  if(prop.type==="rich_text") return textFromRichText(prop.rich_text);
  if(prop.type==="select") return prop.select?.name||"";
  if(prop.type==="status") return prop.status?.name||"";
  if(prop.type==="multi_select") return (prop.multi_select||[]).map(x=>x.name).filter(Boolean);
  if(prop.type==="url") return prop.url||"";
  if(prop.type==="number") return prop.number??0;
  if(prop.type==="date") return prop.date?.start||"";
  if(prop.type==="checkbox") return !!prop.checkbox;
  if(prop.type==="relation") return (prop.relation||[]).map(x=>x.id);
  return "";
}
export function numberProp(props,name){ const v=propText(props?.[name]); return typeof v==="number"?v:(Number(v||0)||0); }
export function normalizeGamification(page){
  const p=page.properties||{}; const status=propText(p.Status)||"Ideia"; const health=propText(p["Saúde"])||(status==="Concluído"?"Encerrado":"Atenção"); const phase=propText(p["Fase atual"])||status; const target=numberProp(p,"Creators alvo"); const active=numberProp(p,"Creators ativos");
  return { id:page.id, name:propText(p.Nome)||propText(p.Name)||"Gamificação sem nome", slug:propText(p.Slug)||page.id, brand:propText(p.Marca)||"Sem marca", status, health, priority:propText(p.Prioridade)||"Média", phase, responsible:propText(p["Responsável"])||"Sem responsável", verticals:propText(p.Vertical)||[], target:propText(p["Público-alvo"]), objective:propText(p.Objetivo), mechanics:propText(p["Mecânica"]), incentive:propText(p.Incentivo), successCriteria:propText(p["Critério de sucesso"]), hypothesis:propText(p["Hipótese"]), risk:propText(p["Risco principal"]), learnings:propText(p["Aprendizados"]), nextAction:propText(p["Próxima ação"]), startDate:propText(p["Data início"]), endDate:propText(p["Data fim"]), nextCheckpoint:propText(p["Próximo checkpoint"]), lastUpdateAt:propText(p["Último update"])||page.last_edited_time, metrics:{ targetCreators:target, registeredCreators:numberProp(p,"Creators inscritos"), activeCreators:active, posts:numberProp(p,"Conteúdos publicados"), gmv:numberProp(p,"GMV gerado"), amplifyRevenue:numberProp(p,"Receita Amplify"), incentiveCost:numberProp(p,"Custo incentivo"), progress: target>0?Math.min(100,Math.round(active/target*100)):0 }, links:{ notion:page.url||`https://www.notion.so/${page.id.replaceAll("-","")}`, main:propText(p.Link), community:propText(p["Link comunidade"]), assets:propText(p["Link assets"]), dashboard:propText(p["Link dashboard"]) }, createdVia:propText(p["Criado via"]), createdAt:page.created_time, editedAt:page.last_edited_time };
}
export function normalizeUpdate(page){ const p=page.properties||{}; return { id:page.id, title:propText(p["Name"])||propText(p["Título"])||"Update", gamificationIds:propText(p["Gamificação"])||[], date:propText(p.Data)||page.created_time, author:propText(p.Autor)||"Ruby Retenção", type:propText(p.Tipo)||"Update", message:propText(p.Mensagem), impact:propText(p.Impacto)||"Médio", newStatus:propText(p["Novo status"]), nextAction:propText(p["Próxima ação"]), evidenceUrl:propText(p["Evidência/Link"]), createdVia:propText(p["Criado via"]), notionUrl:page.url, createdAt:page.created_time }; }
export function summarizeGamifications(items=[]){ const byStatus={},byHealth={}; let running=0,blocked=0,needsUpdate=0,totalGmv=0,activeCreators=0; const now=Date.now(); for(const it of items){ byStatus[it.status]=(byStatus[it.status]||0)+1; byHealth[it.health]=(byHealth[it.health]||0)+1; if(["Em execução","Lançada","Em acompanhamento"].includes(it.status)||["Lançada","Em acompanhamento"].includes(it.phase)) running++; if(it.health==="Bloqueado") blocked++; totalGmv+=Number(it.metrics?.gmv||0); activeCreators+=Number(it.metrics?.activeCreators||0); const edited=it.lastUpdateAt?new Date(it.lastUpdateAt).getTime():0; if(!edited||now-edited>7*86400000) needsUpdate++; } return {total:items.length,running,blocked,needsUpdate,totalGmv,activeCreators,byStatus,byHealth}; }
export async function notionRequest(endpoint,{method="GET",body,timeoutMs=10000}={}){ const token=getNotionToken(); if(!token) throw new Error("NOTION_TOKEN/NOTION_SECRET ausente."); const res=await fetch(`https://api.notion.com/v1/${endpoint.replace(/^\//,"")}`,{method,cache:"no-store",headers:{Authorization:`Bearer ${token}`,"Notion-Version":NOTION_VERSION,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeoutMs)}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data?.message||`Notion HTTP ${res.status}`); return data; }
export async function queryAllDataSource(dataSourceId,body={}){ let start_cursor; const results=[]; do{ const data=await notionRequest(`data_sources/${dataSourceId}/query`,{method:"POST",body:{page_size:100,...body,...(start_cursor?{start_cursor}:{})}}); results.push(...(data.results||[])); start_cursor=data.has_more?data.next_cursor:null; }while(start_cursor); return results; }
export async function listGamifications(){ const pages=await queryAllDataSource(GAMIFICATIONS_DATA_SOURCE_ID,{sorts:[{timestamp:"last_edited_time",direction:"descending"}]}); const items=pages.map(normalizeGamification); return {items,summary:summarizeGamifications(items),updatedAt:new Date().toISOString()}; }
export async function listUpdatesForGamification(id){ const pages=await queryAllDataSource(GAMIFICATION_UPDATES_DATA_SOURCE_ID,{filter:{property:"Gamificação",relation:{contains:id}},sorts:[{property:"Data",direction:"descending"}]}); return pages.map(normalizeUpdate); }
export function updateWriteAllowed(request){ const configured=process.env.GAMIFICATION_WRITE_KEY||process.env.RUBY_RETENCAO_WRITE_KEY||""; if(!configured) return {ok:false,reason:"missing_write_key"}; const provided=request.headers.get("x-gamification-write-key")||""; return provided===configured?{ok:true}:{ok:false,reason:"invalid_write_key"}; }
export const richText=(content)=>({rich_text:String(content||"").slice(0,1900)?[{type:"text",text:{content:String(content||"").slice(0,1900)}}]:[]});
export const titleText=(content)=>({title:[{type:"text",text:{content:String(content||"Update").slice(0,180)}}]});
export const selectText=(content)=>content?{select:{name:String(content).slice(0,100)}}:undefined;
export const dateProp=(value=new Date().toISOString())=>({date:{start:String(value).slice(0,10)}});
