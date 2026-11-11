-- =========================================================
-- ENEX 구매부 대시보드 Supabase 데이터베이스 스키마
-- Supabase 대시보드 > SQL Editor에 복사하여 실행하시면 됩니다.
-- =========================================================

-- 1. 조직원 테이블 (members)
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL,
    icon TEXT DEFAULT '👤',
    color TEXT DEFAULT 'blue',
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 할 일 & 마감일 테이블 (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    deadline DATE NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
    memo TEXT,
    is_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 지시사항 테이블 (directives)
CREATE TABLE IF NOT EXISTS public.directives (
    id TEXT PRIMARY KEY,
    issuer_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
    target_id TEXT NOT NULL, -- 'all' 또는 member_id
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'urgent' CHECK (priority IN ('urgent', 'normal', 'request')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 실시간 동기화(Supabase Realtime) 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.directives;

-- 5. RLS (Row Level Security) 설정
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write directives" ON public.directives FOR ALL USING (true) WITH CHECK (true);

-- 6. 초기 샘플 데이터 입력 (Seed Data)
INSERT INTO public.members (id, name, title, role, icon, color, order_num) VALUES
('member-1', '김차장', '차장', '원자재 총괄 (PB · MDF 원판 수급 및 단가계약)', '👔', 'indigo', 1),
('member-2', '이과장', '과장', '하드웨어 (힌지 · 레일 · 서랍재 단가협상)', '🔩', 'amber', 2),
('member-3', '박대리', '대리', '빌트인 가전 · 기기 (후드 · 쿡탑 · 싱크볼 OEM)', '🍳', 'blue', 3),
('member-4', '최대리', '대리', '외주가공 · 포장물류 (도어 UV도장 · 완충재)', '📦', 'purple', 4),
('member-5', '정주임', '주임', 'ERP 전표 · 마감정산 (세금계산서 대조 및 정산)', '📑', 'emerald', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (id, member_id, title, deadline, priority, memo, is_completed) VALUES
('task-1', 'member-1', '한솔홈데코 18T PB 원판 4분기 공급단가 재계약 품의', CURRENT_DATE + INTERVAL '3 days', 'urgent', '전분기 대비 3.2% 인상 요구 건 방어 협상안 포함', false),
('task-2', 'member-1', '2027년도 주방가구 원자재 수급 계획안 본부장 보고', CURRENT_DATE + INTERVAL '7 days', 'normal', '아산 1공장 생산 케파 증설 계획안 반영', false),
('task-3', 'member-2', '헤펠레 댐핑 힌지 독일 선적 지연 확인 및 대체품 발주', CURRENT_DATE + INTERVAL '1 day', 'urgent', '문성하드웨어 국내 재고 1,500set 긴급 차입 발주', false),
('task-4', 'member-2', '블룸 서랍 레일 시스템 신제품 단가 비교표 작성', CURRENT_DATE + INTERVAL '5 days', 'normal', '에넥스 프리미엄 키친 라인업 적용 검토', false),
('task-5', 'member-3', '하츠 침니후드 4분기 정기 발주서 발행 (420대)', CURRENT_DATE + INTERVAL '2 days', 'urgent', '생산일정 맞춰 아산공장 직송 요청', false),
('task-6', 'member-3', 'SK매직 3구 인덕션 안성물류센터 입고 검수 일정 조율', CURRENT_DATE + INTERVAL '4 days', 'normal', '불량률 0% 확인 및 ERP 전표 처리 예정', false),
('task-7', 'member-4', '아산공장 완충재 및 파렛트 11월분 정기 발주', CURRENT_DATE + INTERVAL '1 day', 'normal', '월말 성수기 대비 20% 추가 확보', false),
('task-8', 'member-4', '우진목재 도어 UV도장 외주가공 단가 인상 요청 건 실사', CURRENT_DATE + INTERVAL '6 days', 'urgent', '페인트 원자재 인상분 근거 서류 현장 대조', false),
('task-9', 'member-5', '10월 마감 협력사 세금계산서 대조 및 전표 회계팀 이관', CURRENT_DATE, 'urgent', '오늘 18:00 마감 전표 최종 확인 필요', false),
('task-10', 'member-5', '신규 거래처(대성목재) ERP 등록 및 서류 취합', CURRENT_DATE + INTERVAL '3 days', 'normal', '사업자등록증, 통장사본 승인 완료 후 코드 발급', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.directives (id, issuer_id, target_id, title, content, priority, status) VALUES
('dir-1', 'member-1', 'member-2', '헤펠레 댐핑 힌지 선적 지연 대체 수배 결과 즉시 보고', '아산 키친 라인 멈추지 않도록 문성하드웨어 재고 1,500세트 내일 오전 중 입고 확약서 수령 후 보고할 것.', 'urgent', 'pending'),
('dir-2', 'member-1', 'all', '4분기 협력사 공급단가 인상 요청 건 일체 임의 수용 금지', '원가분석표 사전 검토 없이 구두 합의 절대 불가. 원가 상승분 세부 증빙 서류 필수 징구하여 팀장 결재 득할 것.', 'urgent', 'completed'),
('dir-3', 'member-1', 'member-5', '10월 마감 협력사 단가 차액 전표 17:00까지 수정 이관', '한솔홈데코 단가 차액 발생 건 계산서 수정 발행 요청 완료되었는지 확인 후 결과 회신 요망.', 'urgent', 'pending')
ON CONFLICT (id) DO NOTHING;
