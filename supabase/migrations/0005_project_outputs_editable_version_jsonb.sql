create or replace function public.try_parse_jsonb(input text)
returns jsonb
language plpgsql
as $$
begin
  return input::jsonb;
exception
  when others then
    return null;
end;
$$;

alter table public.project_outputs
alter column editable_version type jsonb
using (
  case
    when editable_version is null or btrim(editable_version) = '' then null
    when public.try_parse_jsonb(editable_version) is not null then public.try_parse_jsonb(editable_version)
    else jsonb_build_object(
      'manual_edit_content', editable_version,
      'saved_at', null
    )
  end
);

drop function if exists public.try_parse_jsonb(text);
