// State Management
let members = [];
let tasks = [];
let directives = [];
let currentUserId = 'member-1';
let expandedMemberIds = new Set();
let selectedCalDate = null;
let calMemberFilter = 'all';
let isDirectivesFeedOpen = false;

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

// Default Seed Data (used when local/cloud database is initially empty)
const DEFAULT_MEMBERS = [
  { id: "member-1", username: "kim", password: "1234", name: "김차장", title: "차장", role: "원자재 총괄 (PB · MDF 원판 수급 및 단가계약)", icon: "👔", color: "indigo", order_num: 1 },
  { id: "member-2", username: "lee", password: "1234", name: "이과장", title: "과장", role: "하드웨어 (힌지 · 레일 · 서랍재 단가협상)", icon: "🔩", color: "amber", order_num: 2 },
  { id: "member-3", username: "park", password: "1234", name: "박대리", title: "대리", role: "빌트인 가전 · 기기 (후드 · 쿡탑 · 싱크볼 OEM)", icon: "🍳", color: "blue", order_num: 3 },
  { id: "member-4", username: "choi", password: "1234", name: "최대리", title: "대리", role: "외주가공 · 포장물류 (도어 UV도장 · 완충재)", icon: "📦", color: "purple", order_num: 4 },
  { id: "member-5", username: "jung", password: "1234", name: "정주임", title: "주임", role: "ERP 전표 · 마감정산 (세금계산서 대조 및 정산)", icon: "📑", color: "emerald", order_num: 5 }
];

const DEFAULT_TASKS = [
  { id: "task-1", member_id: "member-1", title: "한솔홈데코 18T PB 원판 4분기 공급단가 재계약 품의", deadline: formatDate(new Date(Date.now() + 3 * 86400000)), priority: "urgent", memo: "전분기 대비 3.2% 인상 요구 건 방어 협상안 포함", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-2", member_id: "member-1", title: "2027년도 주방가구 원자재 수급 계획안 본부장 보고", deadline: formatDate(new Date(Date.now() + 7 * 86400000)), priority: "normal", memo: "아산 1공장 생산 케파 증설 계획안 반영", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-3", member_id: "member-2", title: "헤펠레 댐핑 힌지 독일 선적 지연 확인 및 대체품 발주", deadline: formatDate(new Date(Date.now() + 1 * 86400000)), priority: "urgent", memo: "문성하드웨어 국내 재고 1,500set 긴급 차입 발주", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-4", member_id: "member-2", title: "블룸 서랍 레일 시스템 신제품 단가 비교표 작성", deadline: formatDate(new Date(Date.now() + 5 * 86400000)), priority: "normal", memo: "에넥스 프리미엄 키친 라인업 적용 검토", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-5", member_id: "member-3", title: "하츠 침니후드 4분기 정기 발주서 발행 (420대)", deadline: formatDate(new Date(Date.now() + 2 * 86400000)), priority: "urgent", memo: "생산일정 맞춰 아산공장 직송 요청", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-6", member_id: "member-3", title: "SK매직 3구 인덕션 안성물류센터 입고 검수 일정 조율", deadline: formatDate(new Date(Date.now() + 4 * 86400000)), priority: "normal", memo: "불량률 0% 확인 및 ERP 전표 처리 예정", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-7", member_id: "member-4", title: "아산공장 완충재 및 파렛트 11월분 정기 발주", deadline: formatDate(new Date(Date.now() + 1 * 86400000)), priority: "normal", memo: "월말 성수기 대비 20% 추가 확보", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-8", member_id: "member-4", title: "우진목재 도어 UV도장 외주가공 단가 인상 요청 건 실사", deadline: formatDate(new Date(Date.now() + 6 * 86400000)), priority: "urgent", memo: "페인트 원자재 인상분 근거 서류 현장 대조", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-9", member_id: "member-5", title: "10월 마감 협력사 세금계산서 대조 및 전표 회계팀 이관", deadline: formatDate(today), priority: "urgent", memo: "오늘 18:00 마감 전표 최종 확인 필요", is_completed: false, created_at: new Date().toISOString() },
  { id: "task-10", member_id: "member-5", title: "신규 거래처(대성목재) ERP 등록 및 서류 취합", deadline: formatDate(new Date(Date.now() + 3 * 86400000)), priority: "normal", memo: "사업자등록증, 통장사본 승인 완료 후 코드 발급", is_completed: false, created_at: new Date().toISOString() }
];

const DEFAULT_DIRECTIVES = [
  { id: "dir-1", issuer_id: "member-1", target_id: "member-2", title: "헤펠레 댐핑 힌지 선적 지연 대체 수배 결과 즉시 보고", content: "아산 키친 라인 멈추지 않도록 문성하드웨어 재고 1,500세트 내일 오전 중 입고 확약서 수령 후 보고할 것.", priority: "urgent", status: "pending", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "dir-2", issuer_id: "member-1", target_id: "all", title: "4분기 협력사 공급단가 인상 요청 건 일체 임의 수용 금지", content: "원가분석표 사전 검토 없이 구두 합의 절대 불가. 원가 상승분 세부 증빙 서류 필수 징구하여 팀장 결재 득할 것.", priority: "urgent", status: "completed", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "dir-3", issuer_id: "member-1", target_id: "member-5", title: "10월 마감 협력사 단가 차액 전표 17:00까지 수정 이관", content: "한솔홈데코 단가 차액 발생 건 계산서 수정 발행 요청 완료되었는지 확인 후 결과 회신 요망.", priority: "urgent", status: "pending", created_at: new Date(Date.now() - 7200000).toISOString() }
];

// ==================== SUPABASE INITIALIZATION ====================

function initSupabase() {
  const url = localStorage.getItem('supabase_url');
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

      const statusEl = document.getElementById('supabase-conn-status');
      if (statusEl) {
        statusEl.textContent = '🟢 Supabase 클라우드 실시간 연결됨';
        statusEl.className = 'text-[11px] text-emerald-600 font-bold';
      }
      return true;
    } catch (e) {
      console.error('Supabase init error:', e);
    }
  }
  return false;
}

async function fetchSupabaseData() {
  if (!supabaseClient) return false;
  try {
    const [mRes, tRes, dRes] = await Promise.all([
      supabaseClient.from('members').select('*').order('order_num', { ascending: true }),
      supabaseClient.from('tasks').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('directives').select('*').order('created_at', { ascending: false })
    ]);

    if (mRes.data && mRes.data.length > 0) members = mRes.data;
    if (tRes.data) tasks = tRes.data;
    if (dRes.data) directives = dRes.data;

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
  const savedUser = localStorage.getItem('enex_current_user_id');
  if (savedUser && members.some(m => m.id === savedUser)) {
    currentUserId = savedUser;
  } else if (members.length > 0) {
    currentUserId = members[0].id;
  }
  expandedMemberIds.add(currentUserId);

  populateCurrentUserSelect();
  populateDirectiveTargetSelect();
  populateCalMemberFilter();

  renderMyActionSection();
  renderDirectivesFeed();
  renderMembersAccordion();
  renderCalendar();
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem('enex_dashboard_v3_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.members) && parsed.members.length > 0) {
        members = parsed.members;
        tasks = parsed.tasks || [];
        directives = parsed.directives || [];

        // Ensure usernames and passwords exist for default members
        members.forEach(m => {
          if (!m.username) {
            const def = DEFAULT_MEMBERS.find(d => d.id === m.id);
            if (def) {
              m.username = def.username;
              m.password = def.password;
            } else {
              m.username = m.id.replace('member-', 'user');
              m.password = '1234';
            }
          }
        });
        return;
      }
    }
  } catch (e) {}

  // Defaults if nothing in storage
  members = JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
  tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  directives = JSON.parse(JSON.stringify(DEFAULT_DIRECTIVES));
  saveLocalState();
}

function saveLocalState() {
  try {
    localStorage.setItem('enex_dashboard_v3_state', JSON.stringify({
      members, tasks, directives, currentUserId
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
  sel.value = currentUserId;
}

function changeCurrentUser(newId) {
  currentUserId = newId;
  localStorage.setItem('enex_current_user_id', newId);
  expandedMemberIds.add(newId);

  renderMyActionSection();
  renderDirectivesFeed();
  renderMembersAccordion();
  renderCalendar();
}

function renderMyActionSection() {
  const curMember = members.find(m => m.id === currentUserId) || { name: '사용자', title: '담당자', icon: '👤', color: 'blue' };
  const todayStr = formatDate(today);

  // Update Top Global Header User Badge
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');
  if (headerAvatar) headerAvatar.textContent = curMember.icon || '👤';
  if (headerName) headerName.textContent = `${curMember.name} (${curMember.title})`;

  document.getElementById('my-profile-greeting').textContent = `환영합니다, ${curMember.name} ${curMember.title}님!`;
  document.getElementById('my-profile-avatar').textContent = curMember.icon || '👤';
  document.getElementById('my-profile-summary').textContent = `현재 [${curMember.name}] 계정으로 접속 중입니다. 오늘 확인할 긴급 지시사항 및 마감 할 일입니다.`;

  const myDirectives = directives.filter(d => d.target_id === currentUserId || d.target_id === 'all');
  const myPendingDirectives = myDirectives.filter(d => d.status !== 'completed');

  document.getElementById('my-directives-count').textContent = `${myPendingDirectives.length}건 대기`;
  const dirContainer = document.getElementById('my-directives-list');
  dirContainer.innerHTML = '';

  if (myDirectives.length === 0) {
    dirContainer.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">나에게 수신된 지시사항이 없습니다.</p>`;
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

    const card = document.createElement('div');
    card.className = `p-3.5 rounded-xl border bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
      isCompleted ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-blue-300 shadow-2xs'
    }`;

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
        <button onclick="toggleDirectiveStatus('${d.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
          isCompleted 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
        }">
          ${isCompleted ? '✓ 처리 완료됨' : '처리 확인'}
        </button>
        <button onclick="deleteDirective('${d.id}')" class="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition" title="삭제">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

function populateDirectiveTargetSelect() {
  const sel = document.getElementById('directive-target-select');
  if (!sel) return;
  sel.innerHTML = '<option value="all">전체 공지 (구매부 전원)</option>';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.title} - ${m.role.substring(0, 18)}...)`;
    sel.appendChild(opt);
  });
}

function openDirectiveModal() {
  const curMember = members.find(m => m.id === currentUserId) || { name: '김차장', title: '차장' };
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
  const issuer_id = currentUserId;
  const target_id = document.getElementById('directive-target-select').value;
  const title = document.getElementById('directive-title').value.trim();
  const content = document.getElementById('directive-content').value.trim();
  const priority = document.getElementById('directive-priority').value;

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

  // Supabase save
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('directives').insert([newDir]).select();
      if (!error && data) {
        directives.unshift(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    // API or local fallback
    try {
      const res = await fetch('/api/directives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDir)
      });
      if (res.ok) {
        const created = await res.json();
        directives.unshift(created);
      } else {
        directives.unshift(newDir);
        saveLocalState();
      }
    } catch (err) {
      directives.unshift(newDir);
      saveLocalState();
    }
  }

  closeDirectiveModal();
  if (!isDirectivesFeedOpen) toggleDirectivesFeed();

  renderMyActionSection();
  renderDirectivesFeed();
}

async function toggleDirectiveStatus(dirId) {
  const directive = directives.find(d => d.id === dirId);
  if (!directive) return;

  const newStatus = directive.status === 'completed' ? 'pending' : 'completed';
  directive.status = newStatus;

  renderMyActionSection();
  renderDirectivesFeed();

  if (supabaseClient) {
    await supabaseClient.from('directives').update({ status: newStatus }).eq('id', dirId);
  } else {
    try {
      await fetch(`/api/directives/${dirId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      saveLocalState();
    }
  }
}

async function deleteDirective(dirId) {
  if (!confirm('이 지시사항을 삭제하시겠습니까?')) return;
  directives = directives.filter(d => d.id !== dirId);
  renderMyActionSection();
  renderDirectivesFeed();

  if (supabaseClient) {
    await supabaseClient.from('directives').delete().eq('id', dirId);
  } else {
    try {
      await fetch(`/api/directives/${dirId}`, { method: 'DELETE' });
    } catch (err) {
      saveLocalState();
    }
  }
}

// ==================== SECTION 2: MEMBERS ACCORDION ====================

function renderMembersAccordion() {
  const container = document.getElementById('members-accordion-container');
  container.innerHTML = '';
  members.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  const todayStr = formatDate(today);

  members.forEach(m => {
    const theme = COLOR_THEMES[m.color] || COLOR_THEMES.blue;
    let memberTasks = tasks.filter(t => t.member_id === m.id);

    if (selectedCalDate) {
      memberTasks = memberTasks.filter(t => t.deadline === selectedCalDate);
    }

    const pendingCount = memberTasks.filter(t => !t.is_completed).length;
    const isExpanded = expandedMemberIds.has(m.id);
    const isCurrentUser = m.id === currentUserId;

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
          <button onclick="event.stopPropagation(); openEditMemberModal('${m.id}')" 
            class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition" title="담당자 및 역할 수정">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
          </button>
          <div class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200/80 transition transform ${isExpanded ? 'rotate-180 bg-blue-50 text-blue-600 border-blue-200' : ''}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>
    `;

    let tasksListHtml = '';
    if (memberTasks.length === 0) {
      tasksListHtml = `<div class="py-6 text-center text-slate-400 text-xs">등록된 할 일이 없습니다. 아래에서 새 작업을 추가해 보세요.</div>`;
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

        return `
          <div class="p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
            t.is_completed ? 'bg-slate-50/60 border-slate-200/60 opacity-60' : 'bg-white border-slate-200/80 hover:border-blue-300'
          }">
            <div class="flex items-start gap-2.5">
              <input type="checkbox" ${t.is_completed ? 'checked' : ''} onchange="toggleTask('${t.id}')" 
                class="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600">
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
            <button onclick="deleteTask('${t.id}')" class="p-1 text-slate-300 hover:text-red-500 rounded transition shrink-0" title="삭제">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        `;
      }).join('');
    }

    const dropdownHtml = `
      <div class="${isExpanded ? 'block' : 'hidden'} border-t border-slate-100 bg-slate-50/50 p-4 space-y-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200/70 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-700">📌 전담 업무:</span>
            <span class="text-slate-600 font-medium">${m.role}</span>
          </div>
          <button onclick="openEditMemberModal('${m.id}')" class="text-blue-600 hover:text-blue-800 font-semibold text-right shrink-0">
            역할 수정 &rarr;
          </button>
        </div>

        <div class="space-y-2">
          ${tasksListHtml}
        </div>

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
  if (expandedMemberIds.size === members.length) {
    expandedMemberIds.clear();
    btn.textContent = "전체 펼치기";
  } else {
    members.forEach(m => expandedMemberIds.add(m.id));
    btn.textContent = "전체 접기";
  }
  renderMembersAccordion();
}

// In-line Task Add
async function handleQuickAddTask(e, memberId) {
  e.preventDefault();
  const form = e.target;
  const title = form.querySelector('.quick-task-title').value.trim();
  const deadline = form.querySelector('.quick-task-deadline').value;
  const priority = form.querySelector('.quick-task-priority').value;

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

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('tasks').insert([newTask]).select();
      if (!error && data) tasks.unshift(data[0]);
    } catch (err) {
      tasks.unshift(newTask);
    }
  } else {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        const created = await res.json();
        tasks.unshift(created);
      } else {
        tasks.unshift(newTask);
        saveLocalState();
      }
    } catch (err) {
      tasks.unshift(newTask);
      saveLocalState();
    }
  }

  form.reset();
  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();
}

async function toggleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const newStatus = !task.is_completed;
  task.is_completed = newStatus;

  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();

  if (supabaseClient) {
    await supabaseClient.from('tasks').update({ is_completed: newStatus }).eq('id', taskId);
  } else {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: newStatus })
      });
    } catch (err) {
      saveLocalState();
    }
  }
}

async function deleteTask(taskId) {
  if (!confirm('이 할 일을 삭제하시겠습니까?')) return;
  tasks = tasks.filter(t => t.id !== taskId);
  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();

  if (supabaseClient) {
    await supabaseClient.from('tasks').delete().eq('id', taskId);
  } else {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      saveLocalState();
    }
  }
}

// ==================== EDIT MEMBER MODAL ====================

function openEditMemberModal(memberId) {
  const m = members.find(x => x.id === memberId);
  if (!m) return;
  document.getElementById('edit-member-id').value = m.id;
  document.getElementById('edit-member-title').value = m.title || '';
  document.getElementById('edit-member-name').value = m.name || '';
  document.getElementById('edit-member-role').value = m.role || '';
  document.getElementById('edit-member-icon').value = m.icon || '👤';
  document.getElementById('edit-member-color').value = m.color || 'blue';
  document.getElementById('modal-edit-member-heading').textContent = `${m.name} 정보 및 역할 수정`;
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
  document.getElementById('edit-member-modal').classList.remove('hidden');
}

function closeEditMemberModal() {
  document.getElementById('edit-member-modal').classList.add('hidden');
  document.getElementById('edit-member-form').reset();
}

function setEditIcon(icon) {
  document.getElementById('edit-member-icon').value = icon;
}

async function handleSaveMember(e) {
  e.preventDefault();
  const id = document.getElementById('edit-member-id').value;
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

  closeEditMemberModal();
  populateCurrentUserSelect();
  populateDirectiveTargetSelect();
  populateCalMemberFilter();
  renderMyActionSection();
  renderMembersAccordion();
  renderCalendar();
}

// ==================== LOGIN & ACCOUNT SWITCHING ====================

function openLoginModal() {
  renderLoginAccountsList();
  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
  const form = document.getElementById('direct-login-form');
  if (form) form.reset();
}

function renderLoginAccountsList() {
  const list = document.getElementById('login-accounts-list');
  if (!list) return;
  list.innerHTML = '';

  members.forEach(m => {
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

function handleDirectLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username-input').value.trim().toLowerCase();
  const passwordInput = document.getElementById('login-password-input').value.trim();

  const target = members.find(m => 
    (m.username && m.username.toLowerCase() === usernameInput) || 
    (m.id && m.id.toLowerCase() === usernameInput) ||
    (m.name && m.name.toLowerCase() === usernameInput)
  );

  if (!target) {
    alert(`'${usernameInput}' 아이디에 해당하는 직원을 찾을 수 없습니다.\n빠른 계정 선택 목록을 확인해 주세요.`);
    return;
  }

  if (target.password && target.password !== passwordInput) {
    alert('비밀번호가 일치하지 않습니다. (기본 비밀번호: 1234)');
    return;
  }

  changeCurrentUser(target.id);
  closeLoginModal();
}

// ==================== REGISTER NEW MEMBER (AUTO ORG-CHART ADDITION) ====================

function openRegisterModal() {
  document.getElementById('register-modal').classList.remove('hidden');
}

function closeRegisterModal() {
  document.getElementById('register-modal').classList.add('hidden');
  const form = document.getElementById('register-form');
  if (form) form.reset();
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
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim() || '1234';
  const icon = document.getElementById('reg-icon').value.trim() || '🧑‍💼';
  const color = document.getElementById('reg-color').value || 'blue';

  // Check if username already exists
  if (members.some(m => m.username && m.username.toLowerCase() === username.toLowerCase())) {
    alert(`이미 등록된 로그인 아이디입니다: ${username}\n다른 아이디를 지정해 주세요.`);
    return;
  }

  const newId = `member-${Date.now()}`;
  const newMember = {
    id: newId,
    username,
    password,
    name,
    title,
    role,
    icon,
    color,
    order_num: members.length + 1,
    created_at: new Date().toISOString()
  };

  // 1. Add to local members array
  members.push(newMember);
  expandedMemberIds.add(newId);

  // 2. Generate initial onboarding welcome task for this newly registered member
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

  // 3. Supabase Cloud Sync
  if (supabaseClient) {
    try {
      await supabaseClient.from('members').insert([newMember]);
      await supabaseClient.from('tasks').insert([welcomeTask]);
      console.log('⚡ Supabase member & task inserted:', newMember);
    } catch (err) {
      console.warn('Supabase member insert failed:', err);
    }
  } else {
    // Local server API
    try {
      await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      });
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(welcomeTask)
      });
    } catch (e) {}
  }

  // 4. Save to Local Storage
  saveLocalState();

  // 5. Switch logged-in user to this new member
  currentUserId = newId;
  localStorage.setItem('enex_current_user_id', newId);

  // 6. Close Modal & Re-render all views
  closeRegisterModal();
  renderAll();

  // 7. Notification & scroll into view
  alert(`🎉 [${name} ${title}] 님의 계정이 생성되어 구매부 조직도에 자동 추가되었습니다!\n현재 [${name}] 계정으로 즉시 로그인되었습니다.`);
  setTimeout(() => {
    const cardEl = document.getElementById(`member-card-${newId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 200);
}

// ==================== SECTION 3: BOTTOM CALENDAR ====================

function populateCalMemberFilter() {
  const sel = document.getElementById('cal-member-filter');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">전체 팀원 마감일</option>';
  members.forEach(m => {
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
  document.getElementById('supabase-modal').classList.remove('hidden');
}
function closeSupabaseModal() {
  document.getElementById('supabase-modal').classList.add('hidden');
}

// Initial Run
document.addEventListener('DOMContentLoaded', () => {
  fetchInitialData();
});
