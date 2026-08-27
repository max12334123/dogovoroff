alter table public.matters
  add column next_action_title text,
  add column next_action_description text,
  add column next_action_due_at timestamptz,
  add constraint matters_next_action_title_length
    check (next_action_title is null or char_length(btrim(next_action_title)) between 1 and 240),
  add constraint matters_next_action_description_length
    check (next_action_description is null or char_length(next_action_description) <= 2000),
  add constraint matters_next_action_consistent
    check (
      (next_action_title is null and next_action_description is null and next_action_due_at is null)
      or next_action_title is not null
    );
