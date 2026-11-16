from pathlib import Path
import unittest

import check_pool


class PoolSourceTests(unittest.TestCase):
    root = Path(__file__).resolve().parent.parent

    def test_protocol_copy_matches_installed_companion_protocol(self):
        self.assertEqual((self.root / "desk/sur/manor-moon.hoon").read_bytes(),
                         (self.root / "moon-desk/sur/manor-moon.hoon").read_bytes())

    def test_compiler_probe_is_in_memory_and_mock_only_replaces_host_port(self):
        real = check_pool.source(self.root)
        mock = check_pool.source(self.root, tests=True)
        self.assertIn(".^([@ud (unit @ud)] %e", real)
        self.assertNotIn(".^([@ud (unit @ud)] %e", mock)
        self.assertIn("=/  own-port  [8.083 ~]", mock)

    def test_host_agent_is_compiled_with_its_actual_migration_and_libraries(self):
        code = check_pool.source(self.root, agent=True)
        for name in ("server", "manor-pool", "control", "default-agent", "dbug", "ctor"):
            self.assertIn("=/  " + name + "\n", code)
        self.assertIn("%1  [%9 pool.got fleet.got claims.got", code)

    def test_pool_has_no_snapshot_or_key_rotation_calls(self):
        helper = (self.root / "desk/lib/manor-full.hoon").read_text()
        for forbidden in ("%theseus-recycle", "%helm-code", "password=", " %j ", "%breach"):
            self.assertNotIn(forbidden, helper)
        self.assertIn("%poke %manor-moon-action", helper)
        self.assertNotIn("%poke-as", helper)

    def test_helper_does_not_widen_gall_cards_to_arvo_tagged_nouns(self):
        helper = (self.root / "desk/lib/manor-full.hoon").read_text()
        self.assertIn("+$  card  card:agent:gall", helper)


if __name__ == "__main__":
    unittest.main()
