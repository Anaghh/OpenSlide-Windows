'use strict';
(() => {
  const picker = document.querySelector('#date-picker');
  const grid = document.querySelector('#picker-grid');
  let target, month, chosen;
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const now = () => key(new Date());
  function render(focusDay) {
    document.querySelector('#picker-month').textContent = month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const year=month.getFullYear(), m=month.getMonth(), cells=[];
    for(let n=0;n<month.getDay();n++){const empty=document.createElement('span');empty.setAttribute('aria-hidden','true');cells.push(empty);}
    for(let n=1;n<=new Date(year,m+1,0).getDate();n++){
      const day=key(new Date(year,m,n)), b=document.createElement('button');
      b.type='button';b.dataset.date=day;b.textContent=n;
      b.className=(day===chosen?'selected ':'')+(day===now()?'today':'');
      b.setAttribute('aria-label',new Date(year,m,n).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
      b.setAttribute('aria-pressed',String(day===chosen));cells.push(b);
    }
    grid.replaceChildren(...cells);
    if(focusDay) grid.querySelector(`[data-date="${focusDay}"]`)?.focus();
  }
  function open(input) {
    target=input;chosen=input.value || (input.id === 'reminder-day' ? document.querySelector('#edit-day')?.value : '') || now();
    const date=new Date(chosen+'T12:00:00');month=new Date(date.getFullYear(),date.getMonth(),1);
    document.querySelector('#picker-title').textContent=input.id==='reminder-day'?'Reminder day':'Choose a day';
    render();picker.showModal();
    grid.querySelector(`[data-date="${chosen}"]`)?.focus();
    window.openslide?.request('editing',true);
  }
  function choose(day){target.value=day;target.dispatchEvent(new Event('change',{bubbles:true}));picker.close();}
  document.addEventListener('click',e=>{const input=e.target.closest('[data-date-picker]');if(input)open(input);});
  document.addEventListener('keydown',e=>{if(e.target.matches('[data-date-picker]') && ['Enter',' '].includes(e.key)){e.preventDefault();open(e.target);}});
  grid.onclick=e=>{const b=e.target.closest('[data-date]');if(b)choose(b.dataset.date);};
  grid.onkeydown=e=>{
    const day=e.target.dataset.date;if(!day)return;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(delta===undefined)return;
    e.preventDefault();const date=new Date(day+'T12:00:00');date.setDate(date.getDate()+delta);
    month=new Date(date.getFullYear(),date.getMonth(),1);render(key(date));
  };
  document.querySelector('#picker-prev').onclick=()=>{month.setMonth(month.getMonth()-1);render();};
  document.querySelector('#picker-next').onclick=()=>{month.setMonth(month.getMonth()+1);render();};
  document.querySelector('#picker-today').onclick=()=>choose(now());
  document.querySelector('#picker-close').onclick=document.querySelector('#picker-cancel').onclick=()=>picker.close();
  picker.addEventListener('close',()=>{target?.focus();window.openslide?.request('editing',!!document.querySelector('dialog[open]'));});
})();
