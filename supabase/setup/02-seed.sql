-- AddaSplit demo seed. Creates one real host account and one shareable bill so
-- the guest flow can be exercised end to end before host publishing exists.
--
--   host login: demo@addasplit.test / demo-password-123
--
-- Safe to re-run: every statement is idempotent.

-- A genuine auth.users row, so the create_profile_after_signup trigger fires
-- and the host can actually sign in from the Expo app.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'demo@addasplit.test',
  crypt('demo-password-123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Neero"}'::jsonb
) on conflict (id) do nothing;

-- Required by GoTrue for email/password sign-in.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@addasplit.test","email_verified":true}'::jsonb,
  'email', now(), now(), now()
) on conflict (provider, provider_id) do nothing;

-- The trigger creates the profile; fill in the payment numbers guests will see.
insert into public.profiles (id, display_name, bkash_number, nagad_number)
values ('11111111-1111-1111-1111-111111111111', 'Neero', '01712345678', '01812345678')
on conflict (id) do update
  set display_name = excluded.display_name,
      bkash_number = excluded.bkash_number,
      nagad_number = excluded.nagad_number;

-- A bill in READY_TO_SHARE, which is the status set_claim requires.
-- Fixed public_token so the demo link is stable: /s/22222222-2222-2222-2222-222222222222
insert into public.splits (
  id, host_user_id, restaurant_name, split_date, status,
  subtotal, vat, service_charge, discount, receipt_total, calculated_total,
  public_token, bkash_number, nagad_number
) values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Sultan''s Dine', current_date, 'READY_TO_SHARE',
  1400, 110, 70, 0, 1580, 1580,
  '22222222-2222-2222-2222-222222222222', '01712345678', '01812345678'
) on conflict (id) do update
  set status = 'READY_TO_SHARE',
      vat = excluded.vat,
      service_charge = excluded.service_charge,
      receipt_total = excluded.receipt_total;

-- Items totalling 1400: 2×280 + 1×320 + 3×60 + 2×90
insert into public.items (id, split_id, name, quantity, unit_price, sort_order) values
  ('44444444-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Chicken Biryani', 2, 280, 0),
  ('44444444-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Beef Rezala',     1, 320, 1),
  ('44444444-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Coke',            3,  60, 2),
  ('44444444-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Garlic naan',     2,  90, 3)
on conflict (id) do update
  set name = excluded.name, quantity = excluded.quantity, unit_price = excluded.unit_price;
