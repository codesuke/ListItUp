# Platform Operator Backend Boundary

ListItUp will model Platform Operator as a backend-enforced role distinct from Workspace roles. The existing application may host the initial internal security surface, but authorization and security-event APIs must not depend on that UI so a separate staff web client can be introduced later; public web and Android clients never expose operator capabilities.
