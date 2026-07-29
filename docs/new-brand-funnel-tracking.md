# Tracking — funil Aula → Mentoria

## Objetivo

Registrar automaticamente cada etapa do novo funil de Marcas sem transformar o dashboard em CRM e sem inventar zeros.

Fluxo padrao:

```text
Meta Ads / LP / formulario / checkout / plataforma da aula / Bitrix
                              ↓
                             n8n
                              ↓
POST /api/new-brand-funnel/events (Bearer token)
                              ↓
log idempotente do Amplify Hub → agregacao por periodo → dashboard
```

- **Bitrix** continua sendo o CRM e a fonte dos sinais comerciais.
- **n8n** orquestra, normaliza e reenvia os eventos.
- **Notion** continua como brain/documentacao do projeto, nao como fonte de metrica em tempo real.
- A **LP dedicada** e o formulario enviam eventos primeiro ao n8n; o token privado do Hub nunca vai para o navegador.
- Checkout e plataforma da aula ficam como conectores a definir assim que as ferramentas forem escolhidas.

## Etapas mensuraveis

| # | Etapa no dashboard | Evento canonico | Origem esperada |
|---:|---|---|---|
| 1 | Criativo de baixa consciencia | `creative_view_aula` | Meta Ads → integracao Meta/n8n |
| 2 | Visita na landing page da aula | `page_view_aula` | LP dedicada → n8n |
| 3 | Formulario de diagnostico | `form_submit_aula` | Formulario da LP → n8n |
| 4 | SDR recebe o formulario | `bitrix_lead_created_aula` | n8n → Bitrix |
| 5 | Compra da aula | `purchase_aula` | Checkout → n8n |
| 6 | SDR recebe o sinal de compra | `bitrix_purchase_signal_aula` | n8n → Bitrix |
| 7 | Consumo da aula | `lesson_complete` | Plataforma da aula → n8n |
| 8 | Convite para a mentoria | `mentoria_cta_click` | Aula/LP → n8n |
| 9 | SDR recebe conclusao ou intencao | `bitrix_mentoria_signal` | n8n → Bitrix |
| 10 | Venda da mentoria | `mentoria_sale` | Bitrix/checkout → n8n |

Eventos auxiliares aceitos para diagnostico: `form_start_aula`, `price_reveal_aula`, `checkout_click_aula`, `lesson_start`, `meeting_booked` e `meeting_attended`.

## Contrato do receptor

Endpoint de producao:

```text
POST https://amplify-hub.t2ffoz.easypanel.host/api/new-brand-funnel/events
Authorization: Bearer <NEW_BRAND_FUNNEL_INGEST_TOKEN>
Content-Type: application/json
```

Exemplo sem PII:

```json
{
  "event_id": "purchase_aula:order-987",
  "event_name": "purchase_aula",
  "occurred_at": "2026-07-29T18:32:10.000Z",
  "subject_id": "lead-hash-ou-id-interno",
  "source": "n8n",
  "value": 1,
  "properties": {
    "order_id": "order-987",
    "bitrix_deal_id": "12345",
    "utm_source": "instagram",
    "utm_campaign": "aula-tiktok-shop",
    "currency": "BRL",
    "revenue_cents": 9700
  }
}
```

### Regras obrigatorias

1. `event_id` e idempotente e deve ser exatamente igual em qualquer retry.
2. `occurred_at` e a hora real do evento em ISO-8601, nao a hora do reenvio.
3. `subject_id` usa ID interno ou hash estavel; nunca email, telefone, nome ou CPF.
4. `value` e inteiro positivo. Eventos individuais usam `1`; metricas Meta agregadas podem usar a contagem do dia.
5. O receptor aceita apenas propriedades em allowlist e rejeita PII/campos desconhecidos.
6. Duplicatas podem existir no log, mas a agregacao conta apenas um `event_id`.

## Convencao recomendada de idempotencia

| Evento | Formato de `event_id` |
|---|---|
| Meta agregado | `creative_view_aula:{yyyy-mm-dd}:{ad_id}` |
| Visita de LP | `page_view_aula:{session_id}` |
| Formulario | `form_submit_aula:{submission_uuid}` |
| Lead no Bitrix | `bitrix_lead_created_aula:{bitrix_deal_id}` |
| Compra da aula | `purchase_aula:{order_id}` |
| Sinal de compra no Bitrix | `bitrix_purchase_signal_aula:{bitrix_deal_id}:{order_id}` |
| Aula concluida | `lesson_complete:{course_user_id}:{lesson_id}` |
| Clique para mentoria | `mentoria_cta_click:{subject_id}` |
| Sinal de intencao no Bitrix | `bitrix_mentoria_signal:{bitrix_deal_id}` |
| Venda da mentoria | `mentoria_sale:{bitrix_deal_id-ou-order_id}` |

## Ativacao segura — fazer quando a LP estiver pronta

1. Gerar um token forte fora do chat e salvar `NEW_BRAND_FUNNEL_INGEST_TOKEN` nas variaveis do servico no EasyPanel.
2. Manter `NEW_BRAND_FUNNEL_EVENTS_PATH=/var/lib/amplify-hub/new-brand-funnel-events.jsonl` em volume persistente.
3. Criar no n8n um subworkflow unico **Emitir evento do funil Aula → Mentoria** com retry e o header Bearer.
4. Configurar a LP para enviar `page_view_aula`, `form_start_aula`, `form_submit_aula`, `price_reveal_aula` e `checkout_click_aula` ao webhook publico do n8n.
5. Conectar no n8n os webhooks de checkout, plataforma da aula e Bitrix.
6. Ativar cada evento em `NEW_BRAND_FUNNEL_CONNECTED_EVENTS` somente depois do teste ponta a ponta daquele conector.
7. Reiniciar o servico e validar um evento de teste por etapa, conferindo o periodo correto no dashboard.

Exemplo da lista apos todos os conectores estarem validados:

```text
NEW_BRAND_FUNNEL_CONNECTED_EVENTS=creative_view_aula,page_view_aula,form_submit_aula,bitrix_lead_created_aula,purchase_aula,bitrix_purchase_signal_aula,lesson_complete,mentoria_cta_click,bitrix_mentoria_signal,mentoria_sale
```

## Ordem pratica de conexao

1. **LP + formulario + n8n**: etapas 2 e 3 e eventos auxiliares.
2. **n8n + Bitrix**: etapa 4.
3. **Checkout**: etapas 5 e 6.
4. **Plataforma da aula**: etapas 7 e 8.
5. **Bitrix comercial**: etapas 9 e 10.
6. **Meta Ads**: etapa 1 por campanha/anuncio dedicado, sem misturar com o funil atual.

Enquanto uma fonte nao estiver ativada, o dashboard exibe `—`. Depois de conectada, um periodo sem ocorrencias exibe `0` real.