
create type public.app_role as enum ('admin', 'registrar');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "Own profile readable" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Own profile editable" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Read own roles or admin reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins grant roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins revoke roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

-- New user: profile + first account becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated-at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- School settings (single row)
create table public.school_settings (
  id int primary key default 1 check (id = 1),
  school_name text not null default 'Burka Harbu Special Secondary School',
  school_name_local text not null default 'Mana Barumsa Addaa Burqa Harbuu Sadarkaa Lammaffaa',
  principal_name text not null default '',
  registrar_name text not null default '',
  current_academic_year text not null default '2019 E.C.',
  pass_mark numeric(5,2) not null default 50 check (pass_mark between 0 and 100),
  updated_at timestamptz not null default now()
);
grant select, update on public.school_settings to authenticated;
grant all on public.school_settings to service_role;
alter table public.school_settings enable row level security;
create policy "Staff read settings" on public.school_settings for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Admins update settings" on public.school_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger school_settings_touch before update on public.school_settings
  for each row execute function public.touch_updated_at();
insert into public.school_settings (id) values (1);

-- Students
create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null,
  gender text not null check (gender in ('M', 'F')),
  date_of_birth date,
  admission_number text,
  admission_date date,
  photo_path text,
  grade int not null check (grade between 9 and 12),
  section text not null default 'A',
  stream text check (stream in ('natural', 'social')),
  academic_year text not null default '',
  status text not null default 'active' check (status in ('active', 'graduated', 'transferred')),
  verification_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_class_idx on public.students (grade, section, stream);
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;
create policy "Staff read students" on public.students for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff add students" on public.students for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff edit students" on public.students for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete students" on public.students for delete to authenticated using (public.is_staff(auth.uid()));
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

-- Subjects
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  grades int[] not null default '{9,10,11,12}',
  streams text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
create policy "Staff read subjects" on public.subjects for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admins add subjects" on public.subjects for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins edit subjects" on public.subjects for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete subjects" on public.subjects for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.subjects (code, name, grades, streams, sort_order) values
  ('ENG', 'English', '{9,10,11,12}', '{}', 1),
  ('AFO', 'Afan Oromo', '{9,10,11,12}', '{}', 2),
  ('AMH', 'Amharic', '{9,10,11,12}', '{}', 3),
  ('MATH', 'Mathematics', '{9,10,11,12}', '{}', 4),
  ('PHY', 'Physics', '{9,10,11,12}', '{natural}', 5),
  ('CHEM', 'Chemistry', '{9,10,11,12}', '{natural}', 6),
  ('BIO', 'Biology', '{9,10,11,12}', '{natural}', 7),
  ('TD', 'Technical Drawing', '{11,12}', '{natural}', 8),
  ('GEO', 'Geography', '{9,10,11,12}', '{social}', 9),
  ('HIST', 'History', '{9,10,11,12}', '{social}', 10),
  ('ECON', 'Economics', '{9,10,11,12}', '{social}', 11),
  ('ICT', 'Information Technology', '{9,10,11,12}', '{}', 12),
  ('CIV', 'Civics & Ethical Education', '{9,10,11,12}', '{}', 13),
  ('HPE', 'Health & Physical Education', '{9,10,11,12}', '{}', 14);

-- Marks
create table public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  grade int not null check (grade between 9 and 12),
  semester int not null check (semester in (1, 2)),
  academic_year text not null default '',
  score numeric(5,2) not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, grade, semester)
);
create index marks_student_idx on public.marks (student_id, grade);
grant select, insert, update, delete on public.marks to authenticated;
grant all on public.marks to service_role;
alter table public.marks enable row level security;
create policy "Staff read marks" on public.marks for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff add marks" on public.marks for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff edit marks" on public.marks for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete marks" on public.marks for delete to authenticated using (public.is_staff(auth.uid()));
create trigger marks_touch before update on public.marks
  for each row execute function public.touch_updated_at();

-- Cumulative averages (semester avg -> annual avg -> cumulative avg), RLS applies
create or replace function public.cumulative_averages()
returns table (student_id uuid, cumulative_average numeric, years_count int)
language sql stable security invoker set search_path = public as $$
  with sem as (
    select m.student_id, m.grade, m.semester, avg(m.score) a from public.marks m group by 1, 2, 3
  ), ann as (
    select s.student_id, s.grade, avg(s.a) a from sem s group by 1, 2
  )
  select ann.student_id, round(avg(ann.a), 2), count(*)::int from ann group by 1
$$;
grant execute on function public.cumulative_averages() to authenticated;

-- Public transcript verification: only minimal fields for a valid token
create or replace function public.verify_transcript(_token uuid)
returns table (
  full_name text, student_code text, gender text, status text, stream text,
  grades_covered int[], cumulative_average numeric, school_name text
)
language sql stable security definer set search_path = public as $$
  with st as (select * from public.students where verification_token = _token),
  sem as (
    select m.grade, m.semester, avg(m.score) a from public.marks m join st on st.id = m.student_id group by 1, 2
  ), ann as (select grade, avg(a) a from sem group by 1)
  select st.full_name, st.student_code, st.gender, st.status, st.stream,
    coalesce((select array_agg(grade order by grade) from ann), '{}'),
    (select round(avg(a), 2) from ann),
    (select school_name from public.school_settings where id = 1)
  from st
$$;
revoke all on function public.verify_transcript(uuid) from public;
grant execute on function public.verify_transcript(uuid) to anon, authenticated;
