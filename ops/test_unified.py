from pathlib import Path
import unittest

import check_unified
import check_bootstrap


class UnifiedSourceTests(unittest.TestCase):
    root = Path(__file__).resolve().parent.parent

    def test_one_agent_is_shipped_for_both_roles(self):
        self.assertEqual({p.stem for p in (self.root / "desk/app").glob("*.hoon")}, {"manor"})
        self.assertNotIn("%manor-moon", (self.root / "desk/desk.bill").read_text())
        app = (self.root / "desk/app/manor.hoon").read_text()
        self.assertIn("%manor-ship-action", app)
        self.assertIn("controlled=local-state:manor-ship", app)
        self.assertIn("%3", app)

    def test_registration_is_not_restricted_to_moons(self):
        code = (self.root / "desk/lib/manor-pool.hoon").read_text()
        self.assertNotIn("%earl", code)
        self.assertIn("(lte (met 0 who) 128)", code)
        self.assertIn("!=(who our.bowl)", code)
        self.assertIn("%manor-ship-action", code)

    def test_app_inventory_is_read_only_and_keeps_the_previous_saved_pool_shape(self):
        app = (self.root / "desk/app/manor.hoon").read_text()
        self.assertIn("full=managed-pool-4:manor", app)
        self.assertIn("(migrate-managed:manor full.got)", app)
        self.assertIn("[%apps ~]", app)
        local = (self.root / "desk/lib/manor-ship.hoon").read_text()
        inventory = local.split("++  inventory\n", 1)[1].split("++  inventory-json\n", 1)[0]
        self.assertIn("%cx", inventory)
        self.assertIn("%cu", inventory)
        for forbidden in ("%poke", "%wait", "%j", "/sys/", "password", "cookie"):
            self.assertNotIn(forbidden, inventory)

    def test_pairing_notice_is_bounded_and_announced_only_on_pair_or_resume(self):
        app = (self.root / "desk/app/manor.hoon").read_text()
        self.assertIn("(pair-request:hc src.bowl)", app)
        self.assertIn("(gte ~(wyt by pair-requests) 64)", app)
        self.assertIn("%6  got", app)
        local = (self.root / "desk/lib/manor-ship.hoon").read_text()
        watches = local.split("++  watches\n", 1)[1].split("++  port\n", 1)[0]
        self.assertNotIn("announce", watches)
        self.assertNotIn("%manor-pair-request", watches)
        mark = (self.root / "desk/mar/manor/pair/request.hoon").read_text()
        self.assertIn("notice=~", mark)

    def test_forget_is_an_explicit_admin_override_not_remote_revocation(self):
        code = (self.root / "desk/lib/manor-pool.hoon").read_text()
        forget = code.split("++  forget\n", 1)[1].split("++  unlock\n", 1)[0]
        self.assertIn("(cleanup rid req)", forget)
        self.assertIn("claims (~(del by claims.out) who)", forget)
        self.assertNotIn("%revoke", forget)
        self.assertNotIn("%poke", forget)
        remove = code.split("++  remove\n", 1)[1].split("++  forget\n", 1)[0]
        self.assertIn("?>  !(~(has by claims.full) who)", remove)

    def test_local_pairing_cannot_kick_owner_admin_watchers(self):
        code = (self.root / "desk/lib/manor-ship.hoon").read_text()
        self.assertIn("?=([%status ~] pax)", code)
        self.assertIn("?=([%result @ ~] pax)", code)
        self.assertNotIn("[%state ~]", code)
        self.assertIn("?>  =(src.bowl our.bowl)", code)

    def test_no_idle_or_close_eviction_scheduler(self):
        code = (self.root / "desk/lib/manor-pool.hoon").read_text()
        self.assertNotIn("last-active", code)
        self.assertNotIn("idle-timeout", code)
        self.assertNotIn("%theseus-recycle", code)
        self.assertIn("%wait deadline", code)

    def test_status_refresh_retires_existing_wires_before_rewatching(self):
        code = (self.root / "desk/lib/manor-pool.hoon").read_text()
        helper = code.split("++  refresh-watch\n", 1)[1].split("++  register\n", 1)[0]
        self.assertIn("(~(has by wex.bowl) [wire who transport.row])", helper)
        self.assertLess(helper.index("%leave ~"), helper.index("(watch-moon who)"))
        reconnect = code.split("++  reconnect\n", 1)[1].split("++  valid-endpoint\n", 1)[0]
        self.assertIn("(refresh-watch who)", reconnect)
        resume = code.split("++  resume\n", 1)[1].split("++  begin\n", 1)[0]
        self.assertIn("(refresh-watch who)", resume)

    def test_probe_mocks_only_external_effects_and_keeps_agent_source(self):
        source = check_unified.source(self.root, tests=True)
        self.assertIn("%state-two-keeps-legacy-connection-and-claims", source)
        self.assertIn("%paired-peer-cannot-administer-controller-pool", source)
        self.assertIn("?.  (agent-running %manor-moon)  initial:manor-ship", source)
        self.assertNotIn("++  bootstrap  initial:manor-ship", source)
        self.assertIn("migrate-pool:manor full.got", source)

    def test_optional_agents_are_checked_before_scries(self):
        code = (self.root / "desk/lib/manor-ship.hoon").read_text()
        self.assertIn(".^(? %gu", code)
        bootstrap = code.split("++  bootstrap\n", 1)[1].split("++  resume\n", 1)[0]
        self.assertLess(bootstrap.index("(agent-running %manor-moon)"), bootstrap.index("%gx"))
        profile = code.split("++  own-profile\n", 1)[1].split("++  landing-ready\n", 1)[0]
        self.assertLess(profile.index("(agent-running %noltbook)"), profile.index("%gx"))

    def test_live_regression_uses_real_missing_agent_reads(self):
        source = check_bootstrap.source(self.root)
        self.assertIn(".^(? %gu", source)
        self.assertIn("/manor-load-probe-absent/", source)
        self.assertIn("/manor-profile-probe-absent/", source)
        self.assertIn("bootstrap.c", source)
        self.assertIn("own-profile.c", source)
        self.assertNotIn("send-raw-card", source)

    def test_profile_route_matches_the_working_companion(self):
        code = (self.root / "desk/lib/manor-ship.hoon").read_text()
        legacy = (self.root / "moon-desk/app/manor-moon.hoon").read_text()
        route = "/api/profile/(scot %p our.bowl)/json"
        self.assertIn(route, code)
        self.assertIn(route, legacy)
        self.assertNotIn("/api/ship-profile/", code)
        probe = check_bootstrap.source(self.root, profile=True)
        self.assertIn("snapshot.c", probe)
        self.assertIn("signal-status.c", probe)
        self.assertNotIn("manor-profile-probe-absent", probe)

    def test_dojo_generators_return_pages_not_nested_vases(self):
        for name in ("pair", "unpair", "configure", "report"):
            with self.subTest(generator=name):
                code = (self.root / "desk/gen/manor" / (name + ".hoon")).read_text()
                self.assertIn(":-  %say", code)
                self.assertIn(":-  %manor-ship-action", code)
                self.assertNotIn("!>", code)
        source = check_unified.source(self.root, tests=True)
        self.assertIn("%dojo-pair-generator-delivery", source)
        self.assertIn("%dojo-unpair-generator-delivery", source)
        self.assertIn("%dojo-configure-generator-delivery", source)
        self.assertIn("%dojo-report-generator-delivery", source)
        self.assertIn("on-poke.registered -.generated !>(+.generated)", source)


if __name__ == "__main__":
    unittest.main()
