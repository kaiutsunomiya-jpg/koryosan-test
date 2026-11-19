'use strict';
/* Firebase JSON と画面状態の相互変換。通信や個人情報を保持しない純粋関数。 */
(function(g){
 const ids=['slot1','slot2','slot3'];
 const sourceObj=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
 const sortedValues=(node,sort='order')=>Object.values(sourceObj(node)).sort((a,b)=>(Number(a?.[sort])||0)-(Number(b?.[sort])||0));
 const sections=blob=>{
   const result={};
   for(const [id,entries] of Object.entries(sourceObj(blob))){
     result[id]=sortedValues(entries).map(e=>({section:String(e.section??''),lyrics:String(e.lyrics??''),note:''}));
   }
   return result;
 };
 const songs=blob=>Object.entries(sourceObj(blob)).map(([id,x])=>({id,title:String(x?.title??''),tuning:String(x?.tuning??''),capo:x?.capo??null,durationSeconds:Number(x?.durationSeconds||0),bpm:x?.bpm??null})).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
 const songNotes=(data, details)=>{
   const out={};
   for(const [songId, block] of Object.entries(sourceObj(data))){
     const sorted=Object.entries(sourceObj(block?.columns)).sort((a,b)=>Number(a[1]?.order||0)-Number(b[1]?.order||0));
     const columnIds=sorted.map(([key])=>key);
     const columns=sorted.map(([,x])=>String(x?.title||'追記メモ'));
     if(!columns.length){columnIds.push('memo1');columns.push('追記メモ 1');}
     const cells={};
     const n=details[songId]?.length||0;
     for(let i=0;i<n;i++){
       const cell=sourceObj(block?.cells?.[`s${String(i+1).padStart(2,'0')}`]);
       const vals=columnIds.map(col=>typeof cell[col]==='string'?cell[col]:'');
       if(vals.some(v=>v))cells[i]=vals;
     }
     out[songId]={columns,columnIds,cells};
   }
   return out;
 };
 const taskArray=blob=>Object.entries(sourceObj(blob)).map(([id,t])=>({...sourceObj(t),id}));
 const slotArray=(blob,type)=>ids.map((id,i)=>{
   const row=sourceObj(blob?.[id]);
   const entries=Object.entries(sourceObj(row.entries)).map(([key,e])=>({id:key,...sourceObj(e)})).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.id.localeCompare(b.id));
   const basic={name:String(row.name||`${type==='practice'?'練習':'セトリ'} ${i+1}`),minutes:Number.isInteger(row.minutes)?row.minutes:(type==='practice'?120:30),entries};
   return type==='practice'?{...basic,startTime:String(row.startTime||'18:00'),endTime:String(row.endTime||'20:00')}:basic;
 });
 const convert=(root)=>{
   const data=sourceObj(root),detailMap=sections(data.songSections);
   return {songs:songs(data.songs),details:detailMap,extras:songs(data.setlistExtras),practice: Object.entries(sourceObj(data.practicePresets)).map(([id,x])=>({id,title:String(x.title),minutes:Number(x.minutes)})),state:{
       version:4,tasks:taskArray(data.tasks),detailEdits:songNotes(data.songNotes,detailMap),
       setlistSlots:slotArray(data.setlistSlots,'setlist'),practiceSlots:slotArray(data.practiceSlots,'practice')
     }};
 };
 const diff=(previous,next)=>{
   const changes=[]; // {path, value}; value=null means delete
   const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
   const put=(path,value)=>{
     if(path.split('/').some(component=>/^[.#$\[\]]/.test(component)||/[.#$\[\]\/]/.test(component)))throw Error('書き込み先に不正なキーが含まれています');
     changes.push({path,value});
   };
   const byId=arr=>Object.fromEntries((arr||[]).map(x=>[x.id,x]));
   function compareChildren(base,oldMap,newMap,strip=[]){
     for(const key of new Set([...Object.keys(oldMap),...Object.keys(newMap)])){
       const o=oldMap[key],n=newMap[key],path=`${base}/${key}`;
       if(!n){put(path,null);continue;}
       if(!o){put(path,n);continue;}
       const keys=new Set([...Object.keys(o),...Object.keys(n)]);
       for(const field of keys){if(strip.includes(field))continue;if(!equal(o[field],n[field]))put(`${path}/${field}`,n[field]===undefined?null:n[field]);}
     }
   }
   compareChildren('tasks',byId(previous.tasks),byId(next.tasks));
   for(const kind of ['practice','setlist']){
     const key=kind+'Slots';
     for(let i=0;i<3;i++){
       const o=previous[key]?.[i]||{},n=next[key]?.[i]||{},base=`${key}/slot${i+1}`;
       for(const f of kind==='practice'?['name','minutes','startTime','endTime']:['name','minutes']){
         if(!equal(o[f],n[f]))put(`${base}/${f}`,n[f]);
       }
       const withOrder=(xs)=>byId((xs||[]).map((e,i)=>({...e,order:i})));
       compareChildren(`${base}/entries`,withOrder(o.entries),withOrder(n.entries));
     }
   }
   // 追記欄：列を一意のIDで保持し、異なるセルの変更が衝突しないようにする。
   for(const songId of new Set([...Object.keys(previous.detailEdits||{}),...Object.keys(next.detailEdits||{})])){
     const o=previous.detailEdits?.[songId]||{columns:[],columnIds:[],cells:{}};
     const n=next.detailEdits?.[songId]||{columns:[],columnIds:[],cells:{}};
     const cols=entry=>Object.fromEntries((entry.columnIds||[]).map((id,i)=>[id,{title:entry.columns[i],order:i}]));
     compareChildren(`songNotes/${songId}/columns`,cols(o),cols(n));
     const rowKey=i=>`s${String(Number(i)+1).padStart(2,'0')}`;
     const cellValues=entry=>{
       const out={};for(const [row,values] of Object.entries(entry.cells||{})){
         for(let i=0;i<(entry.columnIds||[]).length;i++){
           const colId=entry.columnIds[i],content=values[i]||'';
           if(content)out[`${rowKey(row)}/${colId}`]=content;
         }
       }return out;
     };
     const a=cellValues(o),b=cellValues(n);
     for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(!equal(a[key],b[key]))put(`songNotes/${songId}/cells/${key}`,b[key]??null);
   }
   return changes;
 };
 g.KoryoCloudModel={convert,sections,songs,songNotes,taskArray,slotArray,diff};
})(window);
