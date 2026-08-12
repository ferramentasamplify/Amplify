"use client";

import { useMemo, useState } from "react";

const people = {
  Time: { color: "#efff45", short: "Σ" },
  Bruno: { color: "#87ff5c", short: "BZ" },
  Luiz: { color: "#ffcb47", short: "LR" },
};

const weeks = [
  {
    id: "2026-07-20", label: "20/07 · 26/07", status: "Fechada",
    Bruno: { stages: [3, 2, 1, 1, 1, 1], gmv: 8011 },
    Luiz: { stages: [51, 2, 0, 0, 0, 0], gmv: 0 },
  },
  {
    id: "2026-07-27", label: "27/07 · 02/08", status: "Fechada",
    Bruno: { stages: [18, 5, 4, 3, 3, 2], gmv: 336800 },
    Luiz: { stages: [74, 9, 7, 2, 2, 2], gmv: 295800 },
  },
  {
    id: "2026-08-03", label: "03/08 · 09/08", status: "Fechada",
    Bruno: { stages: [12, 10, 8, 5, 3, 2], gmv: 695600 },
    Luiz: { stages: [70, 20, 16, 10, 6, 2], gmv: 137400 },
  },
];

const currentDays = {
  "10/08": {
    Bruno: { goal: 330000, contacts: 5, model1: 5, model2: 0, stages: [5, 3, 2, 1, 1, 0], stageGmv: [null, null, 799200, 502200, 502200, 0] },
    Luiz: { goal: 330000, contacts: 10, model1: 10, model2: 0, stages: [10, 4, 3, 1, 0, 0], stageGmv: [null, null, 640000, 260000, 0, 0] },
  },
  "11/08": {
    Bruno: { goal: 660000, contacts: 7, model1: 7, model2: 0, stages: [7, 5, 4, 3, 3, 0], stageGmv: [null, null, 1180000, 955800, 1230000, 0] },
    Luiz: { goal: 660000, contacts: 19, model1: 17, model2: 2, stages: [19, 8, 4, 1, 1, null], stageGmv: [null, null, 849000, 260000, 206000, null] },
  },
};

const stageLabels = ["Primeiro contato", "Respondidos", "Reunioes agendadas", "Reunioes realizadas", "Propostas ongoing", "Agenciados"];
const historyLabels = ["Conversas iniciadas", "Respondidas", "Reunioes agendadas", "Reunioes realizadas", "Em negociacao", "Aceitas"];
const decimal = (value) => Number(value).toFixed(1).replace(".", ",").replace(",0", "");
const money = (value) => {
  if (value == null) return "—";
  if (Math.abs(value) >= 1000000) return `R$ ${decimal(value / 1000000)} mi`;
  if (Math.abs(value) >= 1000) return `R$ ${decimal(value / 1000)} mil`;
  return `R$ ${Math.round(value)}`;
};
const number = (value) => value == null ? "—" : String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const percent = (a, b) => a == null || b == null || b <= 0 ? null : (a / b) * 100;
const pct = (value) => value == null ? "—" : `${value.toFixed(value >= 10 ? 0 : 1).replace(".", ",")}%`;
const sumKnown = (values) => values.every((value) => value != null) ? values.reduce((total, value) => total + Number(value), 0) : null;
const combinePeople = (left, right) => ({
  stages: left.stages.map((value, index) => sumKnown([value, right.stages[index]])),
  stageGmv: left.stageGmv && right.stageGmv
    ? left.stageGmv.map((value, index) => sumKnown([value, right.stageGmv[index]]))
    : null,
  gmv: left.gmv != null && right.gmv != null ? left.gmv + right.gmv : null,
});

function PersonMark({ name }) {
  return <span className="person-mark" style={{ "--person": people[name].color }}>{people[name].short}</span>;
}

function Funnel({ name, stages, gmvs, labels = stageLabels, compact = false }) {
  const max = Math.max(...stages.filter((v) => Number.isFinite(v)), 1);
  return <div className={`funnel ${compact ? "compact" : ""}`} style={{ "--person": people[name].color }}>
    {stages.map((value, index) => {
      const conversion = index === 0 ? null : percent(value, stages[index - 1]);
      const unavailable = value == null;
      const width = unavailable ? 58 : Math.max(58, (value / max) * 100);
      return <div className="funnel-step" key={labels[index]}>
        {index > 0 && <div className="step-conversion"><span>{pct(conversion)}</span><i /></div>}
        <article className={unavailable ? "unavailable" : ""} style={{ width: `${width}%` }}>
          <div><span>{labels[index]}</span>{gmvs?.[index] != null && <small>{money(gmvs[index])} em GMV</small>}</div>
          <strong>{number(value)}</strong>
        </article>
      </div>;
    })}
  </div>;
}

function TeamOverview({ data }) {
  const combined = combinePeople(data.Bruno, data.Luiz);
  const combinedGoal = data.Bruno.goal + data.Luiz.goal;
  return <section className="team-overview" style={{ "--person": people.Time.color }}>
    <header>
      <div><span className="team-kicker">Soma do time</span><h2>Bruno + Luiz</h2></div>
      <div className="team-topline">
        <div><span>Primeiros contatos</span><strong>{number(combined.stages[0])}</strong></div>
        <div><span>Agenciados</span><strong>{number(combined.stages[5])}</strong></div>
        <div><span>Conversao total</span><strong>{pct(percent(combined.stages[5], combined.stages[0]))}</strong></div>
        <div><span>Meta somada</span><strong>{money(combinedGoal)}</strong></div>
      </div>
    </header>
    <Funnel name="Time" stages={combined.stages} gmvs={combined.stageGmv} labels={stageLabels} compact />
  </section>;
}

function CurrentPerson({ name, data }) {
  const finalGmv = data.stageGmv[5];
  const goalRate = percent(finalGmv, data.goal);
  return <section className="person-panel" style={{ "--person": people[name].color }}>
    <header>
      <div className="person-title"><PersonMark name={name} /><div><span>Executivo</span><h2>{name}</h2></div></div>
      <div className="goal"><span>Meta de GMV</span><strong>{money(finalGmv)} <i>/</i> {money(data.goal)}</strong><div><b style={{ width: `${Math.min(goalRate || 0, 100)}%` }} /></div><small>{goalRate == null ? "Sem agenciamento reportado" : `${pct(goalRate)} da meta`}</small></div>
    </header>
    <div className="message-split">
      <div><span>Primeiros contatos</span><strong>{number(data.contacts)}</strong></div>
      <div><span>Modelo 1 · perfil</span><strong>{number(data.model1)}</strong><small>{pct(percent(data.model1, data.contacts))} do contato</small></div>
      <div><span>Modelo 2 · numeros</span><strong>{number(data.model2)}</strong><small>{pct(percent(data.model2, data.contacts))} do contato</small></div>
    </div>
    <Funnel name={name} stages={data.stages} gmvs={data.stageGmv} />
  </section>;
}

function WeekCard({ week, expanded, onOpen }) {
  const total = combinePeople(week.Bruno, week.Luiz);
  const totalGmv = total.gmv;
  return <article className={`week-card ${expanded ? "expanded" : ""}`}>
    <button className="week-summary" onClick={onOpen} aria-expanded={expanded}>
      <div><span>{week.status}</span><h3>{week.label}</h3></div>
      <div className="week-result"><span>GMV agenciado</span><strong>{money(totalGmv)}</strong></div>
      <div className="week-wins"><span>Agenciados</span><strong>{week.Bruno.stages[5] + week.Luiz.stages[5]}</strong></div>
      <i>{expanded ? "−" : "+"}</i>
    </button>
    {expanded && <div className="week-detail">
      <div className="history-person history-total" style={{ "--person": people.Time.color }}>
        <div className="history-head"><div><PersonMark name="Time" /><strong>Bruno + Luiz</strong></div><div><span>Conversao total</span><b>{pct(percent(total.stages[5], total.stages[0]))}</b><small>{money(total.gmv)}</small></div></div>
        <Funnel name="Time" stages={total.stages} labels={historyLabels} compact />
      </div>
      {["Bruno", "Luiz"].map((name) => <div className="history-person" key={name} style={{ "--person": people[name].color }}>
        <div className="history-head"><div><PersonMark name={name} /><strong>{name}</strong></div><div><span>Conversao total</span><b>{pct(percent(week[name].stages[5], week[name].stages[0]))}</b><small>{money(week[name].gmv)}</small></div></div>
        <Funnel name={name} stages={week[name].stages} labels={historyLabels} compact />
      </div>)}
    </div>}
  </article>;
}

function WeeklyComparison({ current }) {
  const currentTotal = combinePeople(current.Bruno, current.Luiz);
  const rows = [
    ...weeks.map((week) => ({ label: week.label, status: "Fechada", ...combinePeople(week.Bruno, week.Luiz) })),
    { label: "10/08 · 16/08", status: "Em andamento", ...currentTotal },
  ];
  return <section className="weekly-comparison">
    <div className="section-head"><div><span>Comparativo consolidado</span><h2>Semana a semana</h2></div><small>Bruno + Luiz</small></div>
    <div className="table-scroll">
      <table>
        <thead><tr><th>Semana</th><th>Contatos</th><th>Respondidos</th><th>Agendadas</th><th>Realizadas</th><th>Propostas</th><th>Agenciados</th><th>Conv. total</th><th>GMV</th></tr></thead>
        <tbody>{rows.map((row) => <tr className={row.status === "Em andamento" ? "current" : ""} key={row.label}>
          <td><strong>{row.label}</strong><small>{row.status}</small></td>
          {row.stages.slice(0, 6).map((value, index) => <td key={index}><strong>{number(value)}</strong>{index > 0 && <small>{pct(percent(value, row.stages[index - 1]))} da etapa</small>}</td>)}
          <td><strong>{pct(percent(row.stages[5], row.stages[0]))}</strong><small>contato ate aceite</small></td>
          <td><strong>{money(row.gmv)}</strong></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="table-note">A semana atual permanece incompleta porque o report de Luiz em 11/08 nao trouxe Agenciados. Campos dependentes dessa etapa ficam como nao reportados.</p>
  </section>;
}

export default function SalesTeamFunnelsView() {
  const [day, setDay] = useState("11/08");
  const [openWeek, setOpenWeek] = useState("2026-08-03");
  const current = currentDays[day];
  const snapshot = useMemo(() => {
    const result = {};
    for (const name of ["Bruno", "Luiz"]) {
      const d = current[name];
      result[name] = { response: percent(d.stages[1], d.stages[0]), meeting: percent(d.stages[2], d.stages[1]), show: percent(d.stages[3], d.stages[2]) };
    }
    return result;
  }, [current]);

  return <main className="sales-page">
    <nav><a href="/hub"><b>A</b><span>Amplify UGC</span></a><div><a href="/hub/funis">Funis globais</a><a className="active" href="/hub/funil-comercial">Time comercial</a></div></nav>
    <div className="wrap">
      <header className="hero">
        <div><span className="kicker">Aquisicao · Operacao comercial</span><h1>Conversao por<br /><em>pessoa e semana</em></h1><p>Volume, passagem entre etapas e GMV em uma leitura unica.</p></div>
        <div className="hero-board"><span>Semana atual</span><strong>10/08 · 16/08</strong><small>Atualizado com o ultimo report enviado</small></div>
      </header>

      <section className="current-section">
        <div className="section-head"><div><span>Semana em andamento</span><h2>Report diario acumulado</h2></div><div className="day-tabs">{Object.keys(currentDays).map((key) => <button className={day === key ? "active" : ""} onClick={() => setDay(key)} key={key}>{key}</button>)}</div></div>
        <TeamOverview data={current} />
        <div className="current-grid"><CurrentPerson name="Bruno" data={current.Bruno} /><CurrentPerson name="Luiz" data={current.Luiz} /></div>
        <div className="comparison-strip">
          <div><span>Etapa</span><b>Bruno</b><b>Luiz</b></div>
          {[['Contato → resposta','response'],['Resposta → reuniao','meeting'],['Agendada → realizada','show']].map(([label,key]) => <div key={key}><span>{label}</span><b className={snapshot.Bruno[key] >= snapshot.Luiz[key] ? "winner" : ""}>{pct(snapshot.Bruno[key])}</b><b className={snapshot.Luiz[key] > snapshot.Bruno[key] ? "winner" : ""}>{pct(snapshot.Luiz[key])}</b></div>)}
        </div>
        <p className="data-note">Os reports de 11/08 foram tratados como acumulados da semana. Luiz nao informou Agenciados em 11/08, por isso a ultima etapa aparece como fonte nao reportada.</p>
      </section>

      <section className="history-section">
        <div className="section-head"><div><span>Historico semanal</span><h2>Semanas fechadas</h2></div><small>Clique para abrir o funil completo</small></div>
        <div className="weeks">{weeks.slice().reverse().map((week) => <WeekCard key={week.id} week={week} expanded={openWeek === week.id} onOpen={() => setOpenWeek(openWeek === week.id ? "" : week.id)} />)}</div>
      </section>
      <WeeklyComparison current={currentDays["11/08"]} />
    </div>
    <style jsx global>{`
      :global(body){margin:0;background:#080a0d!important;color:#f4f6ef!important}.sales-page{min-height:100vh;background:linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),#080a0d;background-size:48px 48px;font-family:Inter,system-ui,sans-serif;color:#f4f6ef}.sales-page nav{height:62px;padding:0 max(22px,calc((100vw - 1400px)/2));display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #25282d;background:rgba(8,10,13,.93);position:sticky;top:0;z-index:10;backdrop-filter:blur(14px)}nav>a{display:flex;align-items:center;gap:9px;color:#f7f8f2;text-decoration:none;font-weight:800}nav>a b{width:28px;height:28px;display:grid;place-items:center;background:#efff45;color:#080a0d}nav>div{display:flex;gap:7px}nav>div a{color:#7d838b;text-decoration:none;padding:8px 11px;font:700 10px ui-monospace,monospace;text-transform:uppercase;border:1px solid transparent}nav>div a.active{color:#efff45;border-color:#4d521e;background:#14160c}.wrap{max-width:1400px;margin:auto;padding:0 22px 72px}.hero{min-height:310px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #25282d}.kicker,.section-head>div>span{font:800 10px ui-monospace,monospace;letter-spacing:.15em;text-transform:uppercase;color:#efff45}.hero h1{font-size:clamp(48px,6vw,86px);line-height:.91;letter-spacing:-.065em;margin:20px 0}.hero h1 em{font-style:normal;color:#73787d}.hero p{color:#81868e;margin:0}.hero-board{min-width:280px;border:1px solid #353a26;border-left:5px solid #efff45;padding:22px;background:#10120d;display:grid;gap:7px}.hero-board span,.goal>span,.week-result span,.week-wins span{font:700 9px ui-monospace,monospace;text-transform:uppercase;color:#777d84}.hero-board strong{font-size:24px}.hero-board small{color:#666d72}.current-section,.history-section{padding-top:38px}.section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:18px}.section-head h2{font-size:28px;letter-spacing:-.04em;margin:7px 0 0}.section-head>small{color:#656b72}.day-tabs{display:flex;border:1px solid #30343a;padding:3px;background:#0d0f12}.day-tabs button{min-height:44px;padding:0 18px;border:0;background:transparent;color:#727880;font-weight:800;cursor:pointer}.day-tabs button.active{background:#efff45;color:#080a0d}.team-overview{margin-bottom:14px;border:1px solid #4e5425;background:linear-gradient(135deg,rgba(239,255,69,.09),#0d1013 42%);box-shadow:inset 0 3px 0 var(--person)}.team-overview>header{padding:20px;display:flex;align-items:end;justify-content:space-between;gap:22px;border-bottom:1px solid #343922}.team-kicker{font:800 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.14em;color:#efff45}.team-overview h2{margin:5px 0 0;font-size:28px;letter-spacing:-.04em}.team-topline{display:grid;grid-template-columns:repeat(4,1fr);min-width:min(720px,70%);border:1px solid #343922}.team-topline>div{padding:11px 14px;border-right:1px solid #343922;display:grid;gap:4px}.team-topline>div:last-child{border:0}.team-topline span{font:700 8px ui-monospace,monospace;text-transform:uppercase;color:#777e72}.team-topline strong{font-size:18px;color:#efff45}.team-overview>.compact{padding:18px 20px 22px}.team-overview .compact .funnel-step article{min-width:58%;max-width:100%}.current-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.person-panel{min-width:0;border:1px solid #292d32;background:#0d1013;box-shadow:inset 0 3px 0 var(--person)}.person-panel>header{padding:20px;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #292d32}.person-title{display:flex;align-items:center;gap:12px}.person-mark{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--person);color:var(--person);font:900 11px ui-monospace,monospace}.person-title span{color:#676e77;font:700 8px ui-monospace,monospace;text-transform:uppercase}.person-title h2{margin:3px 0 0;font-size:24px}.goal{width:230px;display:grid;gap:4px;text-align:right}.goal strong{font-size:15px}.goal strong i{color:#555b63;font-style:normal}.goal>div{height:4px;background:#24282c}.goal>div b{display:block;height:100%;background:var(--person)}.goal small{color:#636a72;font-size:9px}.message-split{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #292d32}.message-split>div{padding:14px 16px;border-right:1px solid #292d32;display:grid;gap:4px}.message-split>div:last-child{border:0}.message-split span{font:700 8px ui-monospace,monospace;text-transform:uppercase;color:#747b84}.message-split strong{font-size:21px}.message-split small{color:#5e656d;font-size:8px}.funnel{padding:20px;display:grid;gap:0}.funnel-step{display:grid;justify-items:center}.funnel-step article{min-width:58%;height:62px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:color-mix(in srgb,var(--person) 8%,#14171a);border:1px solid color-mix(in srgb,var(--person) 36%,#292d32);clip-path:polygon(2% 0,98% 0,96% 100%,4% 100%)}.funnel-step article.unavailable{border-style:dashed;opacity:.62}.funnel-step article span{font:800 9px ui-monospace,monospace;text-transform:uppercase;color:#a2a8ae}.funnel-step article small{display:block;margin-top:5px;color:var(--person);font-size:9px}.funnel-step article strong{font-size:25px}.step-conversion{height:28px;display:grid;place-items:center;position:relative}.step-conversion span{z-index:1;background:#0d1013;padding:1px 7px;color:#858c94;font:800 9px ui-monospace,monospace}.step-conversion i{position:absolute;width:1px;height:100%;background:#34393e}.comparison-strip{margin-top:14px;border:1px solid #292d32;background:#0d1013;display:grid;grid-template-columns:1.2fr repeat(3,1fr)}.comparison-strip>div{padding:13px 16px;border-right:1px solid #292d32;display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:center}.comparison-strip>div:last-child{border:0}.comparison-strip span{font:700 9px ui-monospace,monospace;text-transform:uppercase;color:#757c84}.comparison-strip b{font-size:13px;color:#70777f}.comparison-strip b.winner{color:#efff45}.data-note{font-size:10px;color:#626970;line-height:1.5;margin:10px 0 0}.weeks{display:grid;gap:9px}.week-card{border:1px solid #292d32;background:#0d1013}.week-summary{width:100%;border:0;background:transparent;color:#f4f6ef;display:grid;grid-template-columns:1.4fr 1fr .6fr 30px;align-items:center;text-align:left;padding:18px 20px;cursor:pointer}.week-summary>div:first-child span{font:800 8px ui-monospace,monospace;text-transform:uppercase;color:#6d747c}.week-summary h3{margin:5px 0 0;font-size:19px}.week-result,.week-wins{display:grid;gap:4px}.week-result strong{font-size:18px;color:#efff45}.week-wins strong{font-size:18px}.week-summary>i{font-size:24px;color:#efff45;font-style:normal}.week-detail{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #292d32}.history-person{min-width:0;padding:18px}.history-total{grid-column:1/-1;border-bottom:1px solid #292d32;background:rgba(239,255,69,.025)}.history-person+div{border-left:1px solid #292d32}.history-head{display:flex;justify-content:space-between;align-items:center}.history-head>div{display:flex;align-items:center;gap:10px}.history-head>div:last-child{display:grid;text-align:right;gap:2px}.history-head span{font:700 8px ui-monospace,monospace;color:#747b83;text-transform:uppercase}.history-head b{color:var(--person);font-size:18px}.history-head small{color:#777e85}.compact{padding:18px 0 0}.compact .funnel-step article{height:48px}.compact .funnel-step article strong{font-size:19px}.compact .step-conversion{height:23px}.weekly-comparison{padding-top:42px}.table-scroll{overflow-x:auto;border:1px solid #292d32;background:#0d1013}.weekly-comparison table{width:100%;min-width:1120px;border-collapse:collapse}.weekly-comparison th{padding:12px 13px;text-align:left;border-bottom:1px solid #34383e;background:#111419;color:#777e86;font:800 8px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}.weekly-comparison td{padding:14px 13px;border-bottom:1px solid #25292e;border-right:1px solid #25292e;vertical-align:top}.weekly-comparison td:last-child{border-right:0}.weekly-comparison tbody tr:last-child td{border-bottom:0}.weekly-comparison td strong{display:block;font-size:14px;white-space:nowrap}.weekly-comparison td small{display:block;margin-top:4px;color:#646b73;font-size:8px;white-space:nowrap}.weekly-comparison tr.current td{background:rgba(239,255,69,.035)}.weekly-comparison tr.current td:first-child{box-shadow:inset 3px 0 0 #efff45}.weekly-comparison tr.current td strong{color:#efff45}.table-note{margin:9px 0 0;color:#626970;font-size:10px;line-height:1.5}@media(max-width:900px){.team-overview>header{align-items:start;display:grid}.team-topline{min-width:0;width:100%}.current-grid,.week-detail{grid-template-columns:1fr}.history-person+div{border-left:0;border-top:1px solid #292d32}.comparison-strip{grid-template-columns:1fr}.comparison-strip>div{border-right:0;border-bottom:1px solid #292d32}.hero-board{min-width:230px}.week-summary{grid-template-columns:1fr 1fr 60px 24px}.week-wins{display:none}}@media(max-width:620px){.team-overview>header{padding:16px}.team-topline{grid-template-columns:1fr 1fr}.team-topline>div{padding:10px}.team-topline>div:nth-child(2){border-right:0}.team-topline>div:nth-child(-n+2){border-bottom:1px solid #343922}.team-overview>.compact{padding:14px 8px 18px}.sales-page nav{padding:0 14px}.sales-page nav>div a:first-child{display:none}.wrap{padding:0 12px 48px}.hero{min-height:310px;display:grid;align-content:center;gap:25px}.hero h1{font-size:48px}.hero-board{min-width:0;padding:16px}.section-head{align-items:start;display:grid;gap:14px}.day-tabs{width:100%}.day-tabs button{flex:1}.person-panel>header{display:grid}.goal{width:100%;text-align:left}.message-split>div{padding:12px 9px}.message-split span{font-size:7px;line-height:1.3}.message-split strong{font-size:18px}.funnel{padding:16px 8px}.funnel-step article{height:58px;padding:0 12px}.funnel-step article span{font-size:8px}.comparison-strip{margin-top:9px}.week-summary{grid-template-columns:1fr 1fr 22px;padding:15px 13px}.week-result{text-align:right}.history-person{padding:14px 8px}.compact{padding-top:15px}.person-mark{width:32px;height:32px}}
    `}</style>
  </main>;
}
