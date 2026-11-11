-- =========================================================
-- ENEX 구매부 대시보드 Supabase 데이터베이스 스키마
-- Supabase 대시보드 > SQL Editor에 복사하여 실행하시면 됩니다.
-- =========================================================

-- 1. 조직원 테이블 (members)
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT,
    password TEXT DEFAULT '1234',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    role TEXT NOT NULL,
    icon TEXT DEFAULT '👤',
    color TEXT DEFAULT 'blue',
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 기존 테이블이 이미 생성되어 있을 경우를 대비한 컬럼 추가
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '1234';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

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

-- 6. 초기 관리자 계정 등록 (Admin Seed Data)
INSERT INTO public.members (id, username, email, password, name, title, role, icon, color, order_num, is_admin) VALUES
('admin-yong', 'yong', 'yong@enex.co.kr', '1234', '시스템 총괄 관리자', '총괄관리자', '구매본부 시스템 총괄 및 클라우드 DB/인증 관리', '👑', 'indigo', 1, true)
ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password = EXCLUDED.password, is_admin = true;
