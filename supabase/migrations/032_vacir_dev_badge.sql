-- 032: Geliştirici rozeti @vacir'e de verilir (bu rozet panelden verilemez). Tekrar çalıştırmak zararsızdır.
insert into public.user_badges (user_id, badge)
  select id, 'dev' from public.profiles where username = 'vacir'
  on conflict do nothing;

select p.username, b.badge from public.user_badges b join public.profiles p on p.id = b.user_id where b.badge = 'dev';
