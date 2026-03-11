create table if not exists runs (
  id text primary key,
  title text not null,
  brief text not null,
  status text not null,
  current_shell text not null,
  current_step int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists steps (
  id text primary key,
  run_id text references runs(id),
  order_index int not null,
  skill_name text not null,
  status text not null,
  shell text not null,
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists branches (
  id text primary key,
  run_id text references runs(id),
  name text not null,
  selected boolean not null default false,
  rationale text,
  created_at timestamptz not null default now()
);

create table if not exists artifacts (
  id text primary key,
  run_id text references runs(id),
  branch_id text references branches(id),
  step_id text references steps(id),
  type text not null,
  payload jsonb not null,
  schema_valid boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  run_id text references runs(id),
  type text not null,
  shell text,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists manual_interventions (
  id text primary key,
  run_id text references runs(id),
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
