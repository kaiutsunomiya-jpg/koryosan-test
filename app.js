'use strict';
/* 校了さん：持ち曲は固定、練習タイテとセトリを各3スロットに自動保存。 */
(() => {
  const PREFS_KEY='koryosan.preferences.v5';
  const $app=document.getElementById('app');
  const $modal=document.getElementById('modal-root');
  const $toast=document.getElementById('toast');
  const SLOTS=3;
  const TASK_CATEGORIES=['🎸【アレンジ】','✒️【作業】'];
  const TASK_STATUSES=['進行中','レビュー依頼','保留','完了'];
  const TASK_MEMBERS=['🐧','🦉','🦜'];
  const localDate=()=>{const d=new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const icons={
    songs:'<path d="m9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.5"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
    metronome:'<path d="M4 21h16M9 21l5-17M8 7h2M15 8l4 3"/>',
    score:'<path d="M3 5h18M3 9h18M3 13h18M3 17h18M3 21h18"/><path d="M14 13v-9l6-2v10"/><ellipse cx="12" cy="14" rx="2.6" ry="1.7" fill="currentColor" stroke="none"/><ellipse cx="18" cy="13" rx="2.6" ry="1.7" fill="currentColor" stroke="none"/>',
    back:'<path d="m15 18-6-6 6-6"/>',
    archive:'<path d="M3 5h18v5H3zM5 10v11h14V10M10 14h4"/>',
    edit:'<path d="m4 16-.5 4.5L8 20l11-11-3.5-3.5L4 16Zm9-9 3.5 3.5"/>',
    rename:'<path d="m4 16-.5 4.5L8 20l11-11-3.5-3.5L4 16Zm9-9 3.5 3.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    tasks:'<path d="M3 6l2.5 2.5L9 4M12 6h9M3 15l2.5 2.5L9 13M12 15h9"/>',
    eye:'<path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:'<path d="M3 3l18 18M10.6 6.2A11 11 0 0 1 12 6c6.3 0 10 6 10 6a13 13 0 0 1-3.2 3.7M6 6.5A13 13 0 0 0 2 12s3.7 6 10 6c1.7 0 3.3-.4 4.6-1.1"/>',
    logout:'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
  };
  const ico=(name)=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const guid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const time=s=>`${s<0?'−':''}${Math.floor(Math.abs(s)/60)}:${String(Math.abs(s)%60).padStart(2,'0')}`;
  const pad=n=>String(n).padStart(2,'0');
  const minutesOf=clock=>{const m=/^(\d{2}):(\d{2})$/.exec(clock||'');if(!m)return null;const h=Number(m[1]),n=Number(m[2]);return h<24&&n<60?h*60+n:null;};
  const clockOf=mins=>`${pad(Math.floor(((mins%1440)+1440)%1440/60))}:${pad(((mins%1440)+1440)%1440%60)}`;
  const practiceSpan=s=>{const start=minutesOf(s.startTime),end=minutesOf(s.endTime);if(start===null||end===null)return s.minutes;return (end-start+1440)%1440;};
  const capoText=s=>s.capo==null?'—':String(s.capo);
  const tuneOrder=t=>{const i=KORYOSAN_TUNINGS.indexOf(t);return i<0?999:i;};
  const naturalCompare=(a,b)=>a.localeCompare(b,'ja',{numeric:true,sensitivity:'base'});
  const byCapo=(a,b)=>(a.capo??0)-(b.capo??0)||naturalCompare(a.title,b.title);
  const byDuration=(a,b)=>a.durationSeconds-b.durationSeconds||byCapo(a,b);
  const sorters={capo:byCapo,name:(a,b)=>naturalCompare(a.title,b.title),duration:byDuration};
  const songById=new Map([...KORYOSAN_SONGS,...KORYOSAN_EXTRA].map(song=>[song.id,song]));
  const practiceById=new Map(KORYOSAN_PRACTICE.map(item=>[item.id,item]));
  const newSetlist=i=>({name:`セトリ ${i+1}`,minutes:30,entries:[]});
  const newPractice=i=>({name:`練習 ${i+1}`,minutes:120,startTime:'18:00',endTime:'20:00',entries:[]});
  const makeState=()=>({version:4,detailEdits:{},sort:'capo',taskSort:'deadline',showCompleted:true,activeSetlist:0,activePractice:0,tasks:[],
    setlistSlots:Array.from({length:SLOTS},(_,i)=>newSetlist(i)),
    practiceSlots:Array.from({length:SLOTS},(_,i)=>newPractice(i))});
  function validate(raw){
    if(!raw||typeof raw!=='object')throw Error('保存データの形式が正しくありません');
    const defaults=makeState();
    const validSlot=(s,fallback,isPractice)=>{
      if(!s||typeof s!=='object')return clone(fallback);
      const name=typeof s.name==='string' ? s.name.slice(0,80) : fallback.name;
      const minutes=Number.isInteger(s.minutes)&&s.minutes>=0&&s.minutes<=999?s.minutes:fallback.minutes;
      const entries=Array.isArray(s.entries)?s.entries.slice(0,300).map(entry=>{
        const id=typeof entry?.id==='string'?entry.id.slice(0,90):guid();
        if(isPractice){
          if(!practiceById.has(entry?.presetId))return null;
          const n=entry.minutes;
          return {id,presetId:entry.presetId,minutes:Number.isInteger(n)&&n>=5&&n<=240&&n%5===0?n:practiceById.get(entry.presetId).minutes,
            note:typeof entry.note==='string'?entry.note.slice(0,3000):''};
        }
        return songById.has(entry?.songId)?{id,songId:entry.songId}:null;
      }).filter(Boolean):[];
      if(!isPractice)return {name,minutes,entries};
      const startTime=minutesOf(s.startTime)!==null?s.startTime:fallback.startTime;
      const endTime=minutesOf(s.endTime)!==null?s.endTime:clockOf(minutesOf(startTime)+minutes);
      return {name,minutes,startTime,endTime,entries};
    };
    const tasks=Array.isArray(raw.tasks) ? raw.tasks.slice(0,2000).filter(t=>t&&typeof t==='object').map(t=>({
      id:typeof t.id==='string'?t.id.slice(0,100):guid(),
      category:TASK_CATEGORIES.includes(t.category)?t.category:TASK_CATEGORIES[0],
      name:typeof t.name==='string'?t.name.slice(0,200):'',
      status:TASK_STATUSES.includes(t.status)?t.status:TASK_STATUSES[0],
      deadline:typeof t.deadline==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)?t.deadline:localDate(),
      members:Array.isArray(t.members)?TASK_MEMBERS.filter(m=>t.members.includes(m)):[],
      notes:typeof t.notes==='string'?t.notes.slice(0,4000):''
    })).filter(t=>t.name.trim()):[];
    // 1・2列目は固定。3列目以降だけ、曲ごとのテキストとして端末に保存する。
    const detailEdits={};
    if(raw.detailEdits && typeof raw.detailEdits==='object' && !Array.isArray(raw.detailEdits)){
      for(const [songId,entry] of Object.entries(raw.detailEdits)){
        const sections=KORYOSAN_DETAILS?.[songId];
        if(!sections?.length || !entry || typeof entry!=='object')continue;
        const headers=Array.isArray(entry.columns) ? entry.columns.slice(0,6).map((v,i)=>typeof v==='string'?v.slice(0,30):`追記メモ ${i+1}`) : ['追記メモ 1'];
        if(!headers.length)headers.push('追記メモ 1');
        const cells={};
        if(entry.cells && typeof entry.cells==='object' && !Array.isArray(entry.cells)){
          for(const [index,values] of Object.entries(entry.cells)){
            const row=Number(index);
            if(!Number.isInteger(row)||row<0||row>=sections.length||!Array.isArray(values))continue;
            cells[row]=values.slice(0,headers.length).map(value=>typeof value==='string'?value.slice(0,5000):'');
          }
        }
        const columnIds=Array.isArray(entry.columnIds)&&entry.columnIds.length===headers.length&&entry.columnIds.every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v)) ? entry.columnIds.slice() : headers.map((_,i)=>`memo${i+1}`);
        detailEdits[songId]={columns:headers,columnIds,cells};
      }
    }
    // v3で3列目に追記済みの内容と、2列目に置かれていた固定コメントを両方残す。
    if((raw.version??3)<4){
      for(const [songId,entry] of Object.entries(detailEdits)){
        const sections=KORYOSAN_DETAILS?.[songId]||[];
        for(const [index,section] of sections.entries()){
          if(!section.note)continue;
          const row=entry.cells[index]||[];
          const previous=typeof row[0]==='string'?row[0]:'';
          row[0]=previous.includes(section.note)?previous:section.note+(previous?'\n\n'+previous:'');
          entry.cells[index]=row;
        }
      }
    }
    return {version:4,detailEdits,tasks,taskSort:raw.taskSort==='member'?'member':'deadline',showCompleted:raw.showCompleted!==false,sort:['capo','name','duration'].includes(raw.sort)?raw.sort:'capo',
      activeSetlist:[0,1,2].includes(raw.activeSetlist)?raw.activeSetlist:0,
      activePractice:[0,1,2].includes(raw.activePractice)?raw.activePractice:0,
      setlistSlots:defaults.setlistSlots.map((s,i)=>validSlot(raw.setlistSlots?.[i],s,false)),
      practiceSlots:defaults.practiceSlots.map((s,i)=>validSlot(raw.practiceSlots?.[i],s,true))};
  }
  function read(){
    // 認証前の公開用データや端末の旧版保存データを復元しない。
    const data=validate(window.__KORYO_INITIAL_STATE||makeState());
    try {const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');
      data.sort=['capo','name','duration'].includes(prefs.sort)?prefs.sort:'capo';
      data.taskSort=prefs.taskSort==='member'?'member':'deadline';data.showCompleted=prefs.showCompleted!==false;
      data.activeSetlist=[0,1,2].includes(prefs.activeSetlist)?prefs.activeSetlist:0;
      data.activePractice=[0,1,2].includes(prefs.activePractice)?prefs.activePractice:0;
    }catch(_){}
    // 旧版の保存データは自動削除しない。バックアップ後にユーザーの明示操作で削除。
    return data;
  }
  let state=read(), page='tasks', detailSong=null, modalOpen=false, taskEditingId=null, dragging=null;
  const scrollPos={task:0,song:0,detail:0,detailX:0,practiceDraft:0,practiceLibrary:0,setDraft:0,setLibrary:0};
  let lastPublished=clone(state), pendingRemote=null;
  function persistPrefs(){
    try{localStorage.setItem(PREFS_KEY,JSON.stringify({sort:state.sort,taskSort:state.taskSort,showCompleted:state.showCompleted,activeSetlist:state.activeSetlist,activePractice:state.activePractice}));}
    catch(error){console.warn('設定保存:',error);}
  }
  function save(){
    // JSON丸ごと上書きしない。差分を小さなDBノード単位で更新する。
    const next=clone(state),prior=lastPublished;lastPublished=next;
    persistPrefs();
    void window.KoryoCloud.publish(prior,next).catch(error=>{console.error('共有保存:',error);toast('共有保存に失敗しました。再読み込みして状態を確認してください');});
  }
  function syncError(message){toast(message);}
  function hasActiveEditor(){const active=document.activeElement;return modalOpen || !!(active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName));}
  function receiveRemote(branch,model){
    if(hasActiveEditor()) { pendingRemote={...(pendingRemote||{}),[branch]:model};return; }
    applyRemote(branch,model);
  }
  function applyRemote(branch,model){
    if(branch==='songs'||branch==='setlistExtras'||branch==='practicePresets'||branch==='songSections'){
      songById.clear();for(const s of [...KORYOSAN_SONGS,...KORYOSAN_EXTRA])songById.set(s.id,s);
      practiceById.clear();for(const p of KORYOSAN_PRACTICE)practiceById.set(p.id,p);
    }
    if(branch==='tasks')state.tasks=validate({...state,tasks:model.state.tasks}).tasks;
    if(branch==='songNotes')state.detailEdits=validate({...state,detailEdits:model.state.detailEdits}).detailEdits;
    if(branch==='setlistSlots')state.setlistSlots=validate({...state,setlistSlots:model.state.setlistSlots}).setlistSlots;
    if(branch==='practiceSlots')state.practiceSlots=validate({...state,practiceSlots:model.state.practiceSlots}).practiceSlots;
    // 遠隔の更新は次回差分の基準にも反映し、他人の値を誤って再送信しない。
    lastPublished=clone(state);
    const affectsCurrent =
      (branch==='tasks' && page==='tasks') ||
      (branch==='songNotes' && page==='detail') ||
      (branch==='practiceSlots' && page==='practice') ||
      (branch==='setlistSlots' && page==='setlist') ||
      (['songs','songSections','setlistExtras','practicePresets'].includes(branch) && ['songs','detail','practice','setlist'].includes(page));
    // 別メンバーがタスクを更新しても、メトロノームを勝手に停止させない。
    if(!modalOpen && affectsCurrent)render();
  }
  function flushRemote(){if(hasActiveEditor()||!pendingRemote)return;const ready=pendingRemote;pendingRemote=null;for(const [branch,model] of Object.entries(ready))applyRemote(branch,model);}
  window.KoryoApp={receiveRemote,syncError};
  let toastTimer;
  function toast(message){$toast.textContent=message;$toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$toast.classList.remove('show'),3000);}
  function slot(kind){return kind==='setlist'?state.setlistSlots[state.activeSetlist]:state.practiceSlots[state.activePractice];}
  function sum(kind){return slot(kind).entries.reduce((n,e)=>n+(kind==='practice'?e.minutes:(songById.get(e.songId)?.durationSeconds||0)),0);}
  function groupedSongs(sortMode){return KORYOSAN_TUNINGS.map(t=>({tuning:t,songs:KORYOSAN_SONGS.filter(s=>s.tuning===t).slice().sort(sorters[sortMode]||byCapo)}));}
  function storeScroll(){for(const [key,el] of Object.entries({task:document.querySelector('[data-scroll="task"]'),detail:document.querySelector('[data-scroll="detail"]'),song:document.querySelector('[data-scroll="song"]'),practiceDraft:document.querySelector('[data-scroll="practiceDraft"]'),practiceLibrary:document.querySelector('[data-scroll="practiceLibrary"]'),setDraft:document.querySelector('[data-scroll="setDraft"]'),setLibrary:document.querySelector('[data-scroll="setLibrary"]')}))if(el)scrollPos[key]=el.scrollTop;
    const table=document.querySelector('.detail-lyrics-wrap');if(table)scrollPos.detailX=table.scrollLeft;
  }
  function restoreScroll(){Object.keys(scrollPos).forEach(key=>{const el=document.querySelector(`[data-scroll="${key}"]`);if(el)el.scrollTop=scrollPos[key];});
    const table=document.querySelector('.detail-lyrics-wrap');if(table)table.scrollLeft=scrollPos.detailX;
  }
  function slotButtons(kind){
    const arr=kind==='practice'?state.practiceSlots:state.setlistSlots,active=kind==='practice'?state.activePractice:state.activeSetlist;
    return `<div class="header-slotbar" role="group" aria-label="${kind==='practice'?'練習タイテ':'セトリ'}のスロット">${arr.map((s,i)=>`<div class="header-slot ${i===active?'active':''}">
      <button type="button" class="slot-button" data-action="slot" data-kind="${kind}" data-index="${i}" aria-pressed="${i===active}" aria-label="${esc(s.name)}・スロット${i+1}"><small>${i+1}</small><strong>${esc(s.name||`スロット${i+1}`)}</strong></button>
      <button type="button" class="slot-rename" data-action="slot-rename" data-kind="${kind}" data-index="${i}" aria-label="${esc(s.name)}の名前を変更" title="名前を変更">${ico('rename')}</button>
    </div>`).join('')}</div>`;
  }
  function header(){
    if(page==='practice'||page==='setlist')return `<header class="app-header app-header-slots">${slotButtons(page)}</header>`;
    let title='曲リスト',left='',right='';
    if(page==='tasks'){
      title='タスク';
      right=`<button class="top-tool" data-action="task-toggle-completed" aria-pressed="${state.showCompleted}" aria-label="完了タスクを${state.showCompleted?'非表示':'表示'}" title="完了タスクを${state.showCompleted?'非表示':'表示'}">${ico(state.showCompleted?'eye':'eyeOff')}</button><button class="top-tool" data-action="task-add" aria-label="タスクを追加" title="タスクを追加">${ico('plus')}</button>`;
    } else if(page==='detail'){
      title='曲詳細';left=`<button data-action="detail-back" class="nav-back" aria-label="曲リストへ戻る">${ico('back')}</button>`;
    } else if(page==='metronome')title='メトロノーム';
    else right=`<button class="top-tool" data-action="data" aria-label="バックアップ・復元" title="バックアップ・復元">${ico('archive')}</button>`;
    return `<header class="app-header"><div class="header-left">${left}</div><div class="header-title">${esc(title)}</div><div class="header-right">${right}</div></header>`;
  }
  function tabs(){return `<nav class="tabbar" aria-label="画面切り替え">${[
    ['tasks','tasks','タスク'],['songs','songs','曲リスト'],['practice','clock','練習タイテ'],['setlist','list','セトリ作成'],['metronome','metronome','メトロノーム']
  ].map(([key,iconName,name])=>`<button class="tab ${page===key||(key==='songs'&&page==='detail')?'active':''}" data-action="tab" data-page="${key}" ${page===key?'aria-current="page"':''}>${ico(iconName)}<span>${name}</span></button>`).join('')}</nav>`;}
  function songTable(songs,flat=false){return `<div class="song-rows">${songs.map(song=>`<div class="song-row ${flat?'flat':''}">
    <span class="song-title">${esc(song.title)}</span>${flat?`<span class="song-tuning">${esc(song.tuning)}</span>`:''}<span class="song-data">${capoText(song)}</span>
    <span class="song-data">${time(song.durationSeconds)}</span><span class="song-data">${song.bpm}</span>
    <button class="score-btn" data-action="detail" data-song="${song.id}" title="${esc(song.title)}の詳細" aria-label="${esc(song.title)}の詳細を見る">${ico('score')}<span>詳細</span></button></div>`).join('')}</div>`;}
  function songsPage(){
    const flat=state.sort!=='capo';
    const all=flat?KORYOSAN_SONGS.slice().sort(sorters[state.sort]):[];
    return `<main class="page-scroll songs-page" data-scroll="song">
      <div class="compact-page-heading"><h1>曲リスト</h1><span class="song-counter">${KORYOSAN_SONGS.length}</span></div>
      <div class="sortbar"><div class="sortgroup" role="group" aria-label="並び替え">${[['capo','Capo順'],['name','名前順'],['duration','演奏時間順']].map(([k,t])=>`<button data-action="sort" data-sort="${k}" class="${state.sort===k?'selected':''}" aria-pressed="${state.sort===k}">${t}</button>`).join('')}</div></div>
      <div class="table-labels ${flat?'flat':''}"><span>曲名</span>${flat?'<span>チューニング</span>':''}<span>Capo</span><span>演奏時間</span><span>BPM</span><span>詳細</span></div>
      ${flat?songTable(all,true):groupedSongs('capo').map(({tuning,songs})=>`<section class="tuning-section"><div class="tuning-heading"><span class="tuning-mark"></span><h2>${esc(tuning)}</h2><small>${songs.length}</small></div>${songTable(songs)}</section>`).join('')}
    </main>`;
  }
  function detailData(songId){
    const saved=state.detailEdits[songId]||{columns:['追記メモ 1'],cells:{}};
    const sections=KORYOSAN_DETAILS?.[songId]||[];
    const cells={};
    for(const [i,row] of sections.entries()){
      const values=Array.isArray(saved.cells?.[i])?[...saved.cells[i]]:[];
      // v3以前の固定コメントを3列目に移し、編集した内容（空欄含む）を優先。
      if(!Object.prototype.hasOwnProperty.call(values,0)&&row.note)values[0]=row.note;
      cells[i]=values;
    }
    return {columns:[...saved.columns],columnIds:[...(saved.columnIds||saved.columns.map((_,i)=>`memo${i+1}`))],cells};
  }
  function detailsPage(){
    const song=songById.get(detailSong);if(!song)return songsPage();
    const sections=KORYOSAN_DETAILS?.[song.id]||[];
    const extra=detailData(song.id),cols=extra.columns.length;
    return `<main class="page-scroll details-page" data-scroll="detail">
      <div class="detail-hero"><h1>${esc(song.title)}</h1><div class="detail-metadata"><span>${esc(song.tuning)}</span><span>Capo ${capoText(song)}</span><span>${song.bpm} BPM</span><span>${time(song.durationSeconds)}</span></div></div>
      ${sections.length?`<div class="detail-tools"><button type="button" class="detail-add-column" data-action="detail-add-column" aria-label="追記列を追加" title="追記列を追加" ${cols>=6?'disabled':''}>${ico('plus')}</button></div>
      <div class="detail-lyrics-wrap" role="region" aria-label="${esc(song.title)}の構成・歌詞・追記欄" tabindex="0">
        <div class="detail-lyrics-table" style="--detail-extra-count:${cols}">
          <div class="detail-lyrics-head" role="row"><span role="columnheader">構成</span><span role="columnheader">歌詞・備考</span>${extra.columns.map((label,index)=>`<span class="detail-col-head" role="columnheader"><span class="detail-col-name">${esc(label)}</span><button class="detail-rename-button" type="button" data-action="detail-rename-column" data-column="${index}" title="列名を変更" aria-label="${esc(label)}の列名を変更">${ico('edit')}</button></span>`).join('')}</div>
          ${sections.map((row,i)=>`<div class="detail-lyric-row" role="row"><div class="detail-structure" role="cell">${esc(row.section)}</div>
            <div class="detail-lyric-cell" role="cell">${row.lyrics?`<div class="detail-lyric-text">${esc(row.lyrics)}</div>`:''}</div>
            ${extra.columns.map((_,column)=>{const val=extra.cells[i]?.[column]??'';return `<div class="detail-extra-cell" role="cell"><button type="button" class="detail-edit-button" data-action="detail-edit" data-row="${i}" data-column="${column}" aria-label="${esc(row.section)}、${esc(extra.columns[column])}を編集" title="編集">${ico('edit')}</button>${val?`<div class="detail-extra-content">${esc(val)}</div>`:''}</div>`;}).join('')}
          </div>`).join('')}
        </div>
      </div>`:'<div class="detail-placeholder">—</div>'}
    </main>`;
  }
  function openDetailEdit(row,column){
    if(page!=='detail'||!detailSong)return;
    const section=KORYOSAN_DETAILS?.[detailSong]?.[row];
    const extra=detailData(detailSong);
    if(!section||!Number.isInteger(column)||column<0||column>=extra.columns.length)return;
    modalOpen=true;
    const current=extra.cells[row]?.[column]||'';
    $modal.innerHTML=`<div class="overlay task-overlay" data-action="overlay"><section class="dialog task-dialog detail-dialog" role="dialog" aria-modal="true" aria-label="追記メモを編集">
      <div class="dialog-head"><h2>追記メモを編集</h2><button type="button" data-action="close-dialog" aria-label="閉じる">×</button></div>
      <div class="detail-edit-context">${esc(songById.get(detailSong)?.title)} ／ ${esc(section.section)} ／ ${esc(extra.columns[column])}</div>
      <form id="detail-edit-form" class="task-form"><input type="hidden" name="row" value="${row}"><input type="hidden" name="column" value="${column}">
        <label>内容<textarea name="content" rows="9" maxlength="5000" placeholder="この区間の演奏メモなどを記入">${esc(current)}</textarea></label>
        <div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">変更を保存</button></div>
      </form></section></div>`;
    $modal.querySelector('textarea[name="content"]')?.focus();
  }
  function submitDetailEdit(form){
    if(page!=='detail'||!detailSong)return;
    const fields=new FormData(form);
    const row=Number(fields.get('row')),column=Number(fields.get('column'));
    const sections=KORYOSAN_DETAILS?.[detailSong];
    const current=detailData(detailSong);
    if(!sections?.[row]||!Number.isInteger(column)||column<0||column>=current.columns.length)return;
    const data=state.detailEdits[detailSong]||(state.detailEdits[detailSong]=current);
    const rowValues=data.cells[row]||[];
    rowValues[column]=String(fields.get('content')||'').slice(0,5000);
    data.cells[row]=rowValues;
    save();closeData();render();toast('追記メモを保存しました');
  }
  function addDetailColumn(){
    if(page!=='detail'||!detailSong||!KORYOSAN_DETAILS?.[detailSong]?.length)return;
    const data=detailData(detailSong);
    if(data.columns.length>=6){toast('最大6列です');return;}
    const n=data.columns.length+1;
    data.columns.unshift(`追記メモ ${n}`);
    data.columnIds.unshift(`memo_${guid().replace(/[^a-zA-Z0-9_-]/g,'')}`);
    for(const row of Object.values(data.cells))row.unshift('');
    state.detailEdits[detailSong]=data;save();render();
    const wrap=document.querySelector('.detail-lyrics-wrap');if(wrap)wrap.scrollLeft=0;
  }
  function openColumnRename(index){
    if(page!=='detail'||!detailSong)return;
    const data=detailData(detailSong);if(!Number.isInteger(index)||index<0||index>=data.columns.length)return;
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-label="列名の変更"><div class="dialog-head"><h2>列名</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div>
      <form id="detail-rename-form" class="task-form"><input type="hidden" name="column" value="${index}"><label>列名<input type="text" name="label" value="${esc(data.columns[index])}" required maxlength="30"></label><div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">保存</button></div></form></section></div>`;
  }
  function submitColumnRename(form){
    if(page!=='detail'||!detailSong)return;
    const fields=new FormData(form),i=Number(fields.get('column')),name=String(fields.get('label')||'').trim().slice(0,30),data=detailData(detailSong);
    if(!name||!Number.isInteger(i)||i<0||i>=data.columns.length)return;
    data.columns[i]=name;state.detailEdits[detailSong]=data;save();closeData();render();
  }
  function taskStatusClass(status){return {'進行中':'in-progress','レビュー依頼':'in-review','保留':'on-hold','完了':'done'}[status]||'in-progress';}
  function sortedTasks(){
    const compare=(a,b)=>{
      const completed=Number(a.status==='完了')-Number(b.status==='完了');if(completed)return completed;
      if(state.taskSort==='member'){
        const key=t=>t.members.length?TASK_MEMBERS.filter(m=>t.members.includes(m)).map(m=>TASK_MEMBERS.indexOf(m)).join(','):'z';
        return key(a).localeCompare(key(b))||a.deadline.localeCompare(b.deadline)||naturalCompare(a.name,b.name);
      }
      return a.deadline.localeCompare(b.deadline)||naturalCompare(a.name,b.name);
    };
    return state.tasks.filter(t=>state.showCompleted||t.status!=='完了').slice().sort(compare);
  }
  function tasksPage(){
    const tasks=sortedTasks();
    return `<main class="page-scroll tasks-page" data-scroll="task">
      <div class="compact-page-heading"><h1>タスク</h1><span class="song-counter">${state.tasks.length}</span></div>
      <div class="task-sortbar"><div class="sortgroup" role="group" aria-label="タスクの並び替え">${[['deadline','期限順'],['member','担当者順']].map(([k,label])=>`<button data-action="task-sort" data-sort="${k}" aria-pressed="${state.taskSort===k}" class="${state.taskSort===k?'selected':''}">${label}</button>`).join('')}</div><div class="task-status-count">${state.tasks.filter(t=>t.status!=='完了').length} / ${state.tasks.length}</div></div>
      <div class="tasks-table" role="region" aria-label="タスク一覧・横スクロール可能" tabindex="0"><div class="tasks-grid"><div class="task-table-header" role="row"><span>分類</span><span>タスク名</span><span>ステータス</span><span>期限</span><span>担当</span><span>備考</span></div>
      ${tasks.map(task=>`<button class="task-table-row ${task.status==='完了'?'is-done':''}" type="button" role="row" data-action="task-edit" data-id="${esc(task.id)}" aria-label="${esc(task.name)}を編集">
        <span class="task-col task-category">${esc(task.category)}</span>
        <span class="task-col task-name">${esc(task.name)}</span>
        <span class="task-col"><span class="task-status ${taskStatusClass(task.status)}">${esc(task.status)}</span></span>
        <span class="task-col task-deadline">${esc(task.deadline)}</span><span class="task-col task-members">${task.members.length?esc(task.members.join(' ')):'—'}</span>
        <span class="task-col task-notes">${task.notes?esc(task.notes):'—'}</span></button>`).join('')}</div></div>
    </main>`;
  }
  function taskOption(value,selected){return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`;}
  function openTask(id=null){
    taskEditingId=id;
    const original=state.tasks.find(t=>t.id===id);
    const t=original || {category:TASK_CATEGORIES[0],name:'',status:TASK_STATUSES[0],deadline:localDate(),members:[],notes:''};
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay task-overlay" data-action="overlay"><section class="dialog task-dialog" role="dialog" aria-modal="true" aria-label="${original?'タスクを編集':'タスクを追加'}">
      <div class="dialog-head"><h2>${original?'タスクを編集':'タスクを追加'}</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div>
      <form id="task-form" class="task-form"><label>分類<select name="category">${TASK_CATEGORIES.map(x=>taskOption(x,t.category)).join('')}</select></label>
        <label>タスク名<input name="name" type="text" maxlength="200" required placeholder="タスク名を入力" value="${esc(t.name)}"></label>
        <label>ステータス<select name="status">${TASK_STATUSES.map(x=>taskOption(x,t.status)).join('')}</select></label>
        <label>期限<input name="deadline" type="date" required value="${esc(t.deadline)}"></label>
        <fieldset><legend>担当（複数選択可）</legend><div class="task-member-options">${TASK_MEMBERS.map(x=>`<label><input type="checkbox" name="members" value="${x}" ${t.members.includes(x)?'checked':''}><span>${x}</span></label>`).join('')}</div></fieldset>
        <label>備考<textarea name="notes" rows="4" maxlength="4000" placeholder="補足情報を入力">${esc(t.notes)}</textarea></label>
        <div class="task-form-actions">${original?`<button class="task-delete" type="button" data-action="task-delete" data-id="${esc(id)}">削除</button>`:''}<button class="task-cancel" type="button" data-action="close-dialog">キャンセル</button><button class="task-submit" type="submit">${original?'変更を保存':'追加する'}</button></div>
      </form></section></div>`;
    // スマートフォンで新規追加時にキーボードを自動表示しない。
  }
  function submitTask(form){
    const data=new FormData(form),name=String(data.get('name')||'').trim(),deadline=String(data.get('deadline')||'');
    if(!name){toast('タスク名を入力してください');return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)){toast('期限をカレンダーから選択してください');return;}
    const task={id:taskEditingId||guid(),category:TASK_CATEGORIES.includes(data.get('category'))?data.get('category'):TASK_CATEGORIES[0],name:name.slice(0,200),status:TASK_STATUSES.includes(data.get('status'))?data.get('status'):TASK_STATUSES[0],deadline,members:TASK_MEMBERS.filter(x=>data.getAll('members').includes(x)),notes:String(data.get('notes')||'').slice(0,4000)};
    const idx=state.tasks.findIndex(x=>x.id===task.id);if(idx>=0)state.tasks[idx]=task;else state.tasks.push(task);
    save();closeData();render();toast(idx>=0?'タスクを更新しました':'タスクを追加しました');
  }
  function slotIntro(kind){return `<div class="slot-utilities-strip"><button class="copy-button" data-action="copy-slot" data-kind="${kind}" aria-label="${kind==='practice'?'練習タイテ':'セトリ'}をコピー" title="コピー">${ico('copy')}</button></div>`;}
  function timebar(kind){
    const s=slot(kind),practice=kind==='practice';
    if(practice){
      const span=practiceSpan(s),left=span-sum('practice');
      return `<div class="timebar practice-timebar"><span id="remaining" class="remaining ${left<0?'negative':''}">残り ${left}分</span><span class="time-spacer"></span><div class="time-range" role="group" aria-label="練習時間帯"><label class="time-picker"><span class="time-value" id="practice-start-label">${esc(s.startTime)}</span><input type="time" id="practice-start" aria-label="練習開始時刻" value="${esc(s.startTime)}"></label><span>〜</span><label class="time-picker"><span class="time-value" id="practice-end-label">${esc(s.endTime)}</span><input type="time" id="practice-end" aria-label="練習終了時刻" value="${esc(s.endTime)}"></label></div></div>`;
    }
    const remaining=s.minutes*60-sum('setlist');
    return `<div class="timebar"><span id="remaining" class="remaining ${remaining<0?'negative':''}">残り ${time(remaining)}</span><span class="time-spacer"></span><label for="planned-minutes">持ち時間</label><input id="planned-minutes" type="number" min="0" max="999" inputmode="numeric" value="${s.minutes}" aria-label="持ち時間（分）"><span>分</span></div>`;
  }
  function setEntry(item,index){const song=songById.get(item.songId);if(!song)return '';
    return `<article class="draft-row ${song.tuning==='DADGAD'?'tuning-dadgad':song.tuning?'tuning-regular':'tuning-other'}" data-entry="${esc(item.id)}"><div class="draft-top"><button class="drag-handle" data-handle="true" aria-label="${esc(song.title)}をドラッグして並べ替え" title="ドラッグして並べ替え">⠿</button><span class="draft-index">${index+1}.</span><strong>${esc(song.title)}</strong><button class="remove" data-action="remove" data-kind="setlist" data-id="${esc(item.id)}" aria-label="${esc(song.title)}を削除">×</button></div><div class="draft-meta">${song.tuning?esc(song.tuning)+' · ':''}${song.capo==null?'Capoなし':'Capo '+song.capo} · ${time(song.durationSeconds)}${song.bpm?' · '+song.bpm+' BPM':''}</div></article>`;
  }
  function pickGroup(tuning,songs,extra=false){return `<section class="pick-group ${extra?'tuning-other':tuning==='DADGAD'?'tuning-dadgad':'tuning-regular'}"><h3>${esc(tuning)} <small>${songs.length}項目</small></h3>${songs.map(song=>`<button class="pick-row" data-action="add-song" data-id="${song.id}"><span><strong>${esc(song.title)}</strong><small>${extra?time(song.durationSeconds):`${song.capo==null?'Capoなし':'Capo '+song.capo} · ${time(song.durationSeconds)} · ${song.bpm} BPM`}</small></span><b>＋</b></button>`).join('')}</section>`;}
  function setlistPage(){const s=slot('setlist');return `${slotIntro('setlist')}${timebar('setlist')}
    <div class="columns"><section class="column"><header>SETLIST <span>${s.entries.length}項目 · 使用 ${time(sum('setlist'))}</span></header><div class="column-scroll" data-scroll="setDraft">${s.entries.length?s.entries.map(setEntry).join(''):''}</div></section><div class="vertical-rule"></div><section class="column"><header>持ち曲（タップで追加）</header><div class="column-scroll" data-scroll="setLibrary">${groupedSongs('capo').map(g=>pickGroup(g.tuning,g.songs)).join('')}${pickGroup('その他',KORYOSAN_EXTRA,true)}</div></section></div>`;}
  const optionsForMinutes=value=>Array.from({length:48},(_,i)=>5*(i+1)).map(v=>`<option value="${v}" ${v===value?'selected':''}>${v}分</option>`).join('');
  function practiceEntry(item,index,elapsed){const preset=practiceById.get(item.presetId);if(!preset)return '';
    const start=minutesOf(slot('practice').startTime)??0;
    return `<article class="draft-row practice-row" data-entry="${esc(item.id)}">
      <div class="draft-top"><button class="drag-handle" data-handle="true" aria-label="${esc(preset.title)}を並べ替え">⠿</button><span class="draft-index">${index+1}.</span><strong>${esc(preset.title)}</strong><span class="practice-slot-time" data-time-entry="${esc(item.id)}">${clockOf(start+elapsed)}〜${clockOf(start+elapsed+item.minutes)}</span><button class="remove" data-action="remove" data-kind="practice" data-id="${esc(item.id)}" aria-label="削除">×</button></div>
      <div class="practice-edit"><select aria-label="${esc(preset.title)}の継続時間" data-select="entry-minutes" data-id="${esc(item.id)}">${optionsForMinutes(item.minutes)}</select><textarea aria-label="${esc(preset.title)}の備考" rows="1" maxlength="3000" data-input="note" data-id="${esc(item.id)}" placeholder="備考">${esc(item.note)}</textarea></div>
    </article>`;
  }
  function practiceEntries(entries){let elapsed=0;return entries.map((item,i)=>{const row=practiceEntry(item,i,elapsed);elapsed+=item.minutes;return row;}).join('');}
  function practicePage(){const s=slot('practice');return `${slotIntro('practice')}${timebar('practice')}
    <div class="columns practice-columns"><section class="column"><header>タイムテーブル <span>${s.entries.length} · ${sum('practice')}分</span></header><div class="column-scroll" data-scroll="practiceDraft">${practiceEntries(s.entries)}</div></section><div class="vertical-rule"></div><section class="column"><header>メニュー</header><div class="column-scroll practice-menu" data-scroll="practiceLibrary">${KORYOSAN_PRACTICE.map(item=>`<button class="pick-row practice-pick" data-action="add-practice" data-id="${item.id}"><span><strong>${esc(item.title)}</strong><small>${item.minutes}分</small></span><b>＋</b></button>`).join('')}</div></section></div>`;}
  function render(){storeScroll();window.KoryoMetronome?.unmount();
    $app.innerHTML=`${header()}<div class="app-content">${page==='tasks'?tasksPage():page==='songs'?songsPage():page==='detail'?detailsPage():page==='setlist'?setlistPage():page==='practice'?practicePage():'<div id="metronome-root"></div>'}</div>${tabs()}`;
    restoreScroll();if(page==='metronome')window.KoryoMetronome?.mount(document.getElementById('metronome-root'));
    document.title=`校了さん${page==='detail'?'｜楽譜・詳細':''}`;
  }
  function updateTime(){
    const el=document.getElementById('remaining');if(!el)return;
    const isPractice=page==='practice',kind=isPractice?'practice':'setlist',s=slot(kind),used=sum(kind);
    const remain=isPractice?practiceSpan(s)-used:s.minutes*60-used;
    el.textContent=isPractice?`残り ${remain}分`:'残り '+time(remain);el.classList.toggle('negative',remain<0);
    const heading=document.querySelector('.column:first-child header span');if(heading)heading.textContent=isPractice?`${s.entries.length} · ${used}分`:`${s.entries.length}項目 · 使用 ${time(used)}`;
    if(isPractice){let elapsed=0;const start=minutesOf(s.startTime)??0;
      for(const item of s.entries){const label=[...document.querySelectorAll('[data-time-entry]')].find(el=>el.dataset.timeEntry===item.id);if(label)label.textContent=`${clockOf(start+elapsed)}〜${clockOf(start+elapsed+item.minutes)}`;elapsed+=item.minutes;}
    }
  }
  function moveEntry(kind,id,targetId){const list=slot(kind).entries;const from=list.findIndex(e=>e.id===id),to=list.findIndex(e=>e.id===targetId);if(from<0||to<0||from===to)return;const [entry]=list.splice(from,1);list.splice(to,0,entry);save();render();}
  function openData(){modalOpen=true;$modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-label="データのバックアップ"><div class="dialog-head"><h2>データのバックアップ</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><p>タスク、曲詳細の追記メモ、3つの練習タイテ、3つのセトリ、メトロノーム設定をまとめて保存・復元できます。</p><div class="dialog-actions"><button data-action="logout" class="logout-action">ログアウト</button><button data-action="clear-legacy" title="旧版端末データを削除">旧版データ削除</button><button data-action="export-data">${ico('archive')} バックアップを保存</button><button data-action="import-data">バックアップを読み込む</button><input type="file" id="backup-input" accept=".json,application/json" hidden></div><p class="fineprint">復元した内容は共有Firebaseへ反映され、他メンバーにも影響します。旧版の端末データは移行されずに保存領域へ残ります。バックアップを取ってから削除してください。</p></section></div>`;}
  function closeData(){modalOpen=false;$modal.innerHTML='';setTimeout(flushRemote,0);}
  function downloadBackup(){const obj={app:'Koryosan_PWA',version:5,exportedAt:new Date().toISOString(),state,metronome:window.KoryoMetronome?.snapshot()};const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='koryosan-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('バックアップを保存しました');}
  async function readBackup(file){if(!file)return;if(file.size>8*1024*1024){toast('8MB以下のファイルを指定してください');return;}try{
      const obj=JSON.parse(await file.text());if(obj.app!=='Koryosan_PWA'||!obj.state)throw Error('校了さん用のバックアップを選んでください');
      const nextState=validate(obj.state);if(!confirm('このバックアップの内容を3人の共有データベースに反映します。既存の項目を上書き・削除する可能性があります。実行しますか？'))return;
      if(obj.metronome)window.KoryoMetronome?.restore(obj.metronome);
      state=nextState;save();closeData();render();toast('バックアップを読み込みました');
    }catch(e){console.error(e);alert('読み込めませんでした：'+e.message);}}
  function slotText(kind){
    const s=slot(kind);
    if(kind==='practice')return ['＝＝＝＝＝＝＝',s.name,`練習時間 ${s.startTime}〜${s.endTime}`,`合計 ${sum('practice')}分`,'',...s.entries.map((e,i)=>{const p=practiceById.get(e.presetId);return `${i+1}. ${p.title}　${e.minutes}分${e.note?'\n   '+e.note:''}`;}),'＝＝＝＝＝＝＝'].join('\n');
    let count=0;
    return ['＝＝＝＝＝＝＝',s.name,'',...s.entries.map(entry=>{
      const song=songById.get(entry.songId);if(!song)return '';
      if(!song.tuning)return song.title;
      count++;
      return `${count}. ${song.title}　${song.capo===null?'Capoなし':'Capo'+song.capo}　${song.tuning}　${song.bpm} BPM　${time(song.durationSeconds)}`;
    }),'＝＝＝＝＝＝＝'].join('\n');
  }
  async function copySlot(kind){
    const txt=slotText(kind);
    try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(txt);toast('コピーしました');}
    catch(_){const t=document.createElement('textarea');t.value=txt;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'コピーしました':'コピーできませんでした');}
  }
  function openSlotRename(kind,i){
    const items=kind==='practice'?state.practiceSlots:state.setlistSlots,s=items[i];if(!s)return;
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-label="スロット名変更"><div class="dialog-head"><h2>スロット名</h2><button type="button" data-action="close-dialog" aria-label="閉じる">×</button></div>
    <form class="task-form" id="slot-rename-form"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="index" value="${i}"><label>名称<input name="name" type="text" maxlength="40" required value="${esc(s.name)}"></label><div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">保存</button></div></form></section></div>`;
  }
  function submitSlotRename(form){
    const data=new FormData(form),kind=data.get('kind'),index=Number(data.get('index')),name=String(data.get('name')||'').trim().slice(0,40);
    if(!['practice','setlist'].includes(kind)||!Number.isInteger(index)||index<0||index>=3||!name)return;
    (kind==='practice'?state.practiceSlots:state.setlistSlots)[index].name=name;save();closeData();render();
  }
  function action(el){const what=el.dataset.action;
    if(what==='tab'){page=el.dataset.page;detailSong=null;render();return;}
    if(what==='detail'){scrollPos.detail=0;scrollPos.detailX=0;detailSong=el.dataset.song;page='detail';render();return;}
    if(what==='detail-back'){page='songs';detailSong=null;render();return;}
    if(what==='detail-edit'){openDetailEdit(Number(el.dataset.row),Number(el.dataset.column));return;}
    if(what==='detail-add-column'){addDetailColumn();return;}
    if(what==='detail-rename-column'){openColumnRename(Number(el.dataset.column));return;}
    if(what==='task-add'){openTask();return;}
    if(what==='task-sort'){state.taskSort=el.dataset.sort==='member'?'member':'deadline';save();render();return;}
    if(what==='task-toggle-completed'){state.showCompleted=!state.showCompleted;save();render();return;}
    if(what==='task-edit'){openTask(el.dataset.id);return;}
    if(what==='task-delete'){const id=el.dataset.id;const task=state.tasks.find(t=>t.id===id);if(!task||!confirm(`「${task.name}」を削除しますか？`))return;state.tasks=state.tasks.filter(t=>t.id!==id);save();closeData();render();toast('タスクを削除しました');return;}
    if(what==='sort'){state.sort=el.dataset.sort;save();render();return;}
    if(what==='slot-rename'){openSlotRename(el.dataset.kind,Number(el.dataset.index));return;}
    if(what==='slot'){const idx=Number(el.dataset.index);if(idx<0||idx>=SLOTS)return;if(el.dataset.kind==='practice')state.activePractice=idx;else state.activeSetlist=idx;save();render();return;}
    if(what==='add-song'){if(!songById.has(el.dataset.id))return;slot('setlist').entries.push({id:guid(),songId:el.dataset.id});save();render();return;}
    if(what==='add-practice'){const item=practiceById.get(el.dataset.id);if(!item)return;slot('practice').entries.push({id:guid(),presetId:item.id,minutes:item.minutes,note:''});save();render();return;}
    if(what==='remove'){const kind=el.dataset.kind;const s=slot(kind);s.entries=s.entries.filter(e=>e.id!==el.dataset.id);save();render();return;}
    if(what==='copy-slot'){void copySlot(el.dataset.kind);return;}
    if(what==='data'){openData();return;}
    if(what==='close-dialog'){closeData();return;}
    if(what==='overlay'){closeData();return;}
    if(what==='logout'){if(confirm('ログアウトしますか？'))void window.KoryoCloud.logout();return;}
    if(what==='clear-legacy'){if(confirm('旧版の端末内保存データを削除しますか？ まだFirebaseに移していないタスクやメモがある場合は、先に旧版のバックアップを確認してください。')){try{localStorage.removeItem('koryosan.app.v1');toast('旧版の端末内保存データを削除しました');}catch(e){toast('削除できませんでした');}}return;}
    if(what==='export-data'){downloadBackup();return;}
    if(what==='import-data'){document.getElementById('backup-input')?.click();return;}
  }
  // All event handlers are delegated because screen DOM is replaced on tab switches.
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn||btn.disabled)return;if(btn.dataset.action==='overlay'&&e.target!==btn)return;action(btn);});
  document.addEventListener('submit',e=>{if(e.target.id==='task-form'){e.preventDefault();submitTask(e.target);}else if(e.target.id==='detail-edit-form'){e.preventDefault();submitDetailEdit(e.target);}else if(e.target.id==='detail-rename-form'){e.preventDefault();submitColumnRename(e.target);}else if(e.target.id==='slot-rename-form'){e.preventDefault();submitSlotRename(e.target);}});
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.dataset.input==='note'){const entry=slot('practice').entries.find(x=>x.id===el.dataset.id);if(entry){entry.note=el.value.slice(0,3000);save();}return;}
    if(el.id==='planned-minutes'){const num=Number(el.value);if(el.value!==''&&Number.isInteger(num)&&num>=0&&num<=999){slot(page==='practice'?'practice':'setlist').minutes=num;save();updateTime();}}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.select==='entry-minutes'){const entry=slot('practice').entries.find(x=>x.id===el.dataset.id);const n=Number(el.value);if(entry&&Number.isInteger(n)&&n>=5&&n<=240&&n%5===0){entry.minutes=n;save();updateTime();}return;}
    if(['practice-start','practice-end'].includes(el.id)){
      const n=minutesOf(el.value);if(n===null){el.value=slot('practice')[el.id==='practice-start'?'startTime':'endTime'];return;}
      slot('practice')[el.id==='practice-start'?'startTime':'endTime']=el.value;const label=document.getElementById(el.id+'-label');if(label)label.textContent=el.value;save();updateTime();return;
    }
    if(el.id==='planned-minutes'){el.value=slot('setlist').minutes;return;}
    if(el.id==='backup-input'){void readBackup(el.files?.[0]);el.value='';}
  });
  document.addEventListener('focusout',e=>{if(e.target.id==='planned-minutes')e.target.value=slot('setlist').minutes;setTimeout(flushRemote,0);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen)closeData();if(e.key==='Enter'&&e.target.id==='planned-minutes')e.target.blur();});
  // Drag handles work with touch and mouse; prevents accidental scroll only during the drag.
  document.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-handle]');if(!handle||!['setlist','practice'].includes(page)||e.button!==0)return;
    const row=handle.closest('[data-entry]');if(!row)return;
    dragging={id:row.dataset.entry,kind:page,pointerId:e.pointerId,fromY:e.clientY,target:null,started:false,handle};
    try{handle.setPointerCapture(e.pointerId);}catch(_){}
  });
  document.addEventListener('pointermove',e=>{
    if(!dragging||dragging.pointerId!==e.pointerId)return;
    if(!dragging.started&&Math.abs(e.clientY-dragging.fromY)<7)return;dragging.started=true;
    document.querySelectorAll('.drag-target,.drag-source').forEach(n=>n.classList.remove('drag-target','drag-source'));
    const rows=[...document.querySelectorAll('.column:first-child [data-entry]')];
    const source=rows.find(n=>n.dataset.entry===dragging.id);source?.classList.add('drag-source');
    let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-entry]');
    if(!target||!rows.includes(target))target=rows.find(n=>e.clientY<n.getBoundingClientRect().bottom)||rows.at(-1);
    if(target&&target.dataset.entry!==dragging.id){dragging.target=target.dataset.entry;target.classList.add('drag-target');}
  });
  function pointerFinish(e){if(!dragging||dragging.pointerId!==e.pointerId)return;const d=dragging;dragging=null;try{d.handle.releasePointerCapture(e.pointerId);}catch(_){}document.querySelectorAll('.drag-target,.drag-source').forEach(n=>n.classList.remove('drag-target','drag-source'));if(d.started&&d.target)moveEntry(d.kind,d.id,d.target);}
  document.addEventListener('pointerup',pointerFinish);document.addEventListener('pointercancel',pointerFinish);
  render();
  if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('オフライン設定:',e)));
  }
})();
