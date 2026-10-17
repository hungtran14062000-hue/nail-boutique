'use strict';
const $ = id => document.getElementById(id);
let state = {employees: [], shifts: []}, page = 'clock';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localInput = d => `${localDate(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const fmt = d => new Date(d).toLocaleString(getLocale(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const duration = s => Math.max(0,Math.floor((new Date(s.end)-new Date(s.start))/60000)-Number(s.break||0));
const hours = m => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
const euros = cents => new Intl.NumberFormat(getLocale(),{style:'currency',currency:'EUR'}).format(cents/100);
const active = id => state.shifts.find(s => s.employee===id && !s.end);
const employeeName = id => state.employees.find(e=>e.id===id)?.name || 'Nhân viên';
function toast(message) { $('toast').textContent=message; $('toast').style.display='block'; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').style.display='none',3500); }
const now = new Date(); $('from').value=localDate(new Date(now.getFullYear(),now.getMonth(),1)); $('to').value=localDate(now);
function filtered() { return state.shifts.filter(s=> { const day=localDate(new Date(s.start)); return day >= $('from').value && day <= $('to').value; }).sort((a,b)=>new Date(b.start)-new Date(a.start)); }
function render() {
  const reportStaff=state.employees.filter(e=>!e.deleted);
  const reportIds=new Set(reportStaff.map(e=>e.id));
  $('today').textContent=new Date().toLocaleDateString(getLocale(),{weekday:'long',day:'numeric',month:'long'});
  $('activeCount').textContent=state.shifts.filter(s=>!s.end).length;
  $('staffCount').textContent=state.employees.filter(e=>!e.deleted).length; $('teamCount').textContent=state.employees.filter(e=>!e.deleted).length;
  $('hoursToday').textContent=hours(state.shifts.filter(s=>s.end&&localDate(new Date(s.start))===localDate(new Date())).reduce((n,s)=>n+duration(s),0));
  $('staff').innerHTML=state.employees.length ? state.employees.filter(e=>!e.deleted).map(e=>{ const s=active(e.id); return `<article class="staff-card"><div class="staff-top"><div class="avatar">${esc(Array.from(e.name)[0].toUpperCase())}</div><div><div class="staff-name">${esc(e.name)}</div><div class="role">${esc(e.role||'Nhân viên')}</div></div></div><div class="badge ${s?'on':''}">${s?'● Đang trong ca':'○ Chưa vào ca'}</div><div class="shift-time">${s?`Vào ca lúc ${esc(fmt(s.start))}`:'Sẵn sàng cho một ca làm mới'}</div><button class="${s?'outline':'primary'} clock-button" ${currentUser?.role!=='manager'?'hidden':' '} data-clock="${esc(e.id)}">${s?'↗ Ra ca':'→ Vào ca'}</button></article>`; }).join('') : '<div class="empty"><div class="symbol">✧</div><h3>Bắt đầu với đội ngũ của bạn</h3><p>Thêm nhân viên đầu tiên để ghi nhận ca làm hôm nay.</p><button class="primary" data-add>+ Thêm nhân viên</button></div>';
  const rows=filtered();
  $('history').innerHTML=rows.length ? `<div class="table-wrap"><table><thead><tr><th>NHÂN VIÊN</th><th>VÀO CA</th><th>RA CA</th><th>NGHỈ</th><th>GIỜ LÀM</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(employeeName(s.employee))}</td><td>${esc(fmt(s.start))}</td><td>${s.end?esc(fmt(s.end)):'<span class="badge on">Đang làm</span>'}</td><td>${Number(s.break)} phút</td><td>${s.end?hours(duration(s)):'—'}</td><td>${s.end&&currentUser?.role==='manager'?`<button class="outline" data-edit="${esc(s.id)}">Sửa ca</button>`:''}${currentUser?.role==='manager'?` <button class="outline" data-delete-shift="${esc(s.id)}">Xóa ca</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><h3>Chưa có ca trong khoảng ngày này</h3><p>Chọn khoảng ngày khác hoặc thêm một ca đã làm.</p></div>';
  const done=rows.filter(s=>s.end&&reportIds.has(s.employee)); $('reportTotal').textContent=hours(done.reduce((n,s)=>n+duration(s),0)); $('reportRange').textContent=`${$('from').value} → ${$('to').value} · ${done.length} ca đã kết thúc`;
  $('wageTotal').textContent=euros(done.reduce((n,s)=>n+(s.payCents??0),0));
  const missing=done.filter(s=>s.payCents==null).length;
  $('wageMissing').textContent=missing?`${missing} ca chưa đặt lương, chưa tính vào tổng tiền.`:'';
  $('reports').innerHTML=reportStaff.length ? `<div class="table-wrap"><table><thead><tr><th>NHÂN VIÊN</th><th>SỐ CA</th><th>GIỜ LÀM</th><th>LƯƠNG GIỜ HIỆN TẠI</th><th>TIỀN CÔNG ƯỚC TÍNH</th><th></th></tr></thead><tbody>${reportStaff.map(e=>{const ss=done.filter(s=>s.employee===e.id);return `<tr><td>${esc(e.name)}</td><td>${ss.length}</td><td>${hours(ss.reduce((n,s)=>n+duration(s),0))}</td><td>${e.rateCents==null?'Chưa đặt lương':euros(e.rateCents)+'/h'}</td><td>${ss.some(s=>s.payCents==null)?'Chưa đủ dữ liệu':euros(ss.reduce((n,s)=>n+(s.payCents??0),0))}</td><td>${currentUser?.role==='manager'?`<button class="outline" data-rate="${esc(e.id)}">Đặt lương</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty"><p>Thêm nhân viên để bắt đầu báo cáo.</p></div>';
}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{
  if(['orders','employees'].includes(button.dataset.page)&&currentUser?.role!=='manager')return;
  page=button.dataset.page;
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b===button));
  for(const [name,id] of Object.entries({clock:'clockPage',shifts:'historyPage',reports:'reportPage',orders:'ordersPage',employees:'employeesPage',profile:'profilePage'}))$(id).hidden=page!==name;
  $('crumb').textContent=button.querySelector('span').textContent;
  $('title').textContent={clock:'Một ngày làm việc thật đẹp.',shifts:'Mỗi ca làm, một bản ghi.',reports:'Giờ làm rõ ràng, đội ngũ an tâm.',orders:'Đơn khách & doanh thu',employees:'Quản lý nhân viên',profile:'Tài khoản của tôi'}[page];
  $('description').textContent={clock:'Theo dõi ca làm của đội ngũ, ngay tại một nơi.',shifts:'Xem lại, bổ sung và chỉnh sửa những ca đã làm.',reports:'Tổng hợp thời gian thực làm cho từng nhân viên.',orders:'Theo dõi các khoản khách đã thanh toán.',employees:'Chỉ quản lý được chấm công. Nhân viên xem ca và lương của mình.',profile:'Tên, ảnh đại diện và thông tin liên hệ của bạn.'}[page];
  render();
  if(page==='orders')loadOrders();
  if(page==='employees')loadEmployees();
  if(page==='profile')loadMyProfile().catch(e=>toast(e.message));
}));
$('addEmployee').onclick=()=>$('employeeDialog').showModal();
$('staff').addEventListener('click',async event=>{if(event.target.closest('[data-add]'))return $('employeeDialog').showModal();const button=event.target.closest('[data-clock]');if(!button)return;const id=button.dataset.clock,s=active(id);if(s){$('confirmText').textContent=employeeName(id)+' · Vào ca '+fmt(s.start);const d=$('confirmDialog');d.returnValue='';d.showModal();const result=await new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue),{once:true}));if(result!=='ok')return;}button.disabled=true;try{await api('clock',{employee:id,action:s?'out':'in'});await refreshState();toast(s?'Đã ghi nhận ra ca':'Đã ghi nhận vào ca');}catch(e){toast(e.message);button.disabled=false;}});
$('employeeForm').onsubmit=async event=>{event.preventDefault();const f=event.target,button=f.querySelector('button.primary');button.disabled=true;$('employeeError').textContent='';try{await api('users',{name:f.elements.name.value.trim(),username:f.elements.username.value,password:f.elements.password.value,job:f.elements.role.value.trim(),phone:internationalPhone(f)});f.reset();$('employeeDialog').close();await refreshState();toast('Đã tạo tài khoản nhân viên');}catch(e){$('employeeError').textContent=e.message;}finally{button.disabled=false;}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function openShift(id) { if(!state.employees.length){toast('Thêm nhân viên trước khi tạo ca');return;} const s=state.shifts.find(s=>s.id===id),form=$('shiftForm'); form.reset(); $('shiftError').textContent=''; form.elements.id.value=s?.id||''; form.elements.employee.innerHTML=state.employees.filter(e=>!e.deleted).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');form.elements.employee.value=s?.employee||state.employees[0].id; form.elements.start.value=localInput(s?new Date(s.start):new Date(Date.now()-8*3600000));form.elements.end.value=localInput(s?new Date(s.end):new Date());form.elements.break.value=s?.break||0;$('shiftTitle').textContent=s?'Chỉnh sửa ca':'Thêm ca đã làm';$('shiftDialog').showModal(); }
$('addShift').onclick=()=>openShift(); $('history').onclick=async e=>{const remove=e.target.closest('[data-delete-shift]');if(remove){if(!confirm(translateText('Xóa ca này? Tổng giờ và tiền công sẽ được tính lại.')))return;remove.disabled=true;try{await api('delete',{type:'shift',id:remove.dataset.deleteShift});await refreshState();toast('Đã xóa');}catch(error){toast(error.message);remove.disabled=false;}return;}const button=e.target.closest('[data-edit]');if(button)openShift(button.dataset.edit);};
$('shiftForm').onsubmit=async event=>{event.preventDefault();const f=event.target,button=f.querySelector('button.primary');button.disabled=true;try{await api('shifts',{id:f.elements.id.value,employee:f.elements.employee.value,start:new Date(f.elements.start.value).toISOString(),end:new Date(f.elements.end.value).toISOString(),break:Number(f.elements.break.value)});$('shiftDialog').close();await refreshState();toast('Đã lưu ca');}catch(e){$('shiftError').textContent=e.message;}finally{button.disabled=false;}};
['from','to'].forEach(id=>$(id).onchange=()=>{ if($('from').value>$('to').value){toast('Ngày bắt đầu phải trước ngày kết thúc');$(id).value=id==='from'?$('to').value:$('from').value;}render();});
function exportCSV(){const cell=v=>'"'+String(v).replace(/^[=+@\-]/,"'").replace(/"/g,'""')+'"';const rows=[['Nhân viên','Vào ca','Ra ca','Nghỉ (phút)','Giờ làm (phút)'],...filtered().map(s=>[employeeName(s.employee),fmt(s.start),s.end?fmt(s.end):'Đang làm',s.break,s.end?duration(s):''])];const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map((row,i)=>row.map((v,j)=>cell(i===0||(j===2&&v==='Đang làm')?translateText(v):v)).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`nail-boutique-${$('from').value}-${$('to').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=exportCSV; $('reportExport').onclick=exportCSV;
render();





