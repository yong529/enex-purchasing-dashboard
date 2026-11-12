const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB:', err);
    return { members: [], tasks: [], directives: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ==================== MEMBERS API ====================
  if (req.method === 'GET' && pathname === '/api/members') {
    const db = readDB();
    return sendJSON(res, 200, db.members || []);
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/members/')) {
    const id = pathname.replace('/api/members/', '');
    const body = await parseBody(req);
    const db = readDB();
    const member = db.members.find(m => m.id === id);
    if (!member) return sendJSON(res, 404, { error: 'Member not found' });

    if (body.name !== undefined) member.name = body.name;
    if (body.title !== undefined) member.title = body.title;
    if (body.role !== undefined) member.role = body.role;
    if (body.icon !== undefined) member.icon = body.icon;
    if (body.color !== undefined) member.color = body.color;
    if (body.username !== undefined) member.username = body.username;
    if (body.password !== undefined) member.password = body.password;

    writeDB(db);
    return sendJSON(res, 200, member);
  }

  if (req.method === 'POST' && pathname === '/api/members') {
    const body = await parseBody(req);
    const db = readDB();
    const newMember = {
      id: body.id || `member-${Date.now()}`,
      username: body.username || `user-${Date.now()}`,
      password: body.password || '1234',
      name: body.name || '새 담당자',
      title: body.title || '사원',
      role: body.role || '구매 지원',
      icon: body.icon || '👤',
      color: body.color || 'blue',
      order_num: db.members.length + 1
    };
    db.members.push(newMember);
    writeDB(db);
    return sendJSON(res, 201, newMember);
  }

  // ==================== TASKS API ====================
  if (req.method === 'GET' && pathname === '/api/tasks') {
    const db = readDB();
    return sendJSON(res, 200, db.tasks || []);
  }

  if (req.method === 'POST' && pathname === '/api/tasks') {
    const body = await parseBody(req);
    if (!body.member_id || !body.title || !body.deadline) {
      return sendJSON(res, 400, { error: 'member_id, title, and deadline are required' });
    }
    const db = readDB();
    const newTask = {
      id: `task-${Date.now()}`,
      member_id: body.member_id,
      title: body.title,
      deadline: body.deadline,
      priority: body.priority || 'normal',
      memo: body.memo || '',
      is_completed: false,
      created_at: new Date().toISOString()
    };
    db.tasks.unshift(newTask);
    writeDB(db);
    return sendJSON(res, 201, newTask);
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/tasks/')) {
    const id = pathname.replace('/api/tasks/', '');
    const body = await parseBody(req);
    const db = readDB();
    const task = db.tasks.find(t => t.id === id);
    if (!task) return sendJSON(res, 404, { error: 'Task not found' });

    if (body.is_completed !== undefined) task.is_completed = Boolean(body.is_completed);
    if (body.title !== undefined) task.title = body.title;
    if (body.deadline !== undefined) task.deadline = body.deadline;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.memo !== undefined) task.memo = body.memo;
    if (body.member_id !== undefined) task.member_id = body.member_id;

    writeDB(db);
    return sendJSON(res, 200, task);
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/tasks/')) {
    const id = pathname.replace('/api/tasks/', '');
    const db = readDB();
    const len = db.tasks.length;
    db.tasks = db.tasks.filter(t => t.id !== id);
    if (db.tasks.length === len) return sendJSON(res, 404, { error: 'Task not found' });
    writeDB(db);
    return sendJSON(res, 200, { success: true, id });
  }

  // ==================== DIRECTIVES (지시사항) API ====================
  if (req.method === 'GET' && pathname === '/api/directives') {
    const db = readDB();
    return sendJSON(res, 200, db.directives || []);
  }

  if (req.method === 'POST' && pathname === '/api/directives') {
    const body = await parseBody(req);
    if (!body.title || !body.content) {
      return sendJSON(res, 400, { error: 'title and content are required' });
    }
    const db = readDB();
    if (!db.directives) db.directives = [];

    const newDirective = {
      id: `dir-${Date.now()}`,
      issuer_id: body.issuer_id || 'member-1',
      target_id: body.target_id || 'all',
      title: body.title,
      content: body.content,
      priority: body.priority || 'urgent',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    db.directives.unshift(newDirective);
    writeDB(db);
    return sendJSON(res, 201, newDirective);
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/directives/')) {
    const id = pathname.replace('/api/directives/', '');
    const body = await parseBody(req);
    const db = readDB();
    if (!db.directives) db.directives = [];

    const directive = db.directives.find(d => d.id === id);
    if (!directive) return sendJSON(res, 404, { error: 'Directive not found' });

    if (body.status !== undefined) directive.status = body.status;
    if (body.title !== undefined) directive.title = body.title;
    if (body.content !== undefined) directive.content = body.content;
    if (body.priority !== undefined) directive.priority = body.priority;

    writeDB(db);
    return sendJSON(res, 200, directive);
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/directives/')) {
    const id = pathname.replace('/api/directives/', '');
    const db = readDB();
    if (!db.directives) db.directives = [];
    const len = db.directives.length;
    db.directives = db.directives.filter(d => d.id !== id);
    if (db.directives.length === len) return sendJSON(res, 404, { error: 'Directive not found' });
    writeDB(db);
    return sendJSON(res, 200, { success: true, id });
  }

  // ==================== WEEKLY REPORTS API ====================
  if (req.method === 'GET' && pathname === '/api/weekly-reports') {
    const db = readDB();
    return sendJSON(res, 200, db.weekly_reports || []);
  }

  if (req.method === 'POST' && pathname === '/api/weekly-reports') {
    const body = await parseBody(req);
    const db = readDB();
    if (!db.weekly_reports) db.weekly_reports = [];
    const idx = db.weekly_reports.findIndex(r => r.id === body.id || (r.week_id === body.week_id && r.member_id === body.member_id));
    if (idx !== -1) {
      db.weekly_reports[idx] = { ...db.weekly_reports[idx], ...body, updated_at: new Date().toISOString() };
      writeDB(db);
      return sendJSON(res, 200, db.weekly_reports[idx]);
    } else {
      const newReport = {
        id: body.id || `report-${Date.now()}`,
        week_id: body.week_id,
        week_range: body.week_range,
        member_id: body.member_id,
        member_name: body.member_name,
        dept_label: body.dept_label || '구매부',
        plan_this_week: body.plan_this_week || '',
        performance_this_week: body.performance_this_week || '',
        plan_next_week: body.plan_next_week || '',
        notes: body.notes || '',
        updated_by: body.updated_by || '담당자',
        updated_at: new Date().toISOString()
      };
      db.weekly_reports.push(newReport);
      writeDB(db);
      return sendJSON(res, 201, newReport);
    }
  }

  // ==================== WEEKLY COMMON NOTES API ====================
  if (req.method === 'GET' && pathname === '/api/weekly-common-notes') {
    const db = readDB();
    return sendJSON(res, 200, db.weekly_common_notes || {});
  }

  if (req.method === 'POST' && pathname === '/api/weekly-common-notes') {
    const body = await parseBody(req);
    const db = readDB();
    if (!db.weekly_common_notes) db.weekly_common_notes = {};
    if (body.week_id) {
      db.weekly_common_notes[body.week_id] = {
        week_id: body.week_id,
        notes: body.notes || '',
        updated_by: body.updated_by || '담당자',
        updated_at: new Date().toISOString()
      };
      writeDB(db);
      return sendJSON(res, 200, db.weekly_common_notes[body.week_id]);
    }
    return sendJSON(res, 400, { error: 'week_id is required' });
  }

  // ==================== STATIC FILES ====================
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ENEX Purchasing Dashboard Server is running!`);
  console.log(`👉 Open your browser at: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
