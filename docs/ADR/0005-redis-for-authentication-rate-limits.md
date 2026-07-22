# Redis for Authentication Rate Limits

ListItUp will use the available Redis service for durable, shared authentication rate-limit and temporary security-control state. Redis supplies atomic counters with TTLs across all application instances; this avoids Better Auth's in-memory defaults and keeps high-churn attempt tracking out of Postgres.
