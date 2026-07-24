import { NextResponse } from "next/server";
import { GAMIFICATION_UPDATES_DATA_SOURCE_ID, listGamifications, notionRequest, updateWriteAllowed, richText, titleText, selectText, dateProp } from "@/lib/gamifications";
export const dynamic = "force-dynamic";
export async function POST(request,{params}){
  const allowed=updateWriteAllowed(request); if(!allowed.ok) return NextResponse.json({success:false,error:allowed.reason==="missing_write_key"?"Chave de escrita não configurada no servidor.":"Chave de escrita inválida."},{status:403});
  try { const {id}=await params; const body=await request.json(); const {items}=await listGamifications(); const item=items.find(g=>g.id===id||g.slug===id); if(!item) return NextResponse.json({success:false,error:"Gamificação não encontrada."},{status:404}); const message=String(body.message||"").trim(); if(message.length<3) return NextResponse.json({success:false,error:"Update vazio."},{status:400}); const type=body.type||"Update";
    const updateProperties={"Name":titleText(body.title||`${type}: ${item.name}`),"Gamificação":{relation:[{id:item.id}]},"Data":dateProp(body.date||new Date().toISOString()),"Autor":richText(body.author||"Ruby Retenção"),"Tipo":selectText(type),"Mensagem":richText(message),"Impacto":selectText(body.impact||"Médio"),"Próxima ação":richText(body.nextAction||""),"Criado via":selectText("Ruby Retenção")};
    if(body.newStatus) updateProperties["Novo status"]=selectText(body.newStatus); if(body.evidenceUrl) updateProperties["Evidência/Link"]={url:body.evidenceUrl};
    const created=await notionRequest("pages",{method:"POST",body:{parent:{data_source_id:GAMIFICATION_UPDATES_DATA_SOURCE_ID},properties:updateProperties}});
    const patchProperties={"Último update":dateProp(body.date||new Date().toISOString()),"Próxima ação":richText(body.nextAction||message),"Criado via":selectText("Ruby Retenção")}; if(body.newStatus) patchProperties.Status=selectText(body.newStatus);
    await notionRequest(`pages/${item.id}`,{method:"PATCH",body:{properties:patchProperties}});
    return NextResponse.json({success:true,updateId:created.id,notionUrl:created.url});
  } catch(error){ return NextResponse.json({success:false,error:error.message},{status:500}); }
}
