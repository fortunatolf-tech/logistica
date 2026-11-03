import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.cache import InMemoryTtlCache, chave_cache  # noqa: E402


class TestInMemoryTtlCache(unittest.TestCase):
    def test_get_set(self):
        relogio = [1000.0]
        cache = InMemoryTtlCache(agora=lambda: relogio[0])
        cache.set("k", {"rota": 1}, ttl_s=120)
        self.assertEqual(cache.get("k"), {"rota": 1})

    def test_expira_apos_ttl(self):
        relogio = [1000.0]
        cache = InMemoryTtlCache(agora=lambda: relogio[0])
        cache.set("k", "v", ttl_s=120)
        relogio[0] += 121
        self.assertIsNone(cache.get("k"))

    def test_ausente_retorna_none(self):
        self.assertIsNone(InMemoryTtlCache().get("nada"))


class TestChaveCache(unittest.TestCase):
    def test_estavel_independente_da_ordem_das_chaves(self):
        a = chave_cache({"x": 1, "y": [1, 2]})
        b = chave_cache({"y": [1, 2], "x": 1})
        self.assertEqual(a, b)

    def test_payloads_diferentes_chaves_diferentes(self):
        self.assertNotEqual(chave_cache({"a": 1}), chave_cache({"a": 2}))


if __name__ == "__main__":
    unittest.main()
