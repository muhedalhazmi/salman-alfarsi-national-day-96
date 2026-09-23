-- صلاحيات لوحة الإدارة لحساب واحد فقط
-- لا تحذف سياسات المشاركات الحالية؛ هذه سياسات إضافية للإدارة.

alter table public.submissions enable row level security;

grant select, update, delete on public.submissions to authenticated;

drop policy if exists "admin can read all submissions" on public.submissions;
create policy "admin can read all submissions"
on public.submissions
for select
to authenticated
using ((select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com');

drop policy if exists "admin can update submissions" on public.submissions;
create policy "admin can update submissions"
on public.submissions
for update
to authenticated
using ((select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com');

drop policy if exists "admin can delete submissions" on public.submissions;
create policy "admin can delete submissions"
on public.submissions
for delete
to authenticated
using ((select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com');

-- إذا كان Bucket submissions خاصًا، تسمح هذه السياسة للإدارة
-- بمعاينة الملفات وحذفها من لوحة الإدارة.
grant select, delete on storage.objects to authenticated;

drop policy if exists "admin can read submission files" on storage.objects;
create policy "admin can read submission files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'submissions'
  and (select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com'
);

drop policy if exists "admin can delete submission files" on storage.objects;
create policy "admin can delete submission files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'submissions'
  and (select auth.jwt() ->> 'email') = 'muhedalhazmi@gmail.com'
);
