from pydantic import BaseModel


class DashboardSummary(BaseModel):
    active_work_orders: int
    pending_requests: int
    upcoming_pm_schedules: int
