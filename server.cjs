'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {createProfiles,resendEmail}=require('./profiles.cjs');
function createApp({dbPath=process.env.DB_PATH||path.join(__dirname,'data','nail.sqlite'),publicOrigin=process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL,setupKey=process.env.SETUP_KEY,secureCookies=process.env.NODE_ENV==='production',managerAccounts=[],requireContactVerification=true,emailSender=(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM?resendEmail:null)}={}) {
  if(secureCookies&&(!publicOrigin||!publicOrigin.startsWith('https://')||!setupKey||setupKey.length<24))throw Error('Production requires HTTPS PUBLIC_ORIGIN (or RENDER_EXTERNAL_URL) and a SETUP_KEY of at least 24 characters');
  if(publicOrigin)publicOrigin=new URL(publicOrigin).origin;
  fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const db=new DatabaseSync(dbPath); db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('manager','employee')),job TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,employee TEXT NOT NULL REFERENCES users(id),start TEXT NOT NULL,end TEXT,break INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_shift ON shifts(employee) WHERE end IS NULL;
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pay_rates(id INTEGER PRIMARY KEY,employee TEXT NOT NULL REFERENCES users(id),cents INTEGER NOT NULL CHECK(cents>=0),effective TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS account_approvals(user TEXT PRIMARY KEY REFERENCES users(id),approved INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS customer_orders(id TEXT PRIMARY KEY,customer TEXT NOT NULL,employee TEXT NOT NULL REFERENCES users(id),paid_date TEXT NOT NULL,cents INTEGER NOT NULL CHECK(cents>=0),created_by TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS account_controls(user TEXT PRIMARY KEY REFERENCES users(id),blocked INTEGER NOT NULL DEFAULT 0);`);
  const attempts=new Map();
  const hash=p=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');};
  const verify=(p,h)=>{const [salt,v]=h.split(':');const a=scryptSync(p,salt,64),b=Buffer.from(v,'hex');return a.length===b.length&&timingSafeEqual(a,b);};
  const tokenHash=t=>createHash('sha256').update(t).digest('hex');
  const fail=(status,message)=>{const e=Error(message);e.status=status;throw e;};
  const cleanUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,job:u.job});
  const validateUser=b=>{const username=String(b.username||'').trim().toLowerCase(),name=String(b.name||'').trim(),password=String(b.password||''); if(!/^[a-z0-9._-]{3,40}$/.test(username)||name.length<1||name.length>80||password.length<10||password.length>128)fail(400,'Tên đăng nhập 3–40 ký tự (chữ không dấu, số, . _ -), tên không quá 80 ký tự và mật khẩu ít nhất 10 ký tự.');return {username,name,password,...profiles.validate(b)};};
  const audit=(actor,action,target)=>db.prepare('INSERT INTO audit(actor,action,target,at) VALUES(?,?,?,?)').run(actor,action,target,new Date().toISOString());
  const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const profiles=createProfiles({db,fail,audit,required:requireContactVerification,sendEmail:emailSender,origin:()=>publicOrigin||'http://localhost:'+server.address().port});
  async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>(req.url==='/api/profile'?220000:16000))fail(413,'Yêu cầu quá lớn');}try{return JSON.parse(text||'{}');}catch{fail(400,'Dữ liệu không hợp lệ');}}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      if(req.method==='GET'&&req.url==='/health')return reply(res,200,{ok:true});
      const expected=publicOrigin||`http://127.0.0.1:${server.address().port}`,alternative=publicOrigin||`http://localhost:${server.address().port}`;
      if(![new URL(expected).host,new URL(alternative).host].includes(req.headers.host))fail(403,'Địa chỉ truy cập không được phép');
      const pathname=new URL(req.url,expected).pathname;
      if(pathname.startsWith('/api/')){
        if(req.method==='POST'&&(req.headers['x-nail-request']!=='1'||(req.headers.origin&&![expected,alternative].includes(req.headers.origin))))fail(403,'Yêu cầu không được phép');
        const session=/\bnb_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'');
        const user=session?db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user WHERE s.token=? AND s.expires>? AND u.id NOT IN (SELECT user FROM account_controls WHERE blocked=1)').get(tokenHash(session[1]),Date.now()):null;
        const manager=()=>{if(!user)fail(401,'Vui lòng đăng nhập');if(user.role!=='manager')fail(403,'Chỉ quản lý được thực hiện thao tác này');};
        const newSession=id=>{db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),id,Date.now()+12*3600000);res.setHeader('Set-Cookie',`nb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookies?'; Secure':''}`);};
        if(req.method==='GET'&&pathname==='/api/status')return reply(res,200,{configured:!!db.prepare("SELECT id FROM users WHERE role='manager' LIMIT 1").get(),setupProtected:!!setupKey,managerAccounts:managerAccounts.filter(name=>!db.prepare('SELECT id FROM users WHERE username=?').get(name.toLowerCase())),user:user?cleanUser(user):null});
        if(req.method==='POST'&&pathname==='/api/setup'){
          if(!managerAccounts.length&&db.prepare('SELECT id FROM users LIMIT 1').get())fail(409,'Tài khoản quản lý đã được tạo');
          const raw=await body(req);
          if(managerAccounts.length&&!setupKey)fail(403,'Cần mã thiết lập để kích hoạt tài khoản quản lý');
          if(setupKey){const provided=tokenHash(String(raw.setupKey||'')),required=tokenHash(setupKey);if(!timingSafeEqual(Buffer.from(provided),Buffer.from(required)))fail(403,'Mã thiết lập không đúng');}
          const b=validateUser(raw),id=randomUUID();
          if(managerAccounts.length&&!managerAccounts.some(n=>n.toLowerCase()===b.username))fail(403,'Tài khoản này không được cấp quyền quản lý');
          if(db.prepare('SELECT id FROM users WHERE username=?').get(b.username)||(!managerAccounts.length&&db.prepare('SELECT id FROM users LIMIT 1').get()))fail(409,'Tài khoản quản lý đã được tạo');
          db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,b.username,b.name,'manager','Quản lý',hash(b.password));
          profiles.insert(id,b);if(requireContactVerification)await profiles.send(id);else newSession(id);return reply(res,201,{ok:true,verifyEmail:requireContactVerification});
        }
        if(req.method==='POST'&&pathname==='/api/register'){
          const b=validateUser(await body(req));if(managerAccounts.some(n=>n.toLowerCase()===b.username))fail(403,'Tên đăng nhập này dành riêng cho quản lý');
          if(db.prepare('SELECT id FROM users WHERE username=?').get(b.username))fail(409,'Tên đăng nhập đã tồn tại');
          if(db.prepare('SELECT count(*) AS n FROM account_approvals WHERE approved=0').get().n>=100)fail(429,'Danh sách chờ đã đầy, vui lòng liên hệ quản lý');
          const id=randomUUID();db.exec('BEGIN');try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,b.username,b.name,'employee','Nhân viên',hash(b.password));db.prepare('INSERT INTO account_approvals VALUES(?,0)').run(id);profiles.insert(id,b);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}if(requireContactVerification)await profiles.send(id);return reply(res,201,{ok:true,verifyEmail:requireContactVerification});
        }
        if(req.method==='POST'&&pathname==='/api/login'){
          const b=await body(req),ip=tokenHash(String(b.username||'').trim().toLowerCase());for(const [key,value] of attempts){if(value.until<Date.now())attempts.delete(key);}if(attempts.size>10000)fail(429,'Đăng nhập sai nhiều lần. Thử lại sau 15 phút.');let a=attempts.get(ip);if(!a){a={count:0,until:Date.now()+15*60000};attempts.set(ip,a);}if(a.count>=10)fail(429,'Đăng nhập sai nhiều lần. Thử lại sau 15 phút.');
          const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(b.username||'').trim().toLowerCase());
          const valid=verify(String(b.password||''),u?.password||hash('dummy-password-never-used'));if(!u||!valid){a.count++;fail(401,'Tên đăng nhập hoặc mật khẩu không đúng');}if(db.prepare('SELECT user FROM account_controls WHERE user=? AND blocked=1').get(u.id))fail(403,'Tài khoản đã bị khóa');if(db.prepare('SELECT user FROM account_approvals WHERE user=? AND approved=0').get(u.id))fail(403,'Tài khoản đang chờ quản lý duyệt');if(profiles.isUnverified(u.id))fail(403,'Vui lòng xác nhận email trước khi đăng nhập');attempts.delete(ip);newSession(u.id);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/verify-email'){const b=await body(req);profiles.confirm(b.token);return reply(res,200,{ok:true});}
        if(req.method==='POST'&&pathname==='/api/resend-email'){const b=await body(req),name=String(b.username||'').trim().toLowerCase(),key=tokenHash(name),now=Date.now();let a=attempts.get(key);if(!a||a.until<now){a={count:0,until:now+15*60000};attempts.set(key,a);}if(a.count>=10)fail(429,'Đăng nhập sai nhiều lần. Thử lại sau 15 phút.');const u=db.prepare('SELECT * FROM users WHERE username=?').get(name);if(!u||!verify(String(b.password||''),u.password)){a.count++;fail(401,'Tên đăng nhập hoặc mật khẩu không đúng');}await profiles.send(u.id);return reply(res,200,{ok:true});}
        if(!user)fail(401,'Vui lòng đăng nhập');
        if(req.method==='GET'&&pathname==='/api/profile'){const id=new URL(req.url,expected).searchParams.get('id')||user.id;const target=db.prepare('SELECT role FROM users WHERE id=?').get(id);if(id!==user.id&&(user.role!=='manager'||target?.role!=='employee'))fail(403,'Bạn chỉ được xem hồ sơ của mình');const profile=profiles.get(id);if(!profile)fail(404,'Không tìm thấy nhân viên');return reply(res,200,{profile});}
        if(req.method==='POST'&&pathname==='/api/profile'){const b=await body(req);profiles.update(user.id,b);return reply(res,200,{ok:true});}
        if(req.method==='POST'&&pathname==='/api/logout'){if(session)db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(session[1]));res.setHeader('Set-Cookie',`nb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return reply(res,200,{ok:true});}
        if(req.method==='GET'&&pathname==='/api/state'){
          const users=user.role==='manager'?db.prepare("SELECT * FROM users WHERE role='employee' AND id NOT IN (SELECT user FROM account_approvals WHERE approved=0) ORDER BY name").all():[user];
          const shifts=user.role==='manager'?db.prepare('SELECT * FROM shifts ORDER BY start DESC').all():db.prepare('SELECT * FROM shifts WHERE employee=? ORDER BY start DESC').all(user.id);
          const rateFor=(id,at)=>db.prepare('SELECT cents FROM pay_rates WHERE employee=? AND effective<=? ORDER BY effective DESC,id DESC LIMIT 1').get(id,at)?.cents??null;
          return reply(res,200,{user:cleanUser(user),pending:user.role==='manager'?db.prepare('SELECT u.id,u.name,u.username FROM users u JOIN account_approvals a ON a.user=u.id WHERE a.approved=0').all():[],employees:users.map(u=>({id:u.id,name:u.name,username:u.username,role:u.job,rateCents:rateFor(u.id,new Date().toISOString())})),shifts:shifts.map(s=>{const rateCents=rateFor(s.employee,s.start);const minutes=s.end?Math.max(0,Math.floor((new Date(s.end)-new Date(s.start))/60000)-s.break):null;return {...s,rateCents,payCents:minutes!==null&&rateCents!==null?Math.round(minutes*rateCents/60):null};})});
        }
        if(req.method==='GET'&&pathname==='/api/orders'){
          manager();const month=new URL(req.url,expected).searchParams.get('month');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))fail(400,'Tháng không hợp lệ');
          const orders=db.prepare('SELECT o.*,u.name AS employee_name FROM customer_orders o JOIN users u ON u.id=o.employee WHERE substr(o.paid_date,1,7)=? ORDER BY paid_date DESC,updated_at DESC').all(month);
          return reply(res,200,{orders,totalCents:orders.reduce((n,o)=>n+o.cents,0)});
        }
        if(req.method==='POST'&&pathname==='/api/orders'){
          manager();const b=await body(req),customer=String(b.customer||'').trim(),date=String(b.date||''),amount=String(b.amount??'').trim().replace(',','.');
          const parsed=new Date(date+'T00:00:00Z');const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
          if(!customer||customer.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==date||date>today||date<'2000-01-01'||!/^\d{1,6}(\.\d{1,2})?$/.test(amount))fail(400,'Kiểm tra tên khách, ngày thanh toán và số tiền (tối đa 2 số thập phân)');
          if(!db.prepare("SELECT id FROM users WHERE id=? AND role='employee' AND id NOT IN (SELECT user FROM account_approvals WHERE approved=0)").get(b.employee))fail(400,'Chọn nhân viên đã được duyệt');
          if(b.id&&!db.prepare('SELECT id FROM customer_orders WHERE id=?').get(b.id))fail(404,'Không tìm thấy đơn khách');const id=b.id||randomUUID();
          db.prepare('INSERT INTO customer_orders VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET customer=excluded.customer,employee=excluded.employee,paid_date=excluded.paid_date,cents=excluded.cents,updated_at=excluded.updated_at').run(id,customer,b.employee,date,Math.round(Number(amount)*100),user.id,new Date().toISOString());audit(user.id,'save_order',id);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/approve'){manager();const b=await body(req);if(!db.prepare('SELECT user FROM account_approvals WHERE user=? AND approved=0').get(b.employee))fail(404,'Không tìm thấy tài khoản chờ duyệt');db.prepare('UPDATE account_approvals SET approved=1 WHERE user=?').run(b.employee);audit(user.id,'approve_employee',b.employee);return reply(res,200,{ok:true});}
        if(req.method==='POST'&&pathname==='/api/pay-rate'){
          manager();const b=await body(req),text=String(b.rate||'').trim().replace(',','.');
          if(!/^\d{1,5}(\.\d{1,2})?$/.test(text)||Number(text)>10000)fail(400,'Mức lương phải từ 0 đến 10000 EUR/giờ, tối đa 2 số thập phân');
          if(!db.prepare("SELECT id FROM users WHERE id=? AND role='employee'").get(b.employee))fail(400,'Không tìm thấy nhân viên');
          const existing=db.prepare('SELECT id FROM pay_rates WHERE employee=? LIMIT 1').get(b.employee);
          const effective=existing?new Date().toISOString():'1970-01-01T00:00:00.000Z';
          db.prepare('INSERT INTO pay_rates(employee,cents,effective) VALUES(?,?,?)').run(b.employee,Math.round(Number(text)*100),effective);audit(user.id,'set_pay_rate',b.employee);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/users'){
          manager();const raw=await body(req),b=validateUser(raw),id=randomUUID();if(db.prepare('SELECT id FROM users WHERE username=?').get(b.username))fail(409,'Tên đăng nhập đã tồn tại');
          if(managerAccounts.some(n=>n.toLowerCase()===b.username))fail(403,'Tên đăng nhập này dành riêng cho quản lý');
          db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id,b.username,b.name,'employee',String(raw.job||'Nhân viên').slice(0,60),hash(b.password));profiles.insert(id,b);audit(user.id,'create_employee',id);if(requireContactVerification)await profiles.send(id);return reply(res,201,{ok:true});
        }
        if(req.method==='GET'&&pathname==='/api/employees'){
          manager();return reply(res,200,{employees:db.prepare("SELECT u.id,u.name,u.username,u.job,COALESCE(c.blocked,0) AS blocked,COALESCE(a.approved,1) AS approved FROM users u LEFT JOIN account_controls c ON c.user=u.id LEFT JOIN account_approvals a ON a.user=u.id WHERE u.role='employee' ORDER BY u.name").all()});
        }
        if(req.method==='POST'&&pathname==='/api/employees'){
          manager();const b=await body(req);const target=db.prepare("SELECT * FROM users WHERE id=? AND role='employee'").get(b.id);if(!target)fail(404,'Không tìm thấy nhân viên');
          if(b.action==='edit'){const name=String(b.name||'').trim(),job=String(b.job||'').trim();if(!name||name.length>80||job.length>60)fail(400,'Tên không quá 80 ký tự, chức danh không quá 60 ký tự');db.prepare('UPDATE users SET name=?,job=? WHERE id=?').run(name,job,target.id);}
          else if(b.action==='lock'||b.action==='unlock'){if(b.action==='lock'&&db.prepare('SELECT id FROM shifts WHERE employee=? AND end IS NULL').get(target.id))fail(409,'Kết thúc ca đang mở trước khi khóa nhân viên');db.prepare('INSERT INTO account_controls VALUES(?,?) ON CONFLICT(user) DO UPDATE SET blocked=excluded.blocked').run(target.id,b.action==='lock'?1:0);db.prepare('DELETE FROM sessions WHERE user=?').run(target.id);}
          else if(b.action==='password'){if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)fail(400,'Mật khẩu mới cần 10–128 ký tự');db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(b.password),target.id);db.prepare('DELETE FROM sessions WHERE user=?').run(target.id);}
          else fail(400,'Thao tác không hợp lệ');audit(user.id,'employee_'+b.action,target.id);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/password'){
          const b=await body(req);if(!verify(String(b.current||''),user.password))fail(401,'Mật khẩu hiện tại không đúng');if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)fail(400,'Mật khẩu mới cần 10–128 ký tự');
          db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(b.password),user.id);db.prepare('DELETE FROM sessions WHERE user=?').run(user.id);newSession(user.id);audit(user.id,'change_password',user.id);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/clock'){
          manager();const b=await body(req),id=b.employee;
          if(!db.prepare("SELECT id FROM users WHERE id=? AND role='employee'").get(id))fail(400,'Không tìm thấy nhân viên');
          if(db.prepare('SELECT user FROM account_controls WHERE user=? AND blocked=1').get(id)||db.prepare('SELECT user FROM account_approvals WHERE user=? AND approved=0').get(id))fail(403,'Nhân viên chưa được duyệt hoặc đã bị khóa');
          const current=db.prepare('SELECT * FROM shifts WHERE employee=? AND end IS NULL').get(id),now=new Date().toISOString();
          if(b.action==='in'){if(current)fail(409,'Bạn đã vào ca');db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?)').run(randomUUID(),id,now,null,0);}
          else if(b.action==='out'){if(!current)fail(409,'Không có ca đang mở');db.prepare('UPDATE shifts SET end=? WHERE id=?').run(now,current.id);}
          else fail(400,'Thao tác không hợp lệ');audit(user.id,'clock_'+b.action,id);return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&pathname==='/api/shifts'){
          manager();const b=await body(req),start=new Date(b.start),end=new Date(b.end),rest=Number(b.break),id=b.id||randomUUID();
          if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||end>Date.now()||!Number.isInteger(rest)||rest<0||rest>=Math.floor((end-start)/60000))fail(400,'Giờ vào/ra hoặc thời gian nghỉ không hợp lệ');
          if(!db.prepare("SELECT id FROM users WHERE id=? AND role='employee'").get(b.employee))fail(400,'Không tìm thấy nhân viên');
          if(b.id){const s=db.prepare('SELECT * FROM shifts WHERE id=?').get(b.id);if(!s||!s.end)fail(400,'Chỉ sửa được ca đã kết thúc');}
          const other=db.prepare('SELECT * FROM shifts WHERE employee=? AND id<>?').all(b.employee,id);
          if(other.some(s=>start<new Date(s.end||Date.now())&&end>new Date(s.start)))fail(409,'Ca này trùng với ca đã có');
          db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET employee=excluded.employee,start=excluded.start,end=excluded.end,break=excluded.break').run(id,b.employee,start.toISOString(),end.toISOString(),rest);audit(user.id,'save_shift',id);return reply(res,200,{ok:true});
        }
        fail(404,'Không tìm thấy chức năng');
      }
      if(req.method!=='GET')fail(405,'Không hỗ trợ');
      const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/auth.js':'auth.js','/i18n.js':'i18n.js','/orders.js':'orders.js','/employees.js':'employees.js','/profile.js':'profile.js','/verify-email':'index.html'};const file=files[pathname];if(!file)fail(404,'Không tìm thấy trang');
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(__dirname,'dist',file)).pipe(res);
    }catch(e){reply(res,e.status||500,{error:e.status?e.message:'Lỗi máy chủ, vui lòng thử lại'});}
  });
  server.on('close',()=>db.close());return server;
}
module.exports={createApp};
if(require.main===module){const server=createApp({managerAccounts:JSON.parse(fs.readFileSync(path.join(__dirname,'manager-accounts.json'),'utf8'))});server.listen(Number(process.env.PORT||8081),process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1',()=>console.log(`Nail Boutique: ${process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||'http://localhost:'+server.address().port}`));}



