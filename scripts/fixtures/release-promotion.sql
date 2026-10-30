-- Dev-only RPC integration checks. Every release/feed change is rolled back.
do $$
declare
  identity jsonb := jsonb_build_object('version', '999999.0.0', 'build', '999999',
    'filename', 'CacheDrop-999999.0.0.dmg', 'length', 3, 'sha256', repeat('a',64),
    'releaseNotesSHA256', repeat('b',64), 'bundleID', 'com.patrickbourget.CacheDrop', 'teamID', '8F5K2ZRP5T');
  next_identity jsonb;
  refused boolean;
  field text;
  xml text := '<rss/>';
  digest text := encode(sha256(convert_to('<rss/>','UTF8')),'hex');
begin
  begin
  for field in select unnest(array['version','build','filename','length','sha256','releaseNotesSHA256','bundleID','teamID']) loop
    refused := false;
    begin perform public.promote_staged_release(identity - field);
    exception when others then refused := true; end;
    if not refused then raise exception 'missing identity field accepted: %', field; end if;
  end loop;
  refused := false;
  begin perform public.promote_release_feed(identity, xml, digest);
  exception when others then refused := true; end;
  if not refused then raise exception 'feed advanced before website latest'; end if;
  perform public.promote_staged_release(identity);
  perform public.promote_staged_release(identity);
  if (select count(*) from public.releases where version='999999.0.0') <> 1 then raise exception 'retry duplicated release'; end if;
  refused := false;
  begin perform public.promote_staged_release(identity || jsonb_build_object('sha256',repeat('c',64)));
  exception when others then refused := true; end;
  if not refused then raise exception 'different bytes replaced same version'; end if;
  refused := false;
  begin perform public.promote_staged_release(identity || jsonb_build_object('version','999998.0.0','filename','CacheDrop-999998.0.0.dmg','build','1000000'));
  exception when others then refused := true; end;
  if not refused then raise exception 'decreasing version accepted'; end if;
  refused := false;
  next_identity := identity || jsonb_build_object('version','999999.0.1','filename','CacheDrop-999999.0.1.dmg');
  begin perform public.promote_staged_release(next_identity);
  exception when others then refused := true; end;
  if not refused then raise exception 'non-increasing build accepted'; end if;
  perform public.promote_release_feed(identity, xml, digest);
  perform public.promote_release_feed(identity, xml, digest);
  refused := false;
  begin perform public.promote_release_feed(identity, '<changed/>', encode(sha256(convert_to('<changed/>','UTF8')),'hex'));
  exception when others then refused := true; end;
  if not refused then raise exception 'same version feed was replaced'; end if;
  next_identity := next_identity || jsonb_build_object('build','1000000');
  perform public.promote_staged_release(next_identity);
  refused := false;
  begin perform public.promote_release_feed(identity, xml, digest);
  exception when others then refused := true; end;
  if not refused then raise exception 'old retry regressed feed after website advanced'; end if;
  perform public.promote_release_feed(next_identity, xml, digest);
  if (select count(*) from public.releases where version in ('999999.0.0','999999.0.1')) <> 2 then raise exception 'earlier release disappeared'; end if;
  refused := false;
  begin update public.releases set sha256=repeat('d',64) where version='999999.0.0';
  exception when others then refused := true; end;
  if not refused then raise exception 'published identity was mutable'; end if;
  refused := false;
  begin perform public.publish_release('999999.0.2','CacheDrop-999999.0.2.dmg',3,repeat('e',64));
  exception when others then refused := true; end;
  if not refused then raise exception 'legacy publisher bypassed signed promotion'; end if;
  -- Roll back every fixture change while returning success from this single SQL statement.
  raise exception 'fixture rollback' using errcode = 'ZX518';
  exception when sqlstate 'ZX518' then null;
  end;
end;
$$;
