-- The roster import (D, docs/architecture.md §13) drops a roster_state row when a position loses a
-- holder or a club leaves the source. roster_state is its bookkeeping table and holds no history, so
-- the app role may delete from it. Every other table keeps no DELETE grant.
grant delete on roster_state to trojanops_app;
