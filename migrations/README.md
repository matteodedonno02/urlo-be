Place your SQL migration files here. Files must end with `.sql` and are applied in alphabetical order on application startup.

Each migration runs inside a transaction. MySQL auto-commits DDL (CREATE/ALTER/DROP), so DDL changes cannot be rolled back by the transaction itself; to revert them on failure, provide an inverse "down" script in the `down/` subfolder with the same filename (e.g. `down/0001_create_short_urls.sql`). The down script is executed only when the migration fails, and only if present — it is optional for pure-DML migrations, which are fully covered by the transaction.
