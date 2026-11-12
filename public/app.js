// State Management
let members = [];
let tasks = [];
let directives = [];
let currentUserId = null; // null by default: requires login on initial load!
let expandedMemberIds = new Set();
let selectedCalDate = null;
let calMemberFilter = 'all';
let isDirectivesFeedOpen = false;

// Legacy Mock Account / Demo Identifiers (to completely purge)
const LEGACY_MOCK_MEMBER_IDS = ['member-1', 'member-2', 'member-3', 'member-4', 'member-5'];
const LEGACY_NAMES = ['김차장', '이과장', '박대리', '최대리', '정주임'];
const LEGACY_USERNAMES = ['kim', 'lee', 'park', 'choi', 'jung'];
const LEGACY_EMAILS = ['kim@enex.co.kr', 'lee@enex.co.kr', 'park@enex.co.kr', 'choi@enex.co.kr', 'jung@enex.co.kr'];
const LEGACY_MOCK_TASK_IDS = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7', 'task-8', 'task-9', 'task-10'];
const LEGACY_MOCK_DIR_IDS = ['dir-1', 'dir-2', 'dir-3'];

function isLegacyDemo(m) {
  if (!m) return false;
  if (LEGACY_MOCK_MEMBER_IDS.includes(m.id)) return true;
  if (LEGACY_NAMES.includes(m.name)) return true;
  if (m.username && LEGACY_USERNAMES.includes(m.username.toLowerCase())) return true;
  if (m.email && LEGACY_EMAILS.includes(m.email.toLowerCase())) return true;
  return false;
}

// Immediately purge any cached sessions from persistent browser storage so fresh visits always start at the login screen!
(function purgeLegacySessions() {
  try {
    // Completely wipe persistent auto-login key from localStorage
    localStorage.removeItem('enex_current_user_id');
    const curSession = sessionStorage.getItem('enex_current_user_id');
    if (curSession === 'admin-yong' || curSession === 'yong') {
      sessionStorage.removeItem('enex_current_user_id');
    }
  } catch (e) {}
})();

// Supabase Client instance
let supabaseClient = null;

// Calendar Date State
const today = new Date();
let calViewDate = new Date(today.getFullYear(), today.getMonth(), 1);

// Color Themes Map
const COLOR_THEMES = {
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', pill: 'bg-purple-50 text-purple-700 border-purple-200' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', pill: 'bg-rose-50 text-rose-700 border-rose-200' }
};

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Master Admin User Account (ID: yong / PW: 1234)
const ADMIN_USER = {
  id: "admin-yong",
  username: "yong",
  email: "yong@enex.co.kr",
  password: "1234",
  name: "시스템 총괄 관리자",
  title: "총괄관리자",
  role: "구매본부 시스템 총괄 및 클라우드 DB/인증 관리",
  icon: "👑",
  color: "indigo",
  order_num: 1,
  is_admin: true
};

const DEFAULT_MEMBERS = [ADMIN_USER];
const DEFAULT_TASKS = [];
const DEFAULT_DIRECTIVES = [];

// Helper to determine if current logged-in user has system admin permissions
function checkIsAdmin() {
  if (!currentUserId) return false;
  if (currentUserId === 'admin-yong' || (typeof ADMIN_USER !== 'undefined' && currentUserId === ADMIN_USER.id)) return true;
  const cur = members.find(m => m.id === currentUserId);
  if (!cur) return false;
  return cur.username === 'yong' || cur.id === 'admin-yong' || cur.is_admin === true;
}

// Helper to retrieve only regular purchasing team members (excluding backend admin and legacy demos)
function getTeamMembers() {
  return members.filter(m => 
    m.username !== 'yong' && 
    m.id !== 'admin-yong' && 
    !m.is_admin && 
    !isLegacyDemo(m)
  );
}

// ==================== SUPABASE INITIALIZATION ====================

function initSupabase() {
  const url = localStorage.getItem('supabase_url') || 'https://lnilzitmifivbhauepac.supabase.co';
  const key = localStorage.getItem('supabase_anon_key');

  if (url && key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, key);
      console.log('⚡ Supabase Client Connected:', url);

      // Subscribe to Realtime Postgres Changes
      supabaseClient
        .channel('public:enex_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => fetchSupabaseData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchSupabaseData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'directives' }, () => fetchSupabaseData())
        .subscribe();

      // Listen to Supabase Auth State changes
      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('⚡ Supabase Auth Event:', event, session?.user?.email);
        if (session && session.user) {
          const email = (session.user.email || '').toLowerCase();
          // If cached session is an old demo user, sign out immediately
          if (LEGACY_EMAILS.includes(email) || LEGACY_USERNAMES.some(u => email.startsWith(u + '@'))) {
            console.log('Purging legacy demo auth session:', email);
            await supabaseClient.auth.signOut();
            currentUserId = null;
            localStorage.removeItem('enex_current_user_id');
            renderAll();
            openLoginModal(true);
            return;
          }
          await syncAuthUserWithProfile(session.user);
        }
      });

      const statusEl = document.getElementById('supabase-conn-status');
      if (statusEl) {
        statusEl.textContent = '🟢 Supabase 클라우드 실시간 & Auth 연결됨';
        statusEl.className = 'text-[11px] text-emerald-600 font-bold';
      }
      return true;
    } catch (e) {
      console.error('Supabase init error:', e);
    }
  }
  return false;
}

async function syncAuthUserWithProfile(authUser) {
  if (!authUser) return;
  // Check if member exists in members list
  let member = members.find(m => m.id === authUser.id || (m.email && m.email.toLowerCase() === authUser.email.toLowerCase()));
  if (!member && supabaseClient) {
    try {
      const { data } = await supabaseClient.from('members').select('*').or(`id.eq.${authUser.id},email.eq.${authUser.email}`);
      if (data && data.length > 0) member = data[0];
    } catch (e) {}
  }

  if (!member) {
    const meta = authUser.user_metadata || {};
    member = {
      id: authUser.id,
      email: authUser.email,
      username: meta.username || authUser.email.split('@')[0],
      name: meta.name || authUser.email.split('@')[0],
      title: meta.title || '사원',
      role: meta.role || '구매 관리 및 발주 담당',
      icon: meta.icon || '🧑‍💼',
      color: meta.color || 'blue',
      order_num: members.length + 1,
      created_at: new Date().toISOString()
    };
    members.push(member);
    if (supabaseClient) {
      try { await supabaseClient.from('members').upsert([member]); } catch (e) {}
    }
  }

  currentUserId = member.id;
  sessionStorage.setItem('enex_current_user_id', member.id);
  localStorage.removeItem('enex_current_user_id');
  expandedMemberIds.add(member.id);
  renderAll();
}

async function fetchSupabaseData() {
  if (!supabaseClient) return false;
  try {
    const [mRes, tRes, dRes] = await Promise.all([
      supabaseClient.from('members').select('*').order('order_num', { ascending: true }),
      supabaseClient.from('tasks').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('directives').select('*').order('created_at', { ascending: false })
    ]);

    // Permanently purge legacy demo rows from remote Supabase DB in background
    try {
      supabaseClient.from('members').delete().in('id', LEGACY_MOCK_MEMBER_IDS).then(() => {});
      supabaseClient.from('members').delete().in('name', LEGACY_NAMES).then(() => {});
      supabaseClient.from('tasks').delete().in('id', LEGACY_MOCK_TASK_IDS).then(() => {});
      supabaseClient.from('directives').delete().in('id', LEGACY_MOCK_DIR_IDS).then(() => {});
    } catch (e) {}

    // In-memory filter out legacy demo items
    if (mRes.data) {
      members = mRes.data.filter(m => !isLegacyDemo(m));
    }
    if (tRes.data) {
      tasks = tRes.data.filter(t => !LEGACY_MOCK_TASK_IDS.includes(t.id));
    }
    if (dRes.data) {
      directives = dRes.data.filter(d => !LEGACY_MOCK_DIR_IDS.includes(d.id));
    }

    // Ensure Admin 'yong' is always present in members and synced to Supabase
    if (!members.some(m => m.username === 'yong' || m.id === 'admin-yong')) {
      members.unshift(JSON.parse(JSON.stringify(ADMIN_USER)));
      supabaseClient.from('members').upsert([ADMIN_USER]).then(() => {});
    }

    renderAll();
    return true;
  } catch (err) {
    console.warn('Supabase fetch failed, falling back:', err);
    return false;
  }
}

function saveSupabaseConfig() {
  const url = document.getElementById('supabase-url-input').value.trim();
  const key = document.getElementById('supabase-key-input').value.trim();
  const statusEl = document.getElementById('supabase-conn-status');

  if (!url || !key) {
    alert('Supabase Project URL과 Anon Key를 모두 입력해 주세요.');
    return;
  }

  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', key);

  if (initSupabase()) {
    fetchSupabaseData().then(ok => {
      if (ok) {
        alert('🎉 Supabase 클라우드 데이터베이스와 실시간으로 연결되었습니다!');
        closeSupabaseModal();
      } else {
        alert('연결을 시도했으나 테이블을 찾지 못했습니다. supabase_schema.sql을 먼저 실행해 주세요.');
      }
    });
  }
}

// ==================== INITIAL DATA LOADING ====================

async function fetchInitialData() {
  // 1. Try Supabase first if configured
  if (initSupabase()) {
    const ok = await fetchSupabaseData();
    if (ok && members.length > 0) return;
  }

  // 2. Try Local REST API (if running with node server.js locally)
  try {
    const [mRes, tRes, dRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/tasks'),
      fetch('/api/directives')
    ]);

    if (mRes.ok && tRes.ok) {
      const mData = await mRes.json();
      const tData = await tRes.json();
      const dData = dRes.ok ? await dRes.json() : [];
      if (Array.isArray(mData) && mData.length > 0) {
        members = mData;
        tasks = Array.isArray(tData) ? tData : [];
        directives = Array.isArray(dData) ? dData : [];
        renderAll();
        return;
      }
    }
  } catch (err) {
    console.log('Local API unavailable, falling back to local storage');
  }

  // 3. Fallback Local Storage & Default Seeds
  loadLocalState();
  renderAll();
}

function renderAll() {
  // Always wipe persistent localStorage login key so fresh visits in new tabs always require login
  localStorage.removeItem('enex_current_user_id');

  // If currentUserId is not set in memory, check if active tab has a session in sessionStorage
  if (!currentUserId) {
    const savedUser = sessionStorage.getItem('enex_current_user_id');
    if (
      savedUser && 
      !LEGACY_MOCK_MEMBER_IDS.includes(savedUser) && 
      members.some(m => m.id === savedUser && !isLegacyDemo(m))
    ) {
      currentUserId = savedUser;
    }
  }

  if (currentUserId) {
    expandedMemberIds.add(currentUserId);
    closeLoginModal();
  } else {
    // Initial view: show login modal on fresh visit!
    openLoginModal(true);
  }

  populateCurrentUserSelect();
  populateDirectiveTargetSelect();
  populateCalMemberFilter();

  renderMyActionSection();
  renderDirectivesFeed();
  renderMembersAccordion();
  renderCalendar();
}

function loadLocalState() {
  // Purge legacy state with mock accounts
  localStorage.removeItem('enex_dashboard_v3_state');

  try {
    const saved = localStorage.getItem('enex_dashboard_v4_clean');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.members)) {
        // filter out any old demo users (member-1 to member-5, kim, lee, park, choi, jung)
        members = parsed.members.filter(m => !isLegacyDemo(m));
        // Ensure admin yong is always present
        if (!members.some(m => m.username === 'yong' || m.id === 'admin-yong')) {
          members.unshift(JSON.parse(JSON.stringify(ADMIN_USER)));
        }
        tasks = (parsed.tasks || []).filter(t => !LEGACY_MOCK_TASK_IDS.includes(t.id));
        directives = (parsed.directives || []).filter(d => !LEGACY_MOCK_DIR_IDS.includes(d.id));
        saveLocalState();
        return;
      }
    }
  } catch (e) {}

  // Defaults: only admin yong
  members = [JSON.parse(JSON.stringify(ADMIN_USER))];
  tasks = [];
  directives = [];
  saveLocalState();
}

function saveLocalState() {
  try {
    localStorage.setItem('enex_dashboard_v4_clean', JSON.stringify({
      members, tasks, directives
    }));
  } catch (e) {}
}

// ==================== SECTION 0: MY ACTION ITEMS ====================

function populateCurrentUserSelect() {
  const sel = document.getElementById('current-user-select');
  if (!sel) return;
  sel.innerHTML = '';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.icon || '👤'} ${m.name} (${m.title})`;
    sel.appendChild(opt);
  });
  if (currentUserId) sel.value = currentUserId;
}

function changeCurrentUser(newId) {
  currentUserId = newId;
  localStorage.removeItem('enex_current_user_id');
  if (newId) {
    sessionStorage.setItem('enex_current_user_id', newId);
    expandedMemberIds.add(newId);
  } else {
    sessionStorage.removeItem('enex_current_user_id');
  }

  renderMyActionSection();
  renderDirectivesFeed();
  renderMembersAccordion();
  renderCalendar();
}

function renderMyActionSection() {
  const curMember = members.find(m => m.id === currentUserId);
  const todayStr = formatDate(today);

  // Update Top Global Header User Badge & Supabase Admin Button
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');
  const supabaseBtn = document.getElementById('header-supabase-btn');

  if (curMember) {
    const isAdmin = checkIsAdmin();
    if (headerAvatar) headerAvatar.textContent = curMember.icon || '👤';
    if (headerName) {
      headerName.innerHTML = `${curMember.name} (${curMember.title})${isAdmin ? ' <span class="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-300">관리자</span>' : ''}`;
    }

    // Supabase button is ONLY visible when logged in as admin yong!
    if (supabaseBtn) {
      if (isAdmin) {
        supabaseBtn.classList.remove('hidden');
      } else {
        supabaseBtn.classList.add('hidden');
      }
    }

    document.getElementById('my-profile-greeting').textContent = `환영합니다, ${curMember.name} ${curMember.title}님!`;
    document.getElementById('my-profile-avatar').textContent = curMember.icon || '👤';
    if (isAdmin) {
      document.getElementById('my-profile-summary').textContent = `현재 시스템 총괄 관리자 모드로 접속 중입니다. 전체 업무 및 계정 관리 마스터 권한이 부여되어 있습니다.`;
    } else {
      document.getElementById('my-profile-summary').textContent = `현재 [${curMember.name}] 계정으로 접속 중입니다. 오늘 확인할 긴급 지시사항 및 마감 할 일입니다.`;
    }
  } else {
    // Not logged in
    if (headerAvatar) headerAvatar.textContent = '👤';
    if (headerName) headerName.textContent = '로그인이 필요합니다';
    if (supabaseBtn) supabaseBtn.classList.add('hidden');

    document.getElementById('my-profile-greeting').textContent = `로그인이 필요합니다`;
    document.getElementById('my-profile-avatar').textContent = '🔒';
    document.getElementById('my-profile-summary').textContent = `상단의 [계정 전환]을 누르시거나 로그인 창에서 계정을 인증해 주세요.`;
  }

  const isUserAdmin = checkIsAdmin();
  const myDirectives = curMember 
    ? (isUserAdmin 
        ? directives 
        : directives.filter(d => d.target_id === currentUserId || d.target_id === 'all' || d.issuer_id === currentUserId))
    : [];
  const myPendingDirectives = myDirectives.filter(d => d.status !== 'completed');

  document.getElementById('my-directives-count').textContent = `${myPendingDirectives.length}건 대기`;
  const dirContainer = document.getElementById('my-directives-list');
  dirContainer.innerHTML = '';

  if (myDirectives.length === 0) {
    dirContainer.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">${curMember ? '수신된 지시사항이 없습니다.' : '로그인 후 확인하실 수 있습니다.'}</p>`;
  } else {
    myDirectives.forEach(d => {
      const issuer = members.find(m => m.id === d.issuer_id) || { name: '본부장', icon: '👔' };
      const isCompleted = d.status === 'completed';

      const item = document.createElement('div');
      item.className = `p-3 rounded-xl border transition text-xs space-y-1.5 ${
        isCompleted ? 'bg-white/5 border-white/10 opacity-50' : 'bg-amber-500/10 border-amber-500/30'
      }`;

      item.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
              ${d.priority === 'urgent' ? '🚨 긴급지시' : '📋 업무지시'}
            </span>
            <span class="text-[11px] text-slate-300 font-medium">발신: <strong>${issuer.name}</strong></span>
            ${d.target_id === 'all' ? '<span class="text-[9px] px-1 rounded bg-slate-700 text-slate-300">전체공지</span>' : ''}
          </div>
          <button onclick="toggleDirectiveStatus('${d.id}')" 
            class="text-[10px] font-bold px-2 py-0.5 rounded-lg transition ${
              isCompleted 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold'
            }">
            ${isCompleted ? '✓ 확인완료' : '확인 완료 체크'}
          </button>
        </div>
        <h4 class="font-bold text-white text-xs ${isCompleted ? 'line-through text-slate-400' : ''}">${d.title}</h4>
        <p class="text-[11px] text-slate-300 leading-relaxed">${d.content}</p>
      `;

      dirContainer.appendChild(item);
    });
  }

  const myTasks = tasks.filter(t => t.member_id === currentUserId);
  const myPendingTasks = myTasks.filter(t => !t.is_completed);

  document.getElementById('my-tasks-count').textContent = `${myPendingTasks.length}건 진행중`;
  const tasksContainer = document.getElementById('my-tasks-list');
  tasksContainer.innerHTML = '';

  if (myTasks.length === 0) {
    tasksContainer.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">배정된 할 일이 없습니다.</p>`;
  } else {
    myTasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      return a.deadline.localeCompare(b.deadline);
    });

    myTasks.forEach(t => {
      const isOverdue = !t.is_completed && t.deadline < todayStr;
      const isToday = !t.is_completed && t.deadline === todayStr;

      let badge = '';
      if (t.is_completed) {
        badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">완료됨</span>`;
      } else if (isOverdue) {
        badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 font-bold">기한 경과 (${t.deadline})</span>`;
      } else if (isToday) {
        badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/30 text-amber-300 font-bold">오늘 마감!</span>`;
      } else {
        badge = `<span class="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">마감: ${t.deadline}</span>`;
      }

      const item = document.createElement('div');
      item.className = `p-2.5 rounded-xl border transition flex items-start justify-between gap-2.5 text-xs ${
        t.is_completed ? 'bg-white/5 border-white/10 opacity-50' : 'bg-blue-500/10 border-blue-500/20'
      }`;

      item.innerHTML = `
        <div class="flex items-start gap-2 min-w-0">
          <input type="checkbox" ${t.is_completed ? 'checked' : ''} onchange="toggleTask('${t.id}')" 
            class="mt-1 w-4 h-4 rounded text-blue-500 focus:ring-blue-400 cursor-pointer accent-blue-500 shrink-0">
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-1.5">
              ${badge}
              ${t.priority === 'urgent' && !t.is_completed ? '<span class="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">긴급</span>' : ''}
            </div>
            <p class="font-semibold text-white truncate ${t.is_completed ? 'line-through text-slate-400' : ''}">
              ${t.title}
            </p>
          </div>
        </div>
      `;

      tasksContainer.appendChild(item);
    });
  }

  document.getElementById('my-pending-count').textContent = myPendingDirectives.length + myPendingTasks.length;
}

// ==================== SECTION 1: DIRECTIVES FEED ====================

function toggleDirectivesFeed() {
  const content = document.getElementById('directives-feed-content');
  const arrow = document.getElementById('directives-feed-arrow');
  isDirectivesFeedOpen = !isDirectivesFeedOpen;

  if (isDirectivesFeedOpen) {
    content.classList.remove('hidden');
    arrow.classList.add('rotate-180');
  } else {
    content.classList.add('hidden');
    arrow.classList.remove('rotate-180');
  }
}

function renderDirectivesFeed() {
  document.getElementById('total-directives-badge').textContent = `${directives.length}건`;
  const container = document.getElementById('directives-feed-content');
  container.innerHTML = '';

  if (directives.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">등록된 지시사항이 없습니다.</p>`;
    return;
  }

  directives.forEach(d => {
    const issuer = members.find(m => m.id === d.issuer_id) || { name: '본부장', title: '총괄', icon: '👔' };
    const target = d.target_id === 'all' 
      ? { name: '구매부 전원', title: '공지', icon: '📢' }
      : (members.find(m => m.id === d.target_id) || { name: '담당자', title: '', icon: '👤' });

    const isCompleted = d.status === 'completed';
    const isCurAdmin = checkIsAdmin();
    const isOwner = d.issuer_id === currentUserId;
    const canDelete = isCurAdmin || isOwner;
    const canToggle = isCurAdmin || isOwner || d.target_id === 'all' || d.target_id === currentUserId;

    const card = document.createElement('div');
    card.className = `p-3.5 rounded-xl border bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
      isCompleted ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-blue-300 shadow-2xs'
    }`;

    const deleteBtnHtml = canDelete ? `
      <button onclick="deleteDirective('${d.id}')" class="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition" title="지시사항 삭제 (작성자/관리자 전용)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    ` : '';

    const toggleBtnHtml = canToggle ? `
      <button onclick="toggleDirectiveStatus('${d.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
        isCompleted 
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
      }">
        ${isCompleted ? '✓ 처리 완료됨' : '처리 확인'}
      </button>
    ` : `
      <button disabled class="text-xs font-medium px-3 py-1.5 rounded-xl border bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60">
        ${isCompleted ? '✓ 처리 완료됨' : '처리 확인'}
      </button>
    `;

    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${
            d.priority === 'urgent' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700'
          }">
            ${d.priority === 'urgent' ? '🚨 긴급지시' : '📋 업무지시'}
          </span>
          <span class="text-xs text-slate-600">
            <strong>${issuer.name}</strong>(${issuer.title}) &rarr; <strong class="text-blue-700">${target.name}</strong>
          </span>
          <span class="text-[10px] text-slate-400 font-mono">
            ${new Date(d.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <h4 class="text-xs sm:text-sm font-bold text-slate-900 ${isCompleted ? 'line-through text-slate-400' : ''}">${d.title}</h4>
        <p class="text-xs text-slate-600">${d.content}</p>
      </div>

      <div class="shrink-0 flex items-center gap-2">
        ${toggleBtnHtml}
        ${deleteBtnHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

function populateDirectiveTargetSelect() {
  const sel = document.getElementById('directive-target-select');
  if (!sel) return;
  sel.innerHTML = '<option value="all">전체 공지 (구매부 전원)</option>';
  const teamMembers = getTeamMembers();
  teamMembers.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.title} - ${m.role.substring(0, 18)}...)`;
    sel.appendChild(opt);
  });
}

function openDirectiveModal() {
  if (!currentUserId) {
    alert('로그인 후 지시사항을 등록하실 수 있습니다.');
    openLoginModal(true);
    return;
  }
  const curMember = members.find(m => m.id === currentUserId) || { name: '담당자', title: '' };
  document.getElementById('directive-issuer-display').value = `${curMember.name} (${curMember.title})`;
  populateDirectiveTargetSelect();
  document.getElementById('directive-modal').classList.remove('hidden');
}

function closeDirectiveModal() {
  document.getElementById('directive-modal').classList.add('hidden');
  document.getElementById('directive-form').reset();
}

async function handleCreateDirective(e) {
  e.preventDefault();
  if (!currentUserId) {
    alert('로그인 후 지시사항을 등록하실 수 있습니다.');
    openLoginModal(true);
    return;
  }

  const issuer_id = currentUserId;
  const target_id = document.getElementById('directive-target-select').value;
  const title = document.getElementById('directive-title').value.trim();
  const content = document.getElementById('directive-content').value.trim();
  const priority = document.getElementById('directive-priority').value || 'urgent';

  if (!title || !content) {
    alert('제목과 세부 지시 내용을 모두 입력해 주세요.');
    return;
  }

  const newDir = {
    id: `dir-${Date.now()}`,
    issuer_id,
    target_id,
    title,
    content,
    priority,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // 1. Instant optimistic update: add to state & localStorage immediately!
  directives.unshift(newDir);
  saveLocalState();

  closeDirectiveModal();
  if (!isDirectivesFeedOpen) toggleDirectivesFeed();

  renderMyActionSection();
  renderDirectivesFeed();

  // 2. Sync to Supabase in background
  if (supabaseClient) {
    try {
      // Ensure issuer member exists in Supabase members table to satisfy foreign key constraint
      const curMember = members.find(m => m.id === currentUserId);
      if (curMember) {
        try {
          await supabaseClient.from('members').upsert([{
            id: curMember.id,
            username: curMember.username || curMember.id,
            name: curMember.name,
            title: curMember.title,
            role: curMember.role,
            icon: curMember.icon || '👤',
            color: curMember.color || 'blue'
          }]);
        } catch (e) {}
      }

      const dbPayload = {
        id: newDir.id,
        issuer_id: newDir.issuer_id,
        target_id: newDir.target_id,
        title: newDir.title,
        content: newDir.content,
        priority: newDir.priority,
        status: newDir.status,
        created_at: newDir.created_at
      };

      const { data, error } = await supabaseClient.from('directives').insert([dbPayload]).select();
      if (error) {
        console.warn('Supabase directive insert error, retrying with nullable issuer:', error);
        // If FK constraint fails on issuer_id, retry with issuer_id = null
        if (error.code === '23503' || String(error.message).includes('foreign key')) {
          dbPayload.issuer_id = null;
          await supabaseClient.from('directives').insert([dbPayload]);
        }
      } else if (data && data[0]) {
        const idx = directives.findIndex(d => d.id === newDir.id);
        if (idx !== -1) {
          directives[idx] = data[0];
          saveLocalState();
        }
      }
    } catch (err) {
      console.warn('Supabase directive sync failed, kept in local state:', err);
    }
  }
}

async function toggleDirectiveStatus(dirId) {
  const directive = directives.find(d => d.id === dirId);
  if (!directive) return;

  const isCurAdmin = checkIsAdmin();
  const isTarget = directive.target_id === 'all' || directive.target_id === currentUserId;
  const isIssuer = directive.issuer_id === currentUserId;
  if (!isCurAdmin && !isTarget && !isIssuer) {
    alert('해당 지시사항의 수신자 또는 시스템 관리자만 처리 상태를 변경할 수 있습니다.');
    return;
  }

  const newStatus = directive.status === 'completed' ? 'pending' : 'completed';
  directive.status = newStatus;
  saveLocalState();

  renderMyActionSection();
  renderDirectivesFeed();

  if (supabaseClient) {
    try {
      await supabaseClient.from('directives').update({ status: newStatus }).eq('id', dirId);
    } catch (err) {
      console.warn('Supabase directive toggle error:', err);
    }
  }
}

async function deleteDirective(dirId) {
  const d = directives.find(item => item.id === dirId);
  const isCurAdmin = checkIsAdmin();
  const isOwner = d && d.issuer_id === currentUserId;
  if (!isCurAdmin && !isOwner) {
    alert('본인이 등록한 지시사항만 삭제할 수 있습니다.');
    return;
  }

  if (!confirm('이 지시사항을 삭제하시겠습니까?')) return;
  directives = directives.filter(item => item.id !== dirId);
  saveLocalState();

  renderMyActionSection();
  renderDirectivesFeed();

  if (supabaseClient) {
    try {
      await supabaseClient.from('directives').delete().eq('id', dirId);
    } catch (err) {
      console.warn('Supabase directive delete error:', err);
    }
  }
}

// ==================== SECTION 2: MEMBERS ACCORDION ====================

function renderMembersAccordion() {
  const container = document.getElementById('members-accordion-container');
  container.innerHTML = '';
  
  const isCurAdmin = checkIsAdmin();
  const teamMembers = getTeamMembers();
  teamMembers.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const todayStr = formatDate(today);

  if (teamMembers.length === 0) {
    container.innerHTML = `
      <div class="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
        <p class="text-sm font-bold text-slate-700">등록된 팀원이 없습니다.</p>
        <p class="text-xs text-slate-400">상단의 <span class="font-semibold text-blue-600">[+ 팀원 계정 등록]</span> 버튼을 눌러 새 팀원을 등록하세요.</p>
      </div>
    `;
    return;
  }

  teamMembers.forEach(m => {
    const theme = COLOR_THEMES[m.color] || COLOR_THEMES.blue;
    let memberTasks = tasks.filter(t => t.member_id === m.id);

    if (selectedCalDate) {
      memberTasks = memberTasks.filter(t => t.deadline === selectedCalDate);
    }

    const pendingCount = memberTasks.filter(t => !t.is_completed).length;
    const isExpanded = expandedMemberIds.has(m.id);
    const isCurrentUser = m.id === currentUserId;
    const canManageMember = isCurAdmin || isCurrentUser;

    memberTasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      return a.deadline.localeCompare(b.deadline);
    });

    const card = document.createElement('div');
    card.id = `member-card-${m.id}`;
    card.className = `rounded-2xl border transition shadow-sm overflow-hidden bg-white ${
      isCurrentUser 
        ? 'ring-2 ring-blue-500/40 border-blue-500' 
        : (isExpanded ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200/80 hover:border-slate-300')
    }`;

    const headerEditBtn = canManageMember ? `
      <button onclick="event.stopPropagation(); openEditMemberModal('${m.id}')" 
        class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition" 
        title="${isCurAdmin && !isCurrentUser ? '팀원 관리 및 삭제 (총괄 관리자)' : '내 프로필 및 역할 수정'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
      </button>
    ` : '';

    const headerHtml = `
      <div onclick="toggleMemberDropdown('${m.id}')" 
        class="p-4 sm:p-4.5 flex items-center justify-between cursor-pointer select-none transition hover:bg-slate-50/70">
        
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-11 h-11 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center text-2xl shrink-0 shadow-xs relative">
            ${m.icon || '👤'}
            ${isCurrentUser ? '<span class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white"></span>' : ''}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm sm:text-base font-extrabold text-slate-900">${m.name}</h3>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${theme.badge} ${theme.text}">
                ${m.title}
              </span>
              ${isCurrentUser ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white font-bold">내 프로필</span>' : ''}
            </div>
            <p class="text-xs text-slate-500 truncate mt-0.5" title="${m.role}">
              ${m.role}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 shrink-0 ml-3">
          <span class="text-xs font-bold px-2.5 py-1 rounded-xl ${pendingCount > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500'}">
            진행중 ${pendingCount}건
          </span>
          ${headerEditBtn}
          <div class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200/80 transition transform ${isExpanded ? 'rotate-180 bg-blue-50 text-blue-600 border-blue-200' : ''}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>
    `;

    let tasksListHtml = '';
    if (memberTasks.length === 0) {
      tasksListHtml = `<div class="py-6 text-center text-slate-400 text-xs">등록된 할 일이 없습니다.</div>`;
    } else {
      tasksListHtml = memberTasks.map(t => {
        const isOverdue = !t.is_completed && t.deadline < todayStr;
        const isToday = !t.is_completed && t.deadline === todayStr;

        let badge = '';
        if (t.is_completed) {
          badge = `<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">완료</span>`;
        } else if (isOverdue) {
          badge = `<span class="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">기한 경과 (${t.deadline})</span>`;
        } else if (isToday) {
          badge = `<span class="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-200">오늘 마감!</span>`;
        } else {
          badge = `<span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">마감: ${t.deadline}</span>`;
        }

        const isTaskOwner = t.member_id === currentUserId;
        const canDeleteTask = isCurAdmin || isTaskOwner;
        const canToggleTask = isCurAdmin || isTaskOwner;

        const taskDeleteBtnHtml = canDeleteTask ? `
          <button onclick="deleteTask('${t.id}')" class="p-1 text-slate-300 hover:text-red-500 rounded transition shrink-0" title="할 일 삭제 (작성자/관리자 전용)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        ` : '';

        return `
          <div class="p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
            t.is_completed ? 'bg-slate-50/60 border-slate-200/60 opacity-60' : 'bg-white border-slate-200/80 hover:border-blue-300'
          }">
            <div class="flex items-start gap-2.5">
              <input type="checkbox" ${t.is_completed ? 'checked' : ''} 
                ${canToggleTask ? '' : 'disabled title="본인 할 일만 체크 가능"'} 
                onchange="toggleTask('${t.id}')" 
                class="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 ${canToggleTask ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}">
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5">
                  ${badge}
                  ${t.priority === 'urgent' && !t.is_completed ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">긴급</span>' : ''}
                </div>
                <p class="text-xs sm:text-sm font-semibold ${t.is_completed ? 'line-through text-slate-400' : 'text-slate-900'}">
                  ${t.title}
                </p>
                ${t.memo ? `<p class="text-[11px] text-slate-500">${t.memo}</p>` : ''}
              </div>
            </div>
            ${taskDeleteBtnHtml}
          </div>
        `;
      }).join('');
    }

    const dropdownRoleEditBtn = canManageMember ? `
      <button onclick="openEditMemberModal('${m.id}')" class="text-blue-600 hover:text-blue-800 font-semibold text-right shrink-0">
        ${isCurAdmin && !isCurrentUser ? '관리자 수정/삭제 &rarr;' : '역할 수정 &rarr;'}
      </button>
    ` : '';

    const canAddTask = isCurAdmin || isCurrentUser;
    const taskFormHtml = canAddTask ? `
      <form onsubmit="handleQuickAddTask(event, '${m.id}')" class="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row items-center gap-2">
        <input type="text" placeholder="${m.name}의 새 할 일 입력..." required 
          class="quick-task-title flex-1 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none">
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <input type="date" value="${formatDate(today)}" required title="마감일"
            class="quick-task-deadline bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <select class="quick-task-priority bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none">
            <option value="urgent">긴급</option>
            <option value="normal" selected>보통</option>
            <option value="low">낮음</option>
          </select>
          <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shrink-0 transition shadow-xs">
            + 등록
          </button>
        </div>
      </form>
    ` : `
      <div class="pt-2 border-t border-slate-200/60 text-center text-[11px] text-slate-400">
        🔒 해당 담당자 또는 총괄 관리자만 새 작업을 등록할 수 있습니다.
      </div>
    `;

    const dropdownHtml = `
      <div class="${isExpanded ? 'block' : 'hidden'} border-t border-slate-100 bg-slate-50/50 p-4 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200/70 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-700">📌 전담 업무:</span>
            <span class="text-slate-600 font-medium">${m.role}</span>
          </div>
          ${dropdownRoleEditBtn}
        </div>

        <div class="space-y-2">
          ${tasksListHtml}
        </div>

        ${taskFormHtml}
      </div>
    `;

    card.innerHTML = headerHtml + dropdownHtml;
    container.appendChild(card);
  });
}

function toggleMemberDropdown(memberId) {
  if (expandedMemberIds.has(memberId)) {
    expandedMemberIds.delete(memberId);
  } else {
    expandedMemberIds.add(memberId);
  }
  renderMembersAccordion();
}

function toggleAllAccordions() {
  const btn = document.getElementById('btn-toggle-all');
  const teamMembers = getTeamMembers();
  if (teamMembers.length === 0) return;
  if (expandedMemberIds.size >= teamMembers.length) {
    expandedMemberIds.clear();
    btn.textContent = "전체 펼치기";
  } else {
    teamMembers.forEach(m => expandedMemberIds.add(m.id));
    btn.textContent = "전체 접기";
  }
  renderMembersAccordion();
}

// In-line Task Add
async function handleQuickAddTask(e, memberId) {
  e.preventDefault();
  if (!currentUserId) {
    alert('로그인 후 업무를 등록하실 수 있습니다.');
    openLoginModal(true);
    return;
  }

  const isCurAdmin = checkIsAdmin();
  if (!isCurAdmin && memberId !== currentUserId) {
    alert('본인의 업무만 등록할 수 있습니다.');
    return;
  }

  const form = e.target;
  const title = form.querySelector('.quick-task-title').value.trim();
  const deadline = form.querySelector('.quick-task-deadline').value || formatDate(today);
  const priority = form.querySelector('.quick-task-priority').value || 'normal';

  if (!title) return;

  const newTask = {
    id: `task-${Date.now()}`,
    member_id: memberId,
    title,
    deadline,
    priority,
    memo: '',
    is_completed: false,
    created_at: new Date().toISOString()
  };

  // 1. Instant optimistic update: add to state & localStorage immediately!
  tasks.unshift(newTask);
  saveLocalState();
  form.reset();

  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();

  // 2. Sync to Supabase in background
  if (supabaseClient) {
    try {
      const dbPayload = {
        id: newTask.id,
        member_id: newTask.member_id,
        title: newTask.title,
        deadline: newTask.deadline,
        priority: newTask.priority,
        memo: '',
        is_completed: false,
        created_at: newTask.created_at
      };
      const { data, error } = await supabaseClient.from('tasks').insert([dbPayload]).select();
      if (error) {
        console.warn('Supabase task insert warning:', error);
      } else if (data && data[0]) {
        const idx = tasks.findIndex(t => t.id === newTask.id);
        if (idx !== -1) {
          tasks[idx] = data[0];
          saveLocalState();
        }
      }
    } catch (err) {
      console.warn('Supabase task sync failed, kept in local state:', err);
    }
  }
}

async function toggleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const isCurAdmin = checkIsAdmin();
  const isOwner = task.member_id === currentUserId;
  if (!isCurAdmin && !isOwner) {
    alert('본인에게 배정된 할 일만 완료 상태를 변경할 수 있습니다.');
    return;
  }

  const newStatus = !task.is_completed;
  task.is_completed = newStatus;
  saveLocalState();

  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();

  if (supabaseClient) {
    try {
      await supabaseClient.from('tasks').update({ is_completed: newStatus }).eq('id', taskId);
    } catch (err) {
      console.warn('Supabase task toggle error:', err);
    }
  }
}

async function deleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  const isCurAdmin = checkIsAdmin();
  const isOwner = task && task.member_id === currentUserId;
  if (!isCurAdmin && !isOwner) {
    alert('본인의 할 일만 삭제할 수 있습니다.');
    return;
  }

  if (!confirm('이 할 일을 삭제하시겠습니까?')) return;
  tasks = tasks.filter(t => t.id !== taskId);
  saveLocalState();

  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();

  if (supabaseClient) {
    try {
      await supabaseClient.from('tasks').delete().eq('id', taskId);
    } catch (err) {
      console.warn('Supabase task delete error:', err);
    }
  }
}

// ==================== EDIT MEMBER MODAL ====================

function openEditMemberModal(memberId) {
  const isCurAdmin = checkIsAdmin();
  if (!isCurAdmin && memberId !== currentUserId) {
    alert('본인의 프로필만 수정할 수 있습니다.');
    return;
  }
  const m = members.find(x => x.id === memberId);
  if (!m) return;
  document.getElementById('edit-member-id').value = m.id;
  document.getElementById('edit-member-title').value = m.title || '';
  document.getElementById('edit-member-name').value = m.name || '';
  document.getElementById('edit-member-role').value = m.role || '';
  document.getElementById('edit-member-icon').value = m.icon || '👤';
  document.getElementById('edit-member-color').value = m.color || 'blue';
  document.getElementById('modal-edit-member-heading').textContent = `${m.name} 정보 및 역할 수정${isCurAdmin && m.id !== currentUserId ? ' (관리자 모드)' : ''}`;

  // Toggle Delete Member button (Visible ONLY to admin for regular members, never for admin itself)
  const delBtn = document.getElementById('btn-delete-member');
  if (delBtn) {
    if (isCurAdmin && m.id !== 'admin-yong' && m.username !== 'yong' && !m.is_admin) {
      delBtn.classList.remove('hidden');
    } else {
      delBtn.classList.add('hidden');
    }
  }

  document.getElementById('edit-member-modal').classList.remove('hidden');
}

function openAddMemberModal() {
  document.getElementById('edit-member-id').value = '';
  document.getElementById('edit-member-title').value = '사원';
  document.getElementById('edit-member-name').value = '새 담당자';
  document.getElementById('edit-member-role').value = '구매 자재 관리 및 발주 지원';
  document.getElementById('edit-member-icon').value = '👤';
  document.getElementById('edit-member-color').value = 'blue';
  document.getElementById('modal-edit-member-heading').textContent = '새 구매 담당자 추가';

  const delBtn = document.getElementById('btn-delete-member');
  if (delBtn) delBtn.classList.add('hidden');

  document.getElementById('edit-member-modal').classList.remove('hidden');
}

function closeEditMemberModal() {
  document.getElementById('edit-member-modal').classList.add('hidden');
  const delBtn = document.getElementById('btn-delete-member');
  if (delBtn) delBtn.classList.add('hidden');
  document.getElementById('edit-member-form').reset();
}

function setEditIcon(icon) {
  document.getElementById('edit-member-icon').value = icon;
}

async function handleSaveMember(e) {
  e.preventDefault();
  const id = document.getElementById('edit-member-id').value;
  const isCurAdmin = checkIsAdmin();
  if (id && !isCurAdmin && id !== currentUserId) {
    alert('본인의 프로필만 수정할 수 있습니다.');
    return;
  }

  const title = document.getElementById('edit-member-title').value.trim();
  const name = document.getElementById('edit-member-name').value.trim();
  const role = document.getElementById('edit-member-role').value.trim();
  const icon = document.getElementById('edit-member-icon').value.trim() || '👤';
  const color = document.getElementById('edit-member-color').value;

  if (id) {
    const m = members.find(x => x.id === id);
    if (m) {
      m.title = title;
      m.name = name;
      m.role = role;
      m.icon = icon;
      m.color = color;
    }
    if (supabaseClient) {
      await supabaseClient.from('members').update({ title, name, role, icon, color }).eq('id', id);
    } else {
      try {
        await fetch(`/api/members/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, name, role, icon, color })
        });
      } catch (err) {
        saveLocalState();
      }
    }
  } else {
    const newM = {
      id: `member-${Date.now()}`,
      name,
      title,
      role,
      icon,
      color,
      order_num: members.length + 1
    };
    members.push(newM);
    expandedMemberIds.add(newM.id);

    if (supabaseClient) {
      await supabaseClient.from('members').insert([newM]);
    } else {
      try {
        await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newM)
        });
      } catch (err) {
        saveLocalState();
      }
    }
  }

  saveLocalState();
  closeEditMemberModal();
  populateCurrentUserSelect();
  populateDirectiveTargetSelect();
  populateCalMemberFilter();
  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();
}

async function handleDeleteMemberClick() {
  const isCurAdmin = checkIsAdmin();
  if (!isCurAdmin) {
    alert('팀원 계정 삭제는 시스템 총괄 관리자만 가능합니다.');
    return;
  }

  const id = document.getElementById('edit-member-id').value;
  if (!id) return;

  const targetMember = members.find(m => m.id === id);
  if (!targetMember) return;

  if (targetMember.id === 'admin-yong' || targetMember.username === 'yong' || targetMember.is_admin) {
    alert('총괄 관리자 계정은 삭제할 수 없습니다.');
    return;
  }

  const confirmMsg = `정말 [${targetMember.name} (${targetMember.title})] 팀원 계정을 영구 삭제하시겠습니까?\n\n※ 해당 팀원에게 등록된 모든 할 일도 함께 삭제됩니다.`;
  if (!confirm(confirmMsg)) return;

  // 1. Remove from local state
  members = members.filter(m => m.id !== id);
  tasks = tasks.filter(t => t.member_id !== id);
  expandedMemberIds.delete(id);

  // If deleted member was current user, clear currentUserId
  if (currentUserId === id) {
    currentUserId = null;
    localStorage.removeItem('enex_current_user_id');
  }

  // 2. Cascade delete from Supabase if connected
  if (supabaseClient) {
    try {
      await supabaseClient.from('tasks').delete().eq('member_id', id);
      await supabaseClient.from('members').delete().eq('id', id);
      console.log('⚡ Member and associated tasks deleted from Supabase:', id);
    } catch (err) {
      console.error('Supabase deletion error:', err);
    }
  } else {
    try {
      await fetch(`/api/members/${id}`, { method: 'DELETE' });
    } catch (err) {
      // ignore
    }
  }

  // 3. Persist local state
  saveLocalState();

  // 4. Close modal and re-render
  closeEditMemberModal();
  renderAll();
  alert(`[${targetMember.name}] 팀원 계정이 성공적으로 삭제되었습니다.`);
}

// ==================== LOGIN & ACCOUNT SWITCHING ====================

function openLoginModal(isRequired = false) {
  renderLoginAccountsList();
  
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('hidden');

  const closeX = document.getElementById('login-close-x');
  const closeBtn = document.getElementById('login-close-btn');

  // If user is not logged in yet, gate the modal (must log in or register before closing)
  if (!currentUserId || isRequired === true) {
    if (closeX) closeX.classList.add('hidden');
    if (closeBtn) closeBtn.classList.add('hidden');
  } else {
    if (closeX) closeX.classList.remove('hidden');
    if (closeBtn) closeBtn.classList.remove('hidden');
  }
}

function closeLoginModal() {
  // If not logged in, absolutely DO NOT allow closing
  if (!currentUserId) {
    return;
  }
  document.getElementById('login-modal').classList.add('hidden');
  const form = document.getElementById('direct-login-form');
  if (form) form.reset();
}

function renderLoginAccountsList() {
  const list = document.getElementById('login-accounts-list');
  if (!list) return;
  list.innerHTML = '';

  // Exclude admin and any legacy demo accounts from the regular members quick-select list
  const regularMembers = getTeamMembers();

  if (regularMembers.length === 0) {
    list.innerHTML = `
      <div class="text-[11px] text-slate-400 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
        등록된 일반 팀원 계정이 없습니다.<br>
        신규 팀원은 아래 <span class="font-bold text-blue-600">[+ 새 팀원 계정 등록]</span>을 눌러 추가하세요.
      </div>
    `;
    return;
  }

  regularMembers.forEach(m => {
    const isCurrent = m.id === currentUserId;
    const theme = COLOR_THEMES[m.color] || COLOR_THEMES.blue;

    const btn = document.createElement('div');
    btn.className = `p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
      isCurrent 
        ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs' 
        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
    }`;
    btn.onclick = () => {
      changeCurrentUser(m.id);
      closeLoginModal();
    };

    btn.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-9 h-9 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center text-xl shrink-0 shadow-xs">
          ${m.icon || '👤'}
        </div>
        <div class="min-w-0 text-left">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-extrabold text-slate-900 text-xs">${m.name}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${theme.badge}">
              ${m.title}
            </span>
            <span class="text-[10px] text-slate-400 font-mono">(@${m.username || m.id.replace('member-', 'user')})</span>
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5" title="${m.role}">
            ${m.role}
          </p>
        </div>
      </div>
      <div class="shrink-0 ml-2">
        ${isCurrent 
          ? '<span class="text-[10px] font-bold text-blue-700 bg-white border border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs">현재 접속중</span>' 
          : '<span class="text-[10px] text-slate-600 bg-slate-100 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg font-semibold transition">접속하기</span>'
        }
      </div>
    `;

    list.appendChild(btn);
  });
}

async function handleDirectLogin(e) {
  e.preventDefault();
  const loginInput = document.getElementById('login-username-input').value.trim();
  const passwordInput = document.getElementById('login-password-input').value.trim();
  const submitBtn = document.getElementById('btn-login-submit');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>로그인 확인 중...</span>';
  }

  // 0. System Admin Verification (ID: yong / PW: 1234)
  if (loginInput.toLowerCase() === 'yong') {
    if (passwordInput !== '1234') {
      alert('비밀번호가 일치하지 않습니다.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>로그인하기</span>';
      }
      return;
    }
    let admin = members.find(m => m.username === 'yong' || m.id === 'admin-yong');
    if (!admin) {
      admin = JSON.parse(JSON.stringify(ADMIN_USER));
      members.unshift(admin);
      saveLocalState();
    }
    changeCurrentUser(admin.id);
    closeLoginModal();
    alert('👑 시스템 총괄 관리자로 인증되었습니다.\n우측 상단에 [⚙️ Supabase 연동] 관리 버튼이 활성화되었습니다.');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>로그인하기</span>';
    }
    return;
  }

  const fullEmail = loginInput.includes('@') ? loginInput : `${loginInput}@enex.co.kr`;

  // 1. Try Supabase Auth first if connected
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: fullEmail,
        password: passwordInput
      });

      if (!error && data?.session?.user) {
        await fetchSupabaseData();
        let member = members.find(m => m.id === data.user.id || (m.email && m.email.toLowerCase() === data.user.email.toLowerCase()));
        if (!member) {
          const meta = data.user.user_metadata || {};
          member = {
            id: data.user.id,
            email: data.user.email,
            username: meta.username || data.user.email.split('@')[0],
            name: meta.name || data.user.email.split('@')[0],
            title: meta.title || '사원',
            role: meta.role || '구매 관리 및 발주 담당',
            icon: meta.icon || '🧑‍💼',
            color: meta.color || 'blue',
            order_num: members.length + 1
          };
          members.push(member);
          try { await supabaseClient.from('members').upsert([member]); } catch (e) {}
        }
        changeCurrentUser(member.id);
        closeLoginModal();
        alert(`🔑 [${member.name} ${member.title}] 님 환영합니다!\nSupabase 클라우드 실시간 인증으로 로그인되었습니다.`);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>로그인하기</span>';
        }
        return;
      }
    } catch (err) {
      console.warn('Supabase auth attempt:', err);
    }
  }

  // 2. Demo accounts or Local match fallback
  const target = members.find(m => 
    (m.username && m.username.toLowerCase() === loginInput.toLowerCase()) || 
    (m.email && m.email.toLowerCase() === fullEmail.toLowerCase()) ||
    (m.id && m.id.toLowerCase() === loginInput.toLowerCase()) ||
    (m.name && m.name.toLowerCase() === loginInput.toLowerCase())
  );

  if (target) {
    if (target.password && target.password !== passwordInput) {
      alert('비밀번호가 일치하지 않습니다.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>로그인하기</span>';
      }
      return;
    }
    changeCurrentUser(target.id);
    closeLoginModal();
    alert(`🔑 [${target.name} ${target.title}] 계정으로 접속되었습니다.`);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>로그인하기</span>';
    }
    return;
  }

  alert(`'${loginInput}' 계정을 찾을 수 없거나 비밀번호가 일치하지 않습니다.\n신규 팀원이시라면 아래 [+ 새 팀원 계정 등록]을 눌러 가입해 주세요.`);
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>로그인하기</span>';
  }
}

async function handleLogout() {
  if (!confirm('로그아웃하시겠습니까?')) return;
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {}
  }
  sessionStorage.removeItem('enex_current_user_id');
  localStorage.removeItem('enex_current_user_id');
  currentUserId = null;
  renderAll();
  openLoginModal(true);
}

// ==================== REGISTER NEW MEMBER (AUTO ORG-CHART ADDITION) ====================

function openRegisterModal() {
  document.getElementById('register-modal').classList.remove('hidden');
}

function closeRegisterModal() {
  document.getElementById('register-modal').classList.add('hidden');
  const form = document.getElementById('register-form');
  if (form) form.reset();
  if (!currentUserId) {
    openLoginModal(true);
  }
}

function setRegIcon(icon) {
  const el = document.getElementById('reg-icon');
  if (el) el.value = icon;
}

async function handleRegisterUser(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const title = document.getElementById('reg-title').value.trim();
  const role = document.getElementById('reg-role').value.trim();
  const rawUsername = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const icon = document.getElementById('reg-icon').value.trim() || '🧑‍💼';
  const color = document.getElementById('reg-color').value || 'blue';

  const username = rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername;
  const fullEmail = rawUsername.includes('@') ? rawUsername : `${rawUsername}@enex.co.kr`;

  if (password.length < 6) {
    alert('비밀번호는 보안을 위해 최소 6자리 이상 입력해 주세요.');
    return;
  }

  // Check if username/email already exists locally
  if (members.some(m => (m.username && m.username.toLowerCase() === username.toLowerCase()) || (m.email && m.email.toLowerCase() === fullEmail.toLowerCase()))) {
    alert(`이미 등록된 아이디/이메일입니다: ${rawUsername}\n로그인 창에서 비밀번호를 입력해 접속해 주세요.`);
    closeRegisterModal();
    openLoginModal();
    return;
  }

  // 1. Supabase Auth Real Sign Up if connected
  if (supabaseClient) {
    try {
      const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
        email: fullEmail,
        password: password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name, title, role, icon, color, username }
        }
      });

      if (authErr) {
        if (authErr.message.toLowerCase().includes('already registered')) {
          alert(`이미 등록된 계정입니다 (${fullEmail}).\n로그인 창에서 비밀번호를 입력해 접속해 주세요.`);
          closeRegisterModal();
          openLoginModal();
          return;
        }
        alert('Supabase Auth 가입 오류: ' + authErr.message);
        return;
      }

      const newId = authData.user ? authData.user.id : `member-${Date.now()}`;
      const newMember = {
        id: newId,
        username,
        email: fullEmail,
        password,
        name,
        title,
        role,
        icon,
        color,
        order_num: members.length + 1,
        created_at: new Date().toISOString()
      };

      // Add to public.members in Supabase
      await supabaseClient.from('members').upsert([newMember]);

      // Add initial onboarding task
      const welcomeTask = {
        id: `task-${Date.now()}`,
        member_id: newId,
        title: `${name} ${title} 신규 업무 인수인계 및 부서 관제 시스템 등록`,
        deadline: formatDate(today),
        priority: 'urgent',
        memo: '구매본부 자재 ERP 접속 권한 승인 및 담당 품목 단가표 숙지',
        is_completed: false,
        created_at: new Date().toISOString()
      };
      await supabaseClient.from('tasks').insert([welcomeTask]);

      // Refresh memory & UI
      members = members.filter(m => m.id !== newId);
      members.push(newMember);
      tasks.unshift(welcomeTask);
      expandedMemberIds.add(newId);
      currentUserId = newId;
      sessionStorage.setItem('enex_current_user_id', newId);
      localStorage.removeItem('enex_current_user_id');
      saveLocalState();

      closeRegisterModal();
      renderAll();

      if (authData.session) {
        alert(`🎉 [${name} ${title}] 님의 계정이 Supabase Auth 보안 인증으로 생성되었습니다!\n구매부 조직도에 자동 추가되었으며 즉시 로그인되었습니다.`);
      } else {
        alert(`🎉 [${name} ${title}] 님의 계정이 등록되어 구매부 조직도에 추가되었습니다!\n(Supabase 기본 설정에 따라 메일 인증이 켜져 있을 수 있습니다. 즉시 로그인을 원하시면 Supabase 대시보드 > Authentication > Providers > Email에서 'Confirm email'을 OFF로 설정해 주세요)`);
      }

      setTimeout(() => {
        const cardEl = document.getElementById(`member-card-${newId}`);
        if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return;
    } catch (err) {
      console.error('Supabase signup error:', err);
    }
  }

  // 2. Offline / Local fallback registration
  const newId = `member-${Date.now()}`;
  const newMember = {
    id: newId,
    username,
    email: fullEmail,
    password,
    name,
    title,
    role,
    icon,
    color,
    order_num: members.length + 1,
    created_at: new Date().toISOString()
  };

  members.push(newMember);
  expandedMemberIds.add(newId);

  const welcomeTask = {
    id: `task-${Date.now()}`,
    member_id: newId,
    title: `${name} ${title} 신규 업무 인수인계 및 부서 관제 시스템 등록`,
    deadline: formatDate(today),
    priority: 'urgent',
    memo: '구매본부 자재 ERP 접속 권한 승인 및 담당 품목 단가표 숙지',
    is_completed: false,
    created_at: new Date().toISOString()
  };
  tasks.unshift(welcomeTask);

  saveLocalState();
  currentUserId = newId;
  sessionStorage.setItem('enex_current_user_id', newId);
  localStorage.removeItem('enex_current_user_id');
  closeRegisterModal();
  renderAll();

  alert(`🎉 [${name} ${title}] 계정이 생성되어 구매부 조직도에 자동 추가되었습니다!\n현재 [${name}] 계정으로 즉시 로그인되었습니다.`);
  setTimeout(() => {
    const cardEl = document.getElementById(`member-card-${newId}`);
    if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

// ==================== SECTION 3: BOTTOM CALENDAR ====================

function populateCalMemberFilter() {
  const sel = document.getElementById('cal-member-filter');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">전체 팀원 마감일</option>';
  const teamMembers = getTeamMembers();
  teamMembers.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.title})`;
    sel.appendChild(opt);
  });
  sel.value = currentVal || 'all';
}

function handleCalMemberFilter(val) {
  calMemberFilter = val;
  renderCalendar();
}

function renderCalendar() {
  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  document.getElementById('cal-month-title').textContent = `${year}년 ${month + 1}월`;

  const daysContainer = document.getElementById('calendar-days');
  daysContainer.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = "min-h-[90px] rounded-xl bg-slate-50/50 border border-slate-100/50";
    daysContainer.appendChild(empty);
  }

  const todayStr = formatDate(today);

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    let dayTasks = tasks.filter(t => t.deadline === dateStr);
    if (calMemberFilter !== 'all') {
      dayTasks = dayTasks.filter(t => t.member_id === calMemberFilter);
    }

    const isTodayDate = dateStr === todayStr;
    const isSelected = selectedCalDate === dateStr;
    const pendingTasks = dayTasks.filter(t => !t.is_completed);

    const cell = document.createElement('div');
    cell.className = `min-h-[90px] p-2 rounded-xl border flex flex-col justify-between transition cursor-pointer relative ${
      isSelected 
        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20' 
        : isTodayDate 
          ? 'bg-amber-50/40 border-amber-300' 
          : dayTasks.length > 0 
            ? 'bg-white border-slate-200 hover:border-blue-300' 
            : 'bg-white/60 border-slate-100 hover:bg-slate-50'
    }`;

    cell.onclick = () => toggleCalDateFilter(dateStr);

    let dayClass = 'text-slate-700';
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0) dayClass = 'text-red-500 font-bold';
    if (dayOfWeek === 6) dayClass = 'text-blue-500 font-bold';

    let tasksBadgesHtml = '';
    if (dayTasks.length > 0) {
      tasksBadgesHtml = '<div class="space-y-1 mt-1">';
      const maxShow = 2;
      dayTasks.slice(0, maxShow).forEach(t => {
        const m = members.find(x => x.id === t.member_id) || { name: '미지정', color: 'blue', icon: '📌' };
        const theme = COLOR_THEMES[m.color] || COLOR_THEMES.blue;

        tasksBadgesHtml += `
          <div class="px-1.5 py-0.5 rounded text-[10px] truncate border flex items-center gap-1 ${
            t.is_completed ? 'bg-slate-100 text-slate-400 line-through border-slate-200' : `${theme.pill} font-semibold`
          }" title="${m.name}: ${t.title}">
            <span class="shrink-0">${m.icon}</span>
            <span class="truncate">${t.title}</span>
          </div>
        `;
      });

      if (dayTasks.length > maxShow) {
        tasksBadgesHtml += `<div class="text-[9px] text-slate-400 font-bold pl-1">+ ${dayTasks.length - maxShow}건 더보기</div>`;
      }
      tasksBadgesHtml += '</div>';
    }

    cell.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="text-xs ${dayClass}">${day}</span>
          ${isTodayDate ? '<span class="text-[9px] bg-amber-200 text-amber-900 px-1 rounded font-bold">오늘</span>' : ''}
        </div>
        ${tasksBadgesHtml}
      </div>
      ${pendingTasks.length > 0 ? `
        <div class="text-right pt-1">
          <span class="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">${pendingTasks.length}건 마감</span>
        </div>
      ` : ''}
    `;

    daysContainer.appendChild(cell);
  }

  const banner = document.getElementById('cal-filter-banner');
  if (selectedCalDate) {
    banner.classList.remove('hidden');
    banner.classList.add('flex');
    document.getElementById('cal-filter-date-text').textContent = selectedCalDate;
  } else {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  }
}

function changeMonth(delta) {
  calViewDate.setMonth(calViewDate.getMonth() + delta);
  renderCalendar();
}

function goToToday() {
  calViewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedCalDate = formatDate(today);
  renderCalendar();
  renderMembersAccordion();
}

function toggleCalDateFilter(dateStr) {
  if (selectedCalDate === dateStr) {
    selectedCalDate = null;
  } else {
    selectedCalDate = dateStr;
    tasks.filter(t => t.deadline === dateStr).forEach(t => expandedMemberIds.add(t.member_id));
  }
  renderCalendar();
  renderMembersAccordion();
}

function clearDateFilter() {
  selectedCalDate = null;
  renderCalendar();
  renderMembersAccordion();
}

function openSupabaseModal() {
  const url = localStorage.getItem('supabase_url') || 'https://lnilzitmifivbhauepac.supabase.co';
  const key = localStorage.getItem('supabase_anon_key') || '';
  const urlEl = document.getElementById('supabase-url-input');
  const keyEl = document.getElementById('supabase-key-input');
  if (urlEl) urlEl.value = url;
  if (keyEl && key) keyEl.value = key;
  document.getElementById('supabase-modal').classList.remove('hidden');
}
function closeSupabaseModal() {
  document.getElementById('supabase-modal').classList.add('hidden');
}

// Initial Run
document.addEventListener('DOMContentLoaded', () => {
  fetchInitialData();
});
