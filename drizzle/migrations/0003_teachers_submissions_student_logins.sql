CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'registrar'))
$$;

-- Teachers
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  username text UNIQUE,
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  grade int NOT NULL CHECK (grade BETWEEN 9 AND 12),
  section text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, grade, section)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_classes TO authenticated;
GRANT ALL ON public.teacher_classes TO service_role;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_teacher_of(_user_id uuid, _grade int, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_classes tc
    JOIN public.teachers t ON t.id = tc.teacher_id
    WHERE t.user_id = _user_id AND tc.grade = _grade AND tc.section = _section
  ) AND public.has_role(_user_id, 'teacher')
$$;

CREATE POLICY "Admins manage teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff read teachers" ON public.teachers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Admins manage teacher classes" ON public.teacher_classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Read teacher classes" ON public.teacher_classes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid()));

-- Result submissions (teacher -> admin)
CREATE TABLE public.result_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade int NOT NULL CHECK (grade BETWEEN 9 AND 12),
  section text NOT NULL,
  semester int NOT NULL CHECK (semester IN (1, 2)),
  academic_year text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'returned')),
  note text NOT NULL DEFAULT '',
  admin_note text NOT NULL DEFAULT '',
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade, section, semester, academic_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_submissions TO authenticated;
GRANT ALL ON public.result_submissions TO service_role;
ALTER TABLE public.result_submissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER result_submissions_touch BEFORE UPDATE ON public.result_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Staff read submissions" ON public.result_submissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_teacher_of(auth.uid(), grade, section));
CREATE POLICY "Admins manage submissions" ON public.result_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers send results" ON public.result_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_of(auth.uid(), grade, section) AND status = 'submitted' AND submitted_by = auth.uid());
CREATE POLICY "Teachers resend returned results" ON public.result_submissions FOR UPDATE TO authenticated
  USING (public.is_teacher_of(auth.uid(), grade, section) AND status = 'returned')
  WITH CHECK (public.is_teacher_of(auth.uid(), grade, section) AND status = 'submitted' AND submitted_by = auth.uid());

-- Teacher access to students and marks
CREATE OR REPLACE FUNCTION public.teacher_reads_marks(_user_id uuid, _student_id uuid, _grade int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id AND s.grade = _grade AND public.is_teacher_of(_user_id, s.grade, s.section)
  )
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_mark(_user_id uuid, _student_id uuid, _grade int, _semester int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id AND s.grade = _grade AND public.is_teacher_of(_user_id, s.grade, s.section)
      AND NOT EXISTS (
        SELECT 1 FROM public.result_submissions r
        WHERE r.grade = s.grade AND r.section = s.section AND r.semester = _semester
          AND r.academic_year = (SELECT current_academic_year FROM public.school_settings WHERE id = 1)
          AND r.status IN ('submitted', 'approved')
      )
  )
$$;

CREATE POLICY "Teachers read class students" ON public.students FOR SELECT TO authenticated
  USING (public.is_teacher_of(auth.uid(), grade, section));
CREATE POLICY "Teachers read class marks" ON public.marks FOR SELECT TO authenticated
  USING (public.teacher_reads_marks(auth.uid(), student_id, grade));
CREATE POLICY "Teachers add class marks" ON public.marks FOR INSERT TO authenticated
  WITH CHECK (public.teacher_can_mark(auth.uid(), student_id, grade, semester));
CREATE POLICY "Teachers edit class marks" ON public.marks FOR UPDATE TO authenticated
  USING (public.teacher_can_mark(auth.uid(), student_id, grade, semester))
  WITH CHECK (public.teacher_can_mark(auth.uid(), student_id, grade, semester));
CREATE POLICY "Teachers delete class marks" ON public.marks FOR DELETE TO authenticated
  USING (public.teacher_can_mark(auth.uid(), student_id, grade, semester));
CREATE POLICY "Teachers read subjects" ON public.subjects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Teachers read settings" ON public.school_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'));

-- Student result logins
CREATE OR REPLACE FUNCTION public.gen_student_password()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  result text := '';
  i int;
BEGIN
  FOR i IN 0..5 LOOP
    result := result || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.student_logins (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  password text NOT NULL DEFAULT public.gen_student_password(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.student_logins TO authenticated;
GRANT ALL ON public.student_logins TO service_role;
ALTER TABLE public.student_logins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read student logins" ON public.student_logins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins reset student logins" ON public.student_logins FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER student_logins_touch BEFORE UPDATE ON public.student_logins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.student_logins (student_id) VALUES (NEW.id) ON CONFLICT (student_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_student_created AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_student();

INSERT INTO public.student_logins (student_id) SELECT id FROM public.students ON CONFLICT DO NOTHING;