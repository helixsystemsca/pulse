"""Unit tests for gateway arbitration (scoring + switch rules; no database)."""

from __future__ import annotations

import unittest

from app.services.automation.gateway_arbitration import (
    _SWITCH_MARGIN,
    _decide,
    apply_zone_bonus,
    compute_score,
    canonical_entity_key,
    rssi_below_floor,
)


class TestComputeScore(unittest.TestCase):
    def test_strong_rssi_higher_than_weak(self) -> None:
        a = compute_score(rssi=-60, tag_seen_count_1s=0, gateway_id="g1", active_gateway_id="g1")
        b = compute_score(rssi=-90, tag_seen_count_1s=0, gateway_id="g2", active_gateway_id="g1")
        self.assertGreater(a, b)

    def test_seen_count_boosts_score(self) -> None:
        a = compute_score(rssi=-80, tag_seen_count_1s=10, gateway_id="g1", active_gateway_id=None)
        b = compute_score(rssi=-80, tag_seen_count_1s=0, gateway_id="g2", active_gateway_id=None)
        self.assertGreater(a, b)

    def test_sticky_bias_for_active(self) -> None:
        base = compute_score(rssi=-70, tag_seen_count_1s=5, gateway_id="g1", active_gateway_id=None)
        sticky = compute_score(rssi=-70, tag_seen_count_1s=5, gateway_id="g1", active_gateway_id="g1")
        self.assertAlmostEqual(sticky - base, 0.1)

    def test_missing_rssi_defaults_weak(self) -> None:
        s = compute_score(rssi=None, tag_seen_count_1s=0, gateway_id="g1", active_gateway_id=None)
        self.assertGreaterEqual(s, 0.0)


class TestDecide(unittest.TestCase):
    def test_first_selects_gateway(self) -> None:
        st, action, prev = _decide(now=100.0, gateway_id="A", new_score=0.5, st={})
        self.assertEqual(action, "selected_first")
        self.assertIsNone(prev)
        self.assertEqual(st["active_gateway_id"], "A")
        self.assertEqual(st["last_score"], 0.5)

    def test_stronger_signal_switches_after_margin(self) -> None:
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.5,
            "cooldown_until": 0.0,
            "last_update": 100.0,
        }
        st, action, prev = _decide(now=110.0, gateway_id="B", new_score=0.71, st=st0)
        self.assertEqual(action, "switched")
        self.assertEqual(prev, "A")
        self.assertEqual(st["active_gateway_id"], "B")
        self.assertEqual(st["cooldown_until"], 112.0)

    def test_small_delta_no_switch(self) -> None:
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.5,
            "cooldown_until": 0.0,
            "last_update": 109.0,
        }
        st, action, _ = _decide(now=110.0, gateway_id="B", new_score=0.6, st=st0)
        self.assertEqual(action, "reject_not_active")
        self.assertEqual(st["active_gateway_id"], "A")

    def test_cooldown_blocks_switch(self) -> None:
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.3,
            "cooldown_until": 200.0,
            "last_update": 100.0,
        }
        st, action, _ = _decide(now=150.0, gateway_id="B", new_score=0.99, st=st0)
        self.assertEqual(action, "reject_cooldown")
        self.assertEqual(st["active_gateway_id"], "A")

    def test_stale_replaces_even_if_lower_score(self) -> None:
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.9,
            "cooldown_until": 0.0,
            "last_update": 100.0,
        }
        st, action, prev = _decide(now=104.0, gateway_id="B", new_score=0.2, st=st0)
        self.assertEqual(action, "switched")
        self.assertEqual(prev, "A")
        self.assertEqual(st["active_gateway_id"], "B")

    def test_score_decay_allows_smaller_challenger_margin(self) -> None:
        # last_score 0.5 → decayed 0.475; margin threshold 0.675; 0.68 clears decayed bar but not raw 0.7 bar
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.5,
            "cooldown_until": 0.0,
            "last_update": 109.0,
        }
        st, action, _ = _decide(now=110.0, gateway_id="B", new_score=0.68, st=st0)
        self.assertEqual(action, "switched")
        undecayed_bar = 0.5 + _SWITCH_MARGIN
        self.assertLess(0.68, undecayed_bar)

    def test_tight_challenger_rejected_when_below_decayed_margin(self) -> None:
        st0 = {
            "active_gateway_id": "A",
            "last_score": 0.52,
            "cooldown_until": 0.0,
            "last_update": 109.0,
        }
        st, action, _ = _decide(now=110.0, gateway_id="B", new_score=0.69, st=st0)
        self.assertEqual(action, "reject_not_active")
        decayed_bar = 0.52 * 0.95 + _SWITCH_MARGIN
        self.assertLessEqual(0.69, decayed_bar)


class TestRssiFloor(unittest.TestCase):
    def test_missing_rejected(self) -> None:
        self.assertTrue(rssi_below_floor(None))

    def test_boundary_allowed(self) -> None:
        self.assertFalse(rssi_below_floor(-95))
        self.assertFalse(rssi_below_floor(-95.0))

    def test_below_boundary_rejected(self) -> None:
        self.assertTrue(rssi_below_floor(-96))
        self.assertTrue(rssi_below_floor(-95.1))


class TestZoneBonus(unittest.TestCase):
    def test_bonus_when_zones_match(self) -> None:
        b = apply_zone_bonus(0.5, event_zone_id="z1", last_zone_id="z1")
        self.assertAlmostEqual(b, 0.6)

    def test_no_bonus_when_zone_unknown(self) -> None:
        b = apply_zone_bonus(0.5, event_zone_id="z1", last_zone_id="")
        self.assertAlmostEqual(b, 0.5)

    def test_clamped_at_one(self) -> None:
        b = apply_zone_bonus(0.95, event_zone_id="z", last_zone_id="z")
        self.assertAlmostEqual(b, 1.0)


class TestEntityKey(unittest.TestCase):
    def test_worker_equipment_key(self) -> None:
        k = canonical_entity_key({"worker_id": "w1", "equipment_id": "e1"})
        self.assertEqual(k, "worker:w1|equipment:e1")


if __name__ == "__main__":
    unittest.main()
