-- Migration 035: Add INSERT, UPDATE, DELETE RLS policies for document_lines

DROP POLICY IF EXISTS document_lines_insert ON public.document_lines;
CREATE POLICY document_lines_insert ON public.document_lines
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS document_lines_update ON public.document_lines;
CREATE POLICY document_lines_update ON public.document_lines
  FOR UPDATE TO authenticated, anon
  USING (
    company_id = public.get_user_company_id()
    OR company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.company_id = public.get_user_company_id()
    )
  );

DROP POLICY IF EXISTS document_lines_delete ON public.document_lines;
CREATE POLICY document_lines_delete ON public.document_lines
  FOR DELETE TO authenticated, anon
  USING (
    company_id = public.get_user_company_id()
    OR company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_id
      AND d.company_id = public.get_user_company_id()
    )
  );

GRANT ALL ON public.document_lines TO authenticated, anon;
