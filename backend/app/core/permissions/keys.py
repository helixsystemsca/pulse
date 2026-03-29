"""Canonical permission strings — extend without touching business modules.

Convention: ``resource.action`` or ``module.scope``.
"""

# User / org management
USERS_INVITE_WORKER = "users.invite_worker"
USERS_INVITE_MANAGER = "users.invite_manager"
USERS_UPDATE_ROLE = "users.update_role"
USERS_SET_PERMISSIONS = "users.set_permissions"

# Feature modules (coarse-grained; map to routes as needed)
MODULE_TOOL_TRACKING_READ = "module.tool_tracking.read"
MODULE_TOOL_TRACKING_WRITE = "module.tool_tracking.write"
MODULE_INVENTORY_READ = "module.inventory.read"
MODULE_INVENTORY_WRITE = "module.inventory.write"
MODULE_MAINTENANCE_READ = "module.maintenance.read"
MODULE_MAINTENANCE_WRITE = "module.maintenance.write"
MODULE_JOBS_READ = "module.jobs.read"
MODULE_JOBS_WRITE = "module.jobs.write"
MODULE_NOTIFICATIONS_READ = "module.notifications.read"
MODULE_NOTIFICATIONS_WRITE = "module.notifications.write"
MODULE_ANALYTICS_READ = "module.analytics.read"

DEFAULT_MANAGER_ALLOWS: list[str] = [
    MODULE_TOOL_TRACKING_READ,
    MODULE_TOOL_TRACKING_WRITE,
    MODULE_INVENTORY_READ,
    MODULE_INVENTORY_WRITE,
    MODULE_MAINTENANCE_READ,
    MODULE_MAINTENANCE_WRITE,
    MODULE_JOBS_READ,
    MODULE_JOBS_WRITE,
    MODULE_NOTIFICATIONS_READ,
    MODULE_NOTIFICATIONS_WRITE,
    MODULE_ANALYTICS_READ,
    USERS_INVITE_WORKER,
]

DEFAULT_WORKER_ALLOWS: list[str] = [
    MODULE_TOOL_TRACKING_READ,
    MODULE_TOOL_TRACKING_WRITE,
    MODULE_INVENTORY_READ,
    MODULE_MAINTENANCE_READ,
    MODULE_JOBS_READ,
    MODULE_NOTIFICATIONS_READ,
]
