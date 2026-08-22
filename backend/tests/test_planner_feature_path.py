"""Feature path map includes the Daily Operations Planner."""

from app.core.features.paths import required_feature_for_path


def test_planner_api_requires_daily_planner_feature() -> None:
    assert required_feature_for_path("/api/v1/planner") == "daily_planner"
    assert required_feature_for_path("/api/v1/planner/day") == "daily_planner"
    assert required_feature_for_path("/api/v1/recreation-ops/command/dashboard") == "recreation_ops"
