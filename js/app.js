/* Datos mockeados: estructura pensada para reemplazar por Supabase */

const TOTAL_FECHAS = 14;
let fechaActual = 14;
let zonaActual = 1;

const fechaData = {
  14: {
    zona1: {
      matches: [
        {status:'final',home:'Porvenir',hs:'s-porvenir',ha:'PO',away:'Sportsman',as:'s-sportsman',aa:'SP',score:'0–0'},
        {status:'final',home:'Campaña',hs:'s-campana',ha:'CA',away:'Carcarañá',as:'s-carcarana',aa:'CR',score:'0–0'},
        {status:'final',home:'Cosmo',hs:'s-cosmo',ha:'CC',away:'San Jerónimo',as:'s-sanjeronimo',aa:'SJ',score:'2–0',hw:true},
      ],
      libre:{team:'Correa',shield:'s-correa',abbr:'CO'}
    },
    zona2: {
      matches: [
        {status:'final',home:"Newell's",hs:'s-newells',ha:'NO',away:'Barraca',as:'s-barraca',aa:'BA',score:'5–0',hw:true},
        {status:'final',home:'América',hs:'s-america',ha:'AM',away:'ADEO',as:'s-adeo',aa:'AD',score:'0–3',aw:true},
        {status:'final',home:'Sport Club',hs:'s-sportclub',ha:'SC',away:'Almafuerte',as:'s-almafuerte',aa:'AF',score:'1–1'},
      ],
      libre:{team:'Unión (T)',shield:'s-union',abbr:'UT'}
    },
    zona3: {
      matches: [
        {status:'final',home:'Argentino',hs:'s-argentino',ha:'AR',away:'Belgrano',as:'s-belgrano',aa:'BE',score:'2–1',hw:true},
        {status:'final',home:'Montes de Oca',hs:'s-montesdeoca',ha:'MO',away:'Independiente',as:'s-independiente',aa:'IN',score:'0–0'},
        {status:'final',home:'Atlético',hs:'s-atletico',ha:'AT',away:'Racing',as:'s-racing',aa:'RA',score:'1–2',aw:true},
      ],
      libre:{team:'Victoria',shield:'s-victoria',abbr:'VI'}
    }
  },
  15: {
    zona1: {
      matches: [
        {status:'next',home:'Cosmo',hs:'s-cosmo',ha:'CC',away:"Newell's",as:'s-newells',aa:'NO',time:'16:00'},
        {status:'next',home:'Porvenir',hs:'s-porvenir',ha:'PO',away:'Campaña',as:'s-campana',aa:'CA',time:'15:30'},
        {status:'next',home:'Sportsman',hs:'s-sportsman',ha:'SP',away:'Carcarañá',as:'s-carcarana',aa:'CR',time:'11:00'},
      ],
      libre:{team:'San Jerónimo',shield:'s-sanjeronimo',abbr:'SJ'}
    },
    zona2: {
      matches: [
        {status:'next',home:'ADEO',hs:'s-adeo',ha:'AD',away:'Sport Club',as:'s-sportclub',aa:'SC',time:'16:00'},
        {status:'next',home:'Barraca',hs:'s-barraca',ha:'BA',away:'América',as:'s-america',aa:'AM',time:'15:30'},
        {status:'next',home:'Almafuerte',hs:'s-almafuerte',ha:'AF',away:'Unión (T)',as:'s-union',aa:'UT',time:'11:00'},
      ],
      libre:{team:'Correa',shield:'s-correa',abbr:'CO'}
    },
    zona3: {
      matches: [
        {status:'next',home:'Belgrano',hs:'s-belgrano',ha:'BE',away:'Montes de Oca',as:'s-montesdeoca',aa:'MO',time:'16:00'},
        {status:'next',home:'Racing',hs:'s-racing',ha:'RA',away:'Atlético',as:'s-atletico',aa:'AT',time:'15:30'},
        {status:'next',home:'Independiente',hs:'s-independiente',ha:'IN',away:'Victoria',as:'s-victoria',aa:'VI',time:'11:00'},
      ],
      libre:{team:'Argentino',shield:'s-argentino',abbr:'AR'}
    }
  }
};

const tablaData = {
  1:[
    {pos:1,name:'Cosmo',abbr:'CC',sh:'s-cosmo',pj:14,pg:9,pe:1,pp:4,dg:'+18',form:['w','w','d','w','w'],pts:28},
    {pos:2,name:'Sportsman',abbr:'SP',sh:'s-sportsman',pj:14,pg:8,pe:2,pp:4,dg:'+10',form:['w','w','l','w','d'],pts:26},
    {pos:3,name:'Porvenir',abbr:'PO',sh:'s-porvenir',pj:14,pg:7,pe:3,pp:4,dg:'+6',form:['d','w','w','l','w'],pts:24},
    {pos:4,name:'Campaña',abbr:'CA',sh:'s-campana',pj:14,pg:6,pe:2,pp:6,dg:'+2',form:['l','d','w','w','d'],pts:20},
    {pos:5,name:'Carcarañá',abbr:'CR',sh:'s-carcarana',pj:14,pg:5,pe:3,pp:6,dg:'-2',form:['w','l','d','l','w'],pts:18},
    {pos:6,name:'San Jerónimo',abbr:'SJ',sh:'s-sanjeronimo',pj:14,pg:3,pe:2,pp:9,dg:'-14',form:['l','l','w','d','l'],pts:11},
    {pos:7,name:'Correa',abbr:'CO',sh:'s-correa',pj:14,pg:2,pe:1,pp:11,dg:'-20',form:['l','l','l','w','l'],pts:7},
  ],
  2:[
    {pos:1,name:"Newell's",abbr:'NO',sh:'s-newells',pj:14,pg:10,pe:1,pp:3,dg:'+22',form:['w','w','w','d','w'],pts:31},
    {pos:2,name:'ADEO',abbr:'AD',sh:'s-adeo',pj:14,pg:8,pe:2,pp:4,dg:'+12',form:['w','w','l','w','w'],pts:26},
    {pos:3,name:'Sport Club',abbr:'SC',sh:'s-sportclub',pj:14,pg:7,pe:3,pp:4,dg:'+8',form:['d','w','w','d','w'],pts:24},
    {pos:4,name:'Almafuerte',abbr:'AF',sh:'s-almafuerte',pj:14,pg:5,pe:4,pp:5,dg:'+1',form:['d','w','l','d','w'],pts:19},
    {pos:5,name:'Barraca',abbr:'BA',sh:'s-barraca',pj:14,pg:4,pe:2,pp:8,dg:'-8',form:['l','d','w','l','l'],pts:14},
    {pos:6,name:'América',abbr:'AM',sh:'s-america',pj:14,pg:3,pe:3,pp:8,dg:'-14',form:['l','l','d','l','l'],pts:12},
    {pos:7,name:'Unión (T)',abbr:'UT',sh:'s-union',pj:14,pg:2,pe:1,pp:11,dg:'-21',form:['l','l','l','w','d'],pts:7},
  ],
  3:[
    {pos:1,name:'Argentino',abbr:'AR',sh:'s-argentino',pj:14,pg:9,pe:2,pp:3,dg:'+16',form:['w','w','w','d','w'],pts:29},
    {pos:2,name:'Belgrano',abbr:'BE',sh:'s-belgrano',pj:14,pg:7,pe:3,pp:4,dg:'+9',form:['w','d','w','l','w'],pts:24},
    {pos:3,name:'Montes de Oca',abbr:'MO',sh:'s-montesdeoca',pj:14,pg:6,pe:4,pp:4,dg:'+5',form:['d','w','d','w','d'],pts:22},
    {pos:4,name:'Racing',abbr:'RA',sh:'s-racing',pj:14,pg:5,pe:3,pp:6,dg:'+1',form:['w','l','d','w','w'],pts:18},
    {pos:5,name:'Independiente',abbr:'IN',sh:'s-independiente',pj:14,pg:4,pe:2,pp:8,dg:'-5',form:['l','d','l','w','l'],pts:14},
    {pos:6,name:'Atlético',abbr:'AT',sh:'s-atletico',pj:14,pg:3,pe:3,pp:8,dg:'-12',form:['l','l','w','d','l'],pts:12},
    {pos:7,name:'Victoria',abbr:'VI',sh:'s-victoria',pj:14,pg:2,pe:1,pp:11,dg:'-14',form:['l','l','l','l','w'],pts:7},
  ]
};

const goleadores = [
  {pos:1,name:'Marcos Alvarez',club:'Cosmo · Zona 1',goles:11},
  {pos:2,name:'Bruno Ferreyra',club:"Newell's · Zona 2",goles:9},
  {pos:3,name:'Diego Molina',club:'Argentino · Zona 3',goles:8},
  {pos:4,name:'Lucas Pereyra',club:'Sportsman · Zona 1',goles:7},
  {pos:5,name:'Facundo Ríos',club:'ADEO · Zona 2',goles:6},
  {pos:6,name:'Ramiro Sosa',club:'Belgrano · Zona 3',goles:6},
];

const equipos = [
  {name:'Cosmo',abbr:'CC',shield:'s-cosmo',pts:28},
  {name:'Sportsman',abbr:'SP',shield:'s-sportsman',pts:26},
  {name:'Porvenir',abbr:'PO',shield:'s-porvenir',pts:24},
  {name:"Newell's",abbr:'NO',shield:'s-newells',pts:31},
  {name:'ADEO',abbr:'AD',shield:'s-adeo',pts:26},
  {name:'Sport Club',abbr:'SC',shield:'s-sportclub',pts:24},
  {name:'Argentino',abbr:'AR',shield:'s-argentino',pts:29},
  {name:'Belgrano',abbr:'BE',shield:'s-belgrano',pts:24},
  {name:'Montes de Oca',abbr:'MO',shield:'s-montesdeoca',pts:22},
];

function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.bn-item').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.sb-link').forEach(t => t.classList.remove('on'));

  const target = document.getElementById('tab-' + id);
  if (target) target.classList.add('on');

  document.querySelectorAll(`[data-tab="${id}"]`).forEach(t => t.classList.add('on'));
  document.querySelectorAll('.bn-item').forEach(t => {
    if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(`'${id}'`)) t.classList.add('on');
  });
  document.querySelectorAll('.sb-link').forEach(t => {
    if (t.getAttribute('onclick') && t.getAttribute('onclick').includes(`'${id}'`)) t.classList.add('on');
  });
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

function renderMatches() {
  const cont = document.getElementById('matchContent');
  const data = fechaData[fechaActual];

  if (!data) {
    cont.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">Sin datos para esta fecha</div>';
    return;
  }

  const zColors = { zona1:'var(--zone1)', zona2:'var(--zone2)', zona3:'var(--zone3)' };
  const zNames = { zona1:'Zona 1', zona2:'Zona 2', zona3:'Zona 3' };

  let html = '';

  ['zona1','zona2','zona3'].forEach(z => {
    const zd = data[z];

    html += `
      <div class="zona-block">
        <div class="zona-head">
          <div class="zona-pip" style="background:${zColors[z]}"></div>
          <div class="zona-name">${zNames[z]}</div>
          <div class="zona-count">7 equipos</div>
        </div>
    `;

    zd.matches.forEach(m => {
      const statusLabel = m.status === 'final' ? 'FINAL' : m.status === 'live' ? 'EN VIVO' : 'PRÓXIMO';
      const statusClass = m.status === 'final' ? 'final' : m.status === 'live' ? 'live' : 'next';
      const homeClass = m.aw ? 'loser' : '';
      const awayClass = m.hw ? 'loser' : '';

      const center = m.status === 'next'
        ? `<div class="mr-time">${m.time}</div>`
        : `<div class="mr-score">${m.score}</div>`;

      html += `
        <div class="match-row">
          <div class="mr-status ${statusClass}">${statusLabel}</div>
          <div class="mr-team ${homeClass}">
            <div class="shield ${m.hs}">${m.ha}</div>
            <span class="name">${m.home}</span>
          </div>
          ${center}
          <div class="mr-team away ${awayClass}">
            <span class="name">${m.away}</span>
            <div class="shield ${m.as}">${m.aa}</div>
          </div>
          <div class="mr-chev">›</div>
        </div>
      `;
    });

    if (zd.libre) {
      html += `
        <div class="match-libre">
          <div class="libre-tag">Libre</div>
          <div class="libre-team">
            <div class="shield ${zd.libre.shield}" style="width:16px;height:16px;font-size:.32rem">${zd.libre.abbr}</div>
            ${zd.libre.team}
          </div>
        </div>
      `;
    }

    html += '</div>';
  });

  cont.innerHTML = html;
}

function renderTabla(zona) {
  const cont = document.getElementById('tablaContent');
  const data = tablaData[zona];

  let html = `
    <div class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>DG</th>
            <th>Forma</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((t, i) => {
    const dots = t.form.map(f => `<span class="fd f${f}"></span>`).join('');
    html += `
      <tr class="${i === 0 ? 't-leader' : ''}">
        <td class="t-pos">${t.pos}</td>
        <td>
          <div class="t-name">
            <div class="sm-badge ${t.sh}">${t.abbr}</div>
            ${t.name}
          </div>
        </td>
        <td>${t.pj}</td>
        <td>${t.pg}</td>
        <td>${t.pe}</td>
        <td>${t.pp}</td>
        <td class="${t.dg.startsWith('+') ? 't-dg' : ''}">${t.dg}</td>
        <td><div class="form-row">${dots}</div></td>
        <td class="t-pts">${t.pts}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  cont.innerHTML = html;
}

function changeDate(dir) {
  const next = fechaActual + dir;
  if (next < 1 || next > TOTAL_FECHAS + 1) return;

  fechaActual = next;
  document.getElementById('dateLabel').textContent = 'Fecha ' + fechaActual;
  document.getElementById('btnPrev').disabled = fechaActual <= 1;
  document.getElementById('btnNext').disabled = fechaActual >= TOTAL_FECHAS + 1;
  renderMatches();
}

function toggleDate() {
  const fechas = Object.keys(fechaData).map(Number).sort((a,b) => a-b);
  const idx = fechas.indexOf(fechaActual);
  fechaActual = fechas[(idx + 1) % fechas.length];

  document.getElementById('dateLabel').textContent = 'Fecha ' + fechaActual;
  renderMatches();
}

document.querySelectorAll('.zt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.zt').forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    zonaActual = parseInt(btn.dataset.zona, 10);
    renderTabla(zonaActual);
  });
});

function renderScorers() {
  document.getElementById('scorersContent').innerHTML = goleadores.map(g => `
    <div class="scorer">
      <div class="sc-pos ${g.pos <= 3 ? 'gold' : ''}">${g.pos}</div>
      <div class="sc-info">
        <div class="sc-name">${g.name}</div>
        <div class="sc-club">${g.club}</div>
      </div>
      <div class="sc-n">${g.goles}<small>goles</small></div>
    </div>
  `).join('');
}

function renderTeams() {
  document.getElementById('teamsContent').innerHTML = equipos.map(e => `
    <div class="team-card">
      <div class="tc-shield ${e.shield}">${e.abbr}</div>
      <div class="tc-name">${e.name}</div>
      <div class="tc-pts">${e.pts} pts</div>
    </div>
  `).join('');
}

document.getElementById('btnPrev').disabled = fechaActual <= 1;
document.getElementById('btnNext').disabled = fechaActual >= TOTAL_FECHAS + 1;

renderMatches();
renderTabla(1);
renderScorers();
renderTeams();