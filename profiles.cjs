function createProfiles({db,fail,audit}){
  // Retain old columns for compatibility with existing SQLite databases.
  db.exec("CREATE TABLE IF NOT EXISTS profiles(user TEXT PRIMARY KEY REFERENCES users(id),email TEXT UNIQUE,phone TEXT,avatar TEXT NOT NULL DEFAULT '',email_verified INTEGER NOT NULL DEFAULT 0)");
  function validate(raw){const phone=String(raw.phone||'').replace(/[\s()-]/g,'');if(!/^\+[1-9]\d{6,14}$/.test(phone))fail(400,'Nhập số điện thoại có mã quốc gia, ví dụ +33 hoặc +84');return {phone};}
  function insert(id,b){db.prepare('INSERT INTO profiles(user,phone) VALUES(?,?)').run(id,b.phone);}
  function get(id){const u=db.prepare('SELECT id,name,username,role,job FROM users WHERE id=?').get(id);if(!u)return null;const p=db.prepare('SELECT phone,avatar FROM profiles WHERE user=?').get(id);return {...u,phone:p?.phone||'',avatar:p?.avatar||'',phoneVerified:false};}
  function update(id,b){const name=String(b.name||'').trim(),avatar=String(b.avatar||'');if(!name||name.length>80)fail(400,'Tên không quá 80 ký tự');if(avatar){if(avatar.length>200000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(avatar))fail(400,'Ảnh đại diện phải là JPEG và nhỏ hơn 150 KB');const bytes=Buffer.from(avatar.split(',')[1],'base64');if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)fail(400,'Ảnh đại diện không hợp lệ');}db.prepare('INSERT INTO profiles(user,avatar) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET avatar=excluded.avatar').run(id,avatar);db.prepare('UPDATE users SET name=? WHERE id=?').run(name,id);audit(id,'update_profile',id);}
  return {validate,insert,get,update};
}
module.exports={createProfiles};
