-- GoTrue scans these columns into non-nullable Go strings, so a hand-inserted
-- auth.users row with NULLs makes every sign-in fail with
-- "Database error querying schema". Empty string is the value GoTrue writes
-- itself; NULL is only ever produced by manual inserts like our seed.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where id = '11111111-1111-1111-1111-111111111111';
