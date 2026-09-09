-- ---------------------------------------------------------------------------
-- Zamanlanmis isler (pg_cron).
--
-- Bu dosya TOLERANSLIDIR: pg_cron her ortamda bulunmaz. Uzanti yoksa
-- migration hata vermez, yalnizca bir notice birakir. Boylece ayni SQL hem
-- Supabase'de (pg_cron mevcut) hem yerel dogrulama kosumunda (mevcut degil)
-- calisir.
--
-- SAAT DILIMI: pg_cron ifadeleri UTC'dir. Turkiye kalici olarak UTC+3'tur
-- (2016'dan beri yaz saati uygulanmaz), bu yuzden istenen Turkiye saatinden
-- 3 saat CIKARILIR. Gun asimi olan islerde gun alani da kayar:
--   Pazar 03:00 TR  -> Cumartesi 24:00 = Pazar 00:00 UTC  -> '0 0 * * 0'
--   Pazartesi 02:00 TR -> Pazar 23:00 UTC                 -> '0 23 * * 0'
--
-- TETIKLEME: her is, CRON_SECRET ile korunan bir Next.js rotasini cagirir.
-- pg_net varsa dogrudan HTTP cagrisi yapilir; yoksa is kaydi olusturulur ama
-- cagri yapilmaz — bu durumda rotalar disaridan bir zamanlayici (Vercel Cron,
-- GitHub Actions, sistem cron) ile tetiklenmelidir. Iki yol da desteklenir;
-- uretimde hangisinin kullanildigi altyapi tercihidir.
-- ---------------------------------------------------------------------------

do $$
declare
  has_cron boolean;
  has_net boolean;
  app_url text;
  cron_secret text;
  job record;

  -- Is tanimlari: (ad, cron ifadesi UTC, rota, aciklama)
  jobs constant text[][] := array[
    ['zihin-weekly-plans',       '0 0 * * 0',  '/api/cron/weekly-plans',
     'Haftalik calisma programi uretimi — Pazar 03:00 TR'],
    ['zihin-mastery-snapshot',   '0 23 * * 0', '/api/cron/mastery-snapshot',
     'Haftalik yetkinlik anlik goruntusu — Pazartesi 02:00 TR'],
    ['zihin-parent-summary',     '0 5 * * 1',  '/api/cron/parent-summary',
     'Veli haftalik ozeti — Pazartesi 08:00 TR'],
    ['zihin-daily-reminders',    '0 6 * * *',  '/api/cron/reminders',
     'Bekleyen hafiza karti hatirlatmasi — her gun 09:00 TR'],
    ['zihin-subscription-warn',  '0 7 * * *',  '/api/cron/subscription-warnings',
     'Bitisi yaklasan abonelik uyarisi — her gun 10:00 TR']
  ];
begin
  select exists (select 1 from pg_available_extensions where name = 'pg_cron')
    into has_cron;

  if not has_cron then
    raise notice 'pg_cron mevcut degil, zamanlanmis isler atlandi. Rotalari disaridan tetikleyin.';
    return;
  end if;

  create extension if not exists pg_cron;

  select exists (select 1 from pg_available_extensions where name = 'pg_net')
    into has_net;

  if has_net then
    create extension if not exists pg_net with schema extensions;
  else
    raise notice 'pg_net mevcut degil; isler zamanlanacak ama HTTP cagrisi yapilmayacak.';
  end if;

  -- Uygulama adresi ve cron sirri veritabani ayarlarindan okunur. Supabase'de:
  --   alter database postgres set app.settings.app_url = 'https://...';
  --   alter database postgres set app.settings.cron_secret = '...';
  -- Anahtarlarin SQL dosyasina gomulmemesi icin bu yol secildi.
  app_url := coalesce(current_setting('app.settings.app_url', true), '');
  cron_secret := coalesce(current_setting('app.settings.cron_secret', true), '');

  if app_url = '' or cron_secret = '' then
    raise notice
      'app.settings.app_url / app.settings.cron_secret tanimli degil; isler zamanlandi ama cagri govdesi bos kalacak.';
  end if;

  for job in select jobs[i][1] as name, jobs[i][2] as schedule,
                    jobs[i][3] as route, jobs[i][4] as description
               from generate_series(1, array_length(jobs, 1)) as i
  loop
    -- Yeniden calistirilabilirlik: ayni adli is varsa once kaldirilir.
    perform cron.unschedule(job.name)
      where exists (select 1 from cron.job where jobname = job.name);

    if has_net and app_url <> '' then
      perform cron.schedule(
        job.name,
        job.schedule,
        format(
          $cmd$select extensions.net.http_post(
                   url := %L,
                   headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'Authorization', 'Bearer ' || %L
                   ),
                   body := '{}'::jsonb
                 );$cmd$,
          app_url || job.route,
          cron_secret
        )
      );
    else
      -- pg_net yoksa is yalnizca kendini kaydeder; gercek isi disaridan
      -- tetiklenen rota yapar. job_runs kaydi izlenebilirlik icin yazilir.
      perform cron.schedule(
        job.name,
        job.schedule,
        format(
          $cmd$insert into public.job_runs (job_name, status, finished_at, metadata)
               values (%L, 'success', now(),
                       jsonb_build_object('note', 'pg_net yok; rota disaridan tetiklenmeli',
                                          'route', %L));$cmd$,
          job.name,
          job.route
        )
      );
    end if;

    raise notice 'zamanlandi: % (%) — %', job.name, job.schedule, job.description;
  end loop;

exception
  when insufficient_privilege then
    raise notice 'pg_cron icin yetki yok, zamanlanmis isler atlandi: %', sqlerrm;
  when others then
    raise notice 'zamanlanmis isler kurulamadi (%), atlandi.', sqlerrm;
end
$$;
