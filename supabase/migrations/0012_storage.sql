-- ===========================================================================
-- 0012_storage.sql — Supabase Storage bucket'lari ve nesne politikalari
-- ===========================================================================
-- Bucket'lar yerel yiginda supabase/config.toml ile olusur; bulut projesinde
-- ise bu dosya onlari kendisi ekler. Bu yuzden hepsi `on conflict do nothing`.
--
-- Tum dosya `storage` semasi yoksa sessizce gecilecek sekilde korunuyor:
-- migration'lar storage eklentisi olmayan sade bir Postgres uzerinde de
-- calisabilmeli. Politikalar `execute` ile calistiriliyor cunku `storage.objects`
-- derleme aninda mevcut olmayabilir.
--
-- Not: RLS'i biz acmiyoruz — storage.objects uzerinde RLS zaten Supabase
-- tarafindan aciktir (yerel shim de aciyor).
-- ===========================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage semasi bulunamadi, depolama politikalari atlandi.';
    return;
  end if;

  -- Bucket'lar ------------------------------------------------------------
  -- videos: imzali URL ile servis edilir, bu yuzden public degil.
  -- question-images / avatars: CDN uzerinden dogrudan okunur, public.
  -- help-uploads: ogrencinin gonderdigi soru fotografi, gizli.
  insert into storage.buckets (id, name, public)
  values
    ('videos', 'videos', false),
    ('question-images', 'question-images', true),
    ('help-uploads', 'help-uploads', false),
    ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects bulunamadi, nesne politikalari atlandi.';
    return;
  end if;

  -- =======================================================================
  -- videos — ozel
  -- =======================================================================
  -- Ogrenciye ham nesne uzerinde select verilmez; oynatma icin sunucu
  -- tarafinda uretilen sureli imzali URL kullanilir. Yalnizca editor/admin
  -- dogrudan listeleyebilir.
  execute $p$
    drop policy if exists videos_select_editor on storage.objects;
    create policy videos_select_editor on storage.objects
      for select to authenticated
      using (bucket_id = 'videos' and public.is_editor());
  $p$;

  execute $p$
    drop policy if exists videos_insert_editor on storage.objects;
    create policy videos_insert_editor on storage.objects
      for insert to authenticated
      with check (bucket_id = 'videos' and public.is_editor());
  $p$;

  execute $p$
    drop policy if exists videos_update_editor on storage.objects;
    create policy videos_update_editor on storage.objects
      for update to authenticated
      using (bucket_id = 'videos' and public.is_editor())
      with check (bucket_id = 'videos' and public.is_editor());
  $p$;

  execute $p$
    drop policy if exists videos_delete_editor on storage.objects;
    create policy videos_delete_editor on storage.objects
      for delete to authenticated
      using (bucket_id = 'videos' and public.is_editor());
  $p$;

  -- =======================================================================
  -- question-images — herkese acik okuma, editor yazma
  -- =======================================================================
  execute $p$
    drop policy if exists question_images_select_all on storage.objects;
    create policy question_images_select_all on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'question-images');
  $p$;

  execute $p$
    drop policy if exists question_images_insert_editor on storage.objects;
    create policy question_images_insert_editor on storage.objects
      for insert to authenticated
      with check (bucket_id = 'question-images' and public.is_editor());
  $p$;

  execute $p$
    drop policy if exists question_images_update_editor on storage.objects;
    create policy question_images_update_editor on storage.objects
      for update to authenticated
      using (bucket_id = 'question-images' and public.is_editor())
      with check (bucket_id = 'question-images' and public.is_editor());
  $p$;

  execute $p$
    drop policy if exists question_images_delete_editor on storage.objects;
    create policy question_images_delete_editor on storage.objects
      for delete to authenticated
      using (bucket_id = 'question-images' and public.is_editor());
  $p$;

  -- =======================================================================
  -- help-uploads — kendi klasorun + ogretmen/admin okumasi
  -- =======================================================================
  -- Dosya yolu kurali: `<user_id>/<dosya_adi>`. Bu yuzden ilk klasor adi
  -- cagiranin kullanici kimligine esit olmali.
  execute $p$
    drop policy if exists help_uploads_select_own_or_staff on storage.objects;
    create policy help_uploads_select_own_or_staff on storage.objects
      for select to authenticated
      using (
        bucket_id = 'help-uploads'
        and (
          (storage.foldername(name))[1] = (select auth.uid())::text
          or public.is_teacher()
          or public.is_admin()
        )
      );
  $p$;

  execute $p$
    drop policy if exists help_uploads_insert_own on storage.objects;
    create policy help_uploads_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'help-uploads'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  -- Gonderilen soru fotografi kanit niteligindedir: guncelleme/silme yalnizca
  -- admin tarafindan yapilabilir.
  execute $p$
    drop policy if exists help_uploads_delete_admin on storage.objects;
    create policy help_uploads_delete_admin on storage.objects
      for delete to authenticated
      using (bucket_id = 'help-uploads' and public.is_admin());
  $p$;

  -- =======================================================================
  -- avatars — herkese acik okuma, kendi klasorune yazma
  -- =======================================================================
  execute $p$
    drop policy if exists avatars_select_all on storage.objects;
    create policy avatars_select_all on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'avatars');
  $p$;

  execute $p$
    drop policy if exists avatars_insert_own on storage.objects;
    create policy avatars_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    drop policy if exists avatars_update_own on storage.objects;
    create policy avatars_update_own on storage.objects
      for update to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    drop policy if exists avatars_delete_own on storage.objects;
    create policy avatars_delete_own on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

exception
  when undefined_table or undefined_function or insufficient_privilege then
    raise notice 'storage politikalari uygulanamadi (%), atlandi.', sqlerrm;
end
$$;
