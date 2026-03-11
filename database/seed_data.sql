insert into runs(id, title, brief, status, current_shell, current_step)
values
('run-1', 'AI launch narrative', 'Launch an orchestrator POC for enterprise marketing leaders.', 'pending', 'Operator', 0),
('run-2', 'Retention campaign', 'Create a campaign to reduce trial churn in 30 days.', 'pending', 'Operator', 0),
('run-3', 'Product update', 'Announce new workflow governance features to existing customers.', 'pending', 'Operator', 0)
on conflict (id) do nothing;

insert into branches(id, run_id, name, selected)
values
('branch-1', 'run-1', 'branch_a', true),
('branch-2', 'run-2', 'branch_a', true),
('branch-3', 'run-3', 'branch_a', true)
on conflict (id) do nothing;
