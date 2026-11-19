'use strict';
// 校了さん TEST: standalone PWA, no Firebase and no remote data transfer.
(() => {
  const KEY = 'koryosan-test-v1';
  const CATEGORIES = [
    {value:'practice',label:'💪練習'},
    {value:'live',label:'🎸ライブ'},
    {value:'other',label:'🥟その他'}
  ];
  const MEMBERS = ['🐧','🦉','🦜'];
  const DOW = ['日','月','火','水','木','金','土'];
  const el = document.querySelector('#app');
  const modal = document.querySelector('#modal-root');
  const toastEl = document.querySelector('#toast');
  const uploader = document.querySelector('#import-file');
  const icons = {
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    users:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 20v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
    notes:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    note:'<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const today = () => dateKey(new Date());
  const parseDay = key => new Date(`${key}T12:00:00`);
  const addDays = (key, days) => { const dt=parseDay(key); dt.setDate(dt.getDate()+days); return dateKey(dt); };
  const timeOptions = () => Array.from({length:288},(_,i)=>{const h=String(Math.floor(i/12)).padStart(2,'0'),m=String((i%12)*5).padStart(2,'0');return `${h}:${m}`;});
  const ALL_TIMES=timeOptions();
  function normalizeTime(t,fallback) {return ALL_TIMES.includes(t)?t:fallback;}
  function normalizeDate(d,fallback=today()) {return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(parseDay(d).getTime())?d:fallback;}
  const defaultData = () => ({version:1,
    schedules:[
      {id:'demo-2026-12-17',category:'practice',date:'2026-12-17',start:'19:00',end:'22:00',place:'新宿NOAH',notes:'・繋ぎとかの練習\n・セトリ通し'},
      {id:'demo-2026-12-22',category:'practice',date:'2026-12-22',start:'19:00',end:'22:00',place:'渋谷ペンタシティサイド',notes:'・セトリ集中通し'}
    ],
    availability:{},
    meetings:[{id:'demo-art-photo',title:'アー写真',rows:[
      {id:'demo-n1',text:'真夏でオワってますが7月末、8月付近に撮れると告知的にベスト、暑さマシな夜とかでもいい'},
      {id:'demo-n2',text:'あまりカッコつけすぎると締まった感じにするの難しそうなので、ラフ目な雰囲気でも良い気がしてる'},
      {id:'demo-n3',text:'🟢8/16府中で撮影の結論'}
    ]}]
  });
  function validateData(raw){
    if (!raw || typeof raw!=='object' || !Array.isArray(raw.schedules) || !Array.isArray(raw.meetings) || !raw.availability || typeof raw.availability!=='object') throw Error('データ形式が正しくありません');
    if (raw.schedules.length>5000 || raw.meetings.length>3000 || Object.keys(raw.availability).length>5000) throw Error('データ件数が上限を超えています');
    const schedules=raw.schedules.map(s=>({id:String(s.id||id()).slice(0,90),category:CATEGORIES.some(c=>c.value===s.category)?s.category:'other',date:normalizeDate(s.date),start:normalizeTime(s.start,'19:00'),end:normalizeTime(s.end,'22:00'),place:String(s.place??'').slice(0,400),notes:String(s.notes??'').slice(0,5000)}));
    const availability={};
    for(const [day,obj] of Object.entries(raw.availability)){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !obj || typeof obj!=='object')continue;
      const vals={};for(const m of MEMBERS)if(typeof obj[m]==='string'&&obj[m]) vals[m]=obj[m].slice(0,400);
      if(Object.keys(vals).length) availability[day]=vals;
    }
    const meetings=raw.meetings.map(m=>({id:String(m.id||id()).slice(0,90),title:String(m.title??'').slice(0,300),rows:(Array.isArray(m.rows)?m.rows:[]).slice(0,500).map(r=>({id:String(r.id||id()).slice(0,90),text:String(r.text??'').slice(0,10000)}))}));
    return {version:1,schedules,availability,meetings};
  }
  function load() {try {const r=localStorage.getItem(KEY);return r?validateData(JSON.parse(r)):defaultData();}catch(e){console.warn('保存データ復元失敗',e);return defaultData();}}
  let state=load(), active='schedule', availabilityWindow=null, toastTimeout=0;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){console.error(e);toast('保存できません。ストレージの空き容量を確認してください');return false;}}
  function toast(text){toastEl.textContent=text;toastEl.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toastEl.classList.remove('visible'),2900);}
  function viewName(){return {schedule:'スケジュール',availability:'空き日程',meeting:'会議'}[active];}
  function header(){return `<header class="topbar">
    <div class="brand">校了さん <span class="test-tag">TEST</span></div>
    <div class="topbar-center">${viewName()}</div>
    <div class="topbar-actions">
      <button class="topicon" data-action="tools" aria-label="バックアップメニュー" title="バックアップ">${svg('dots')}</button>
      ${active==='schedule'||active==='meeting'?`<button class="topicon primary" data-action="add" aria-label="${active==='schedule'?'予定':'会議'}を追加" title="追加">${svg('plus')}</button>`:'<button class="topicon" data-action="go-today" aria-label="今日に移動" title="今日へ">'+svg('calendar')+'</button>'}
    </div></header>`;}
  function footer(){return `<nav class="footer-tabbar" aria-label="画面切り替え">${[
    ['schedule','calendar','スケジュール'],['availability','users','空き日程'],['meeting','notes','会議']
  ].map(([key,ico,name])=>`<button type="button" data-action="tab" data-tab="${key}" class="${active===key?'active':''}" ${active===key?'aria-current="page"':''}>${svg(ico)}<span>${name}</span></button>`).join('')}</nav>`;}
  function dateLabel(key) {const d=parseDay(key);return `${d.getMonth()+1}/${d.getDate()}`;}
  function selectOptions(selected) {return ALL_TIMES.map(time=>`<option value="${time}" ${time===selected?'selected':''}>${time}</option>`).join('');}
  function scheduleCard(item){const cat=CATEGORIES.find(c=>c.value===item.category)||CATEGORIES[2];return `<div class="schedule-scroll"><article class="schedule-card category-${esc(cat.value)}" data-schedule-id="${esc(item.id)}">
    <div class="schedule-fields">
      <label class="schedule-field category"><span class="label">項目</span><select data-sfield="category" aria-label="予定の種類">${CATEGORIES.map(c=>`<option value="${c.value}" ${c.value===item.category?'selected':''}>${c.label}</option>`).join('')}</select></label>
      <label class="schedule-field"><span class="label">日付</span><input type="date" data-sfield="date" value="${esc(item.date)}" aria-label="予定の日付"></label>
      <div class="schedule-field"><span class="label">時間</span><div class="time-pair"><select data-sfield="start" aria-label="開始時刻">${selectOptions(item.start)}</select><span class="time-divider">〜</span><select data-sfield="end" aria-label="終了時刻">${selectOptions(item.end)}</select></div></div>
      <label class="schedule-field"><span class="label">場所</span><input type="text" data-sfield="place" value="${esc(item.place)}" maxlength="400" placeholder="場所" aria-label="場所"></label>
    </div>
    <div class="schedule-note-row"><span class="note-glyph">${svg('note')}</span><textarea data-sfield="notes" rows="1" maxlength="5000" placeholder="備考" aria-label="備考">${esc(item.notes)}</textarea><button type="button" class="small-delete" data-action="delete-schedule" data-id="${esc(item.id)}" aria-label="予定を削除">${svg('trash')}</button></div>
  </article></div>`;}
  function schedulePage(){const events=[...state.schedules].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));return `<div class="page-scroll" data-scroll-page="schedule"><div class="page-inner">
    <div class="page-heading"><h1>スケジュール</h1><span class="counter">${events.length} ITEMS <span class="swipe-marker" aria-label="横スクロール可能" title="横にスクロールできます">↔</span></span></div>
    <div class="schedule-list">${events.length?events.map(scheduleCard).join(''):'<div class="empty-state">予定なし</div>'}</div></div></div>`;}
  function availDay(day){const d=parseDay(day);const wd=d.getDay(),isToday=day===today(),values=state.availability[day]||{};return `<div class="avail-row ${isToday?'is-today':''} ${wd===0||wd===6?'is-weekend':''}" data-day="${day}">
    <div class="avail-date">${dateLabel(day)}<small>${d.getFullYear()}</small></div>
    <div class="avail-day ${wd===0?'sun':wd===6?'sat':''}">${DOW[wd]}</div>
    ${MEMBERS.map(m=>`<label class="avail-cell"><textarea data-avail-date="${day}" data-member="${m}" maxlength="400" rows="1" aria-label="${day} ${m}の空き日程">${esc(values[m]||'')}</textarea></label>`).join('')}
  </div>`;}
  function availabilityPage(){return `<div class="availability-container">
    <div class="avail-toolbar"><label for="jump-date">移動</label><input id="jump-date" type="date" value="${today()}" aria-label="日付へ移動"><button type="button" class="mini-btn" data-action="go-today">今日</button><span class="today-caption">日付・曜日・メンバー3人</span></div>
    <div class="avail-header"><span>日付</span><span>曜日</span>${MEMBERS.map(m=>`<span>${m}</span>`).join('')}</div>
    <div class="avail-scroll" id="avail-scroll" data-scroll-page="availability" aria-label="空き日程一覧"><div id="avail-days"></div></div>
  </div>`;}
  function meetingCard(meeting,index) {return `<article class="meeting-card" data-meeting-id="${esc(meeting.id)}">
    <div class="meeting-head"><span class="meeting-number">${String(index+1).padStart(2,'0')}</span><input type="text" data-mtitle="${esc(meeting.id)}" value="${esc(meeting.title)}" maxlength="300" aria-label="会議タイトル"><button type="button" class="small-delete" data-action="delete-meeting" data-id="${esc(meeting.id)}" aria-label="会議を削除">${svg('trash')}</button></div>
    <div class="meeting-rows">${meeting.rows.map((row,i)=>`<div class="meeting-row"><span class="meeting-index">${String(i+1).padStart(2,'0')}</span><textarea data-mrow="${esc(meeting.id)}" data-row-id="${esc(row.id)}" rows="1" maxlength="10000" aria-label="${esc(meeting.title)} の${i+1}行目" placeholder="内容を入力">${esc(row.text)}</textarea><button type="button" class="small-delete" data-action="delete-row" data-id="${esc(meeting.id)}" data-row-id="${esc(row.id)}" aria-label="この行を削除">${svg('trash')}</button></div>`).join('')}</div>
    <div class="meeting-card-footer"><button class="meeting-add-row" data-action="add-row" data-id="${esc(meeting.id)}" aria-label="${esc(meeting.title)} に行を追加">${svg('plus')} 行を追加</button></div>
  </article>`;}
  function meetingPage(){return `<div class="page-scroll" data-scroll-page="meeting"><div class="page-inner"><div class="page-heading"><h1>会議</h1><span class="counter">${state.meetings.length} TOPICS</span></div><div class="meeting-list">${state.meetings.length?state.meetings.map(meetingCard).join(''):'<div class="empty-state">議題なし</div>'}</div></div></div>`;}
  function render(){
    const scroll=el.querySelector(`[data-scroll-page="${active}"]`);const top=scroll?.scrollTop||0;
    el.innerHTML=header()+`<main class="content">${active==='schedule'?schedulePage():active==='availability'?availabilityPage():meetingPage()}</main>`+footer();
    if(active==='availability')mountAvailability(today());else{const next=el.querySelector(`[data-scroll-page="${active}"]`);if(next)next.scrollTop=top;resizeAll(el);}
    document.title=`校了さん TEST｜${viewName()}`;
  }
  function resizeArea(node){if(!node||node.tagName!=='TEXTAREA')return;node.style.height='auto';node.style.height=`${Math.max(node.classList.contains('unused')?20:0,node.scrollHeight)}px`;}
  function resizeAll(node){node.querySelectorAll('textarea').forEach(resizeArea);}
  function mountAvailability(focusDay){
    const box=el.querySelector('#avail-scroll');const parent=el.querySelector('#avail-days');if(!box||!parent)return;
    const rangeStart=addDays(focusDay,-40),rangeEnd=addDays(focusDay,155);
    availabilityWindow={first:rangeStart,last:rangeEnd,expanding:false};
    const days=[];for(let d=rangeStart;d<=rangeEnd;d=addDays(d,1))days.push(availDay(d));
    parent.innerHTML=days.join('');resizeAll(parent);
    requestAnimationFrame(()=>{const anchor=Array.from(parent.children).find(x=>x.dataset.day===focusDay);if(anchor){box.scrollTop=anchor.offsetTop-parent.offsetTop;box.scrollTop=Math.max(0,box.scrollTop);}const jump=el.querySelector('#jump-date');if(jump)jump.value=focusDay;});
  }
  function extendAvailability(direction){
    const box=el.querySelector('#avail-scroll'),parent=el.querySelector('#avail-days'),range=availabilityWindow;
    if(!box||!parent||!range||range.expanding)return;
    range.expanding=true;
    if(direction==='past'){
      const beforeHeight=parent.scrollHeight;
      const newFirst=addDays(range.first,-55),data=[];
      for(let day=newFirst;day<range.first;day=addDays(day,1))data.push(availDay(day));
      parent.insertAdjacentHTML('afterbegin',data.join(''));range.first=newFirst;
      box.scrollTop+=parent.scrollHeight-beforeHeight;
    }else{
      const newLast=addDays(range.last,90),data=[];
      for(let day=addDays(range.last,1);day<=newLast;day=addDays(day,1))data.push(availDay(day));
      parent.insertAdjacentHTML('beforeend',data.join(''));range.last=newLast;
    }
    resizeAll(parent);range.expanding=false;
  }
  function scheduleForm(){return `<form id="add-schedule-form" class="form-grid">
    <label>項目<select name="category" required>${CATEGORIES.map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}</select></label>
    <label>日付<input name="date" type="date" value="${today()}" required></label>
    <div class="form-two"><label>開始<select name="start">${selectOptions('19:00')}</select></label><label>終了<select name="end">${selectOptions('22:00')}</select></label></div>
    <label>場所<input type="text" name="place" maxlength="400" placeholder="場所" autocomplete="off"></label>
    <label>備考<textarea name="notes" rows="3" maxlength="5000" placeholder="備考"></textarea></label>
  </form>`;}
  function meetingForm(){return `<form id="add-meeting-form" class="form-grid">
    <label>タイトル<input name="title" type="text" maxlength="300" placeholder="タイトル" required autocomplete="off"></label>
    <label>自由記述<textarea name="text" rows="3" maxlength="10000" placeholder="内容"></textarea></label>
  </form>`;}
  function showModal(kind){
    const title=kind==='schedule'?'予定を追加':'議題を追加';
    modal.innerHTML=`<div class="modal-backdrop" data-action="close-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head"><h2>${title}</h2><button type="button" class="modal-close" data-action="close-modal" aria-label="閉じる">×</button></div>
      ${kind==='schedule'?scheduleForm():meetingForm()}
      <div class="modal-footer"><button type="button" class="btn-secondary" data-action="close-modal">キャンセル</button><button type="submit" form="${kind==='schedule'?'add-schedule-form':'add-meeting-form'}" class="btn-primary">追加</button></div>
    </section></div>`;
  }
  function closeModal(){modal.innerHTML='';}
  function exportJson(){const json=JSON.stringify(state,null,2);const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`koryosan-test-backup-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);closeModal();toast('バックアップを保存しました');}
  function showTools(){modal.innerHTML=`<div class="modal-backdrop" data-action="close-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="データ管理"><div class="modal-head"><h2>データ管理</h2><button type="button" class="modal-close" data-action="close-modal" aria-label="閉じる">×</button></div><div class="form-grid">
    <button type="button" class="btn-secondary" data-action="backup-export">${svg('download')} JSONバックアップを保存</button>
    <button type="button" class="btn-secondary" data-action="backup-import">JSONバックアップを読み込む</button>
    <button type="button" class="btn-danger" data-action="reset-test">初期サンプルに戻す</button>
  </div></section></div>`;}
  function findSchedule(key){return state.schedules.find(s=>s.id===key);}
  function findMeeting(key){return state.meetings.find(m=>m.id===key);}
  el.addEventListener('click',event=>{
    const btn=event.target.closest('button[data-action]');if(!btn||btn.disabled)return;
    const act=btn.dataset.action,idx=btn.dataset.id;
    if(act==='tab'){const next=btn.dataset.tab;if(!['schedule','availability','meeting'].includes(next))return;active=next;render();return;}
    if(act==='add'){showModal(active);return;}
    if(act==='tools'){showTools();return;}
    if(act==='go-today'){if(active==='availability')mountAvailability(today());return;}
    if(act==='delete-schedule'){const s=findSchedule(idx);if(s && window.confirm('削除しますか？')){state.schedules=state.schedules.filter(e=>e.id!==idx);save();render();toast('削除しました');}return;}
    if(act==='delete-meeting'){const m=findMeeting(idx);if(m && window.confirm('削除しますか？')){state.meetings=state.meetings.filter(e=>e.id!==idx);save();render();toast('削除しました');}return;}
    if(act==='add-row'){const m=findMeeting(idx);if(!m)return;m.rows.push({id:id(),text:''});save();render();const card=Array.from(el.querySelectorAll('.meeting-card')).find(c=>c.dataset.meetingId===idx);const fields=card?.querySelectorAll('textarea');if(fields?.length){const f=fields[fields.length-1];f.focus();}return;}
    if(act==='delete-row'){const m=findMeeting(idx);if(!m)return;if(window.confirm('この行を削除しますか？')){m.rows=m.rows.filter(r=>r.id!==btn.dataset.rowId);save();render();}return;}
  });
  el.addEventListener('input',event=>{
    const t=event.target;
    if(t.dataset.sfield){const s=findSchedule(t.closest('[data-schedule-id]')?.dataset.scheduleId);if(!s)return;const field=t.dataset.sfield;if(field==='place'||field==='notes'){s[field]=t.value;save();resizeArea(t);}return;}
    if(t.dataset.availDate&&MEMBERS.includes(t.dataset.member)){
      const day=t.dataset.availDate,member=t.dataset.member;
      if(!state.availability[day])state.availability[day]={};
      if(t.value)state.availability[day][member]=t.value;
      else delete state.availability[day][member];
      if(!Object.keys(state.availability[day]).length)delete state.availability[day];
      save();resizeArea(t);return;
    }
    if(t.dataset.mtitle){const m=findMeeting(t.dataset.mtitle);if(m){m.title=t.value;save();}return;}
    if(t.dataset.mrow){const m=findMeeting(t.dataset.mrow),r=m?.rows.find(row=>row.id===t.dataset.rowId);if(r){r.text=t.value;save();resizeArea(t);}return;}
  });
  el.addEventListener('change',event=>{
    const t=event.target;
    if(t.dataset.sfield){const s=findSchedule(t.closest('[data-schedule-id]')?.dataset.scheduleId);if(!s)return;const f=t.dataset.sfield;
      if(f==='category'&&CATEGORIES.some(c=>c.value===t.value))s.category=t.value;
      if(f==='date')s.date=normalizeDate(t.value,s.date);
      if((f==='start'||f==='end')&&ALL_TIMES.includes(t.value))s[f]=t.value;
      save();const parent=t.closest('[data-schedule-id]');if(f==='category'){parent.className=`schedule-card category-${s.category}`;}
      if(f==='date')render();return;
    }
    if(t.id==='jump-date'&&t.value){mountAvailability(normalizeDate(t.value));}
  });
  el.addEventListener('scroll',event=>{
    const box=event.target;if(box.id!=='avail-scroll'||!availabilityWindow)return;
    if(box.scrollTop<180)extendAvailability('past');
    else if(box.scrollTop+box.clientHeight>box.scrollHeight-520)extendAvailability('future');
  },true);
  modal.addEventListener('click',event=>{
    const b=event.target.closest('[data-action]');if(!b)return;
    if(b.dataset.action==='close-backdrop'&&event.target!==b)return;
    const act=b.dataset.action;
    if(act==='close-backdrop'||act==='close-modal')closeModal();
    else if(act==='backup-export')exportJson();
    else if(act==='backup-import')uploader.click();
    else if(act==='reset-test'&&window.confirm('初期サンプルに戻しますか？\nこの端末内の変更内容は削除されます。')){state=defaultData();save();closeModal();render();toast('初期状態に戻しました');}
  });
  modal.addEventListener('submit',event=>{
    event.preventDefault();const form=event.target;const fields=Object.fromEntries(new FormData(form));
    if(form.id==='add-schedule-form'){
      if(!CATEGORIES.some(c=>c.value===fields.category)||!fields.date)return;
      state.schedules.push({id:id(),category:fields.category,date:normalizeDate(fields.date),start:normalizeTime(fields.start,'19:00'),end:normalizeTime(fields.end,'22:00'),place:String(fields.place||'').slice(0,400),notes:String(fields.notes||'').slice(0,5000)});
    }else if(form.id==='add-meeting-form'){
      if(!String(fields.title||'').trim())return;
      state.meetings.push({id:id(),title:String(fields.title).trim().slice(0,300),rows:[{id:id(),text:String(fields.text||'').slice(0,10000)}]});
    }else return;
    save();closeModal();render();toast('追加しました');
  });
  uploader.addEventListener('change',async()=>{
    const file=uploader.files?.[0];uploader.value='';if(!file)return;
    if(file.size>10*1024*1024){toast('10MB以下のJSONを選択してください');return;}
    try{const imported=validateData(JSON.parse(await file.text()));if(!window.confirm('現在のテストデータを読み込んだ内容で置き換えますか？'))return;state=imported;save();closeModal();render();toast('読み込みました');}
    catch(e){window.alert(`バックアップの読み込みに失敗しました：${e.message}`);}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.hasChildNodes())closeModal();});
  render();
  if('serviceWorker' in navigator && (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('オフライン登録:',e)));
  }
})();
