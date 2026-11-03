import os
import random
import sys
import time
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.geo import build_matrix  # noqa: E402
from app.optimizer import StopInput, optimize  # noqa: E402

INICIO = datetime(2026, 11, 3, 8, 0, tzinfo=timezone.utc)
CENTRO = (-23.5505, -46.6333)


def _entregas_aleatorias(n: int, seed: int = 7) -> list[StopInput]:
    """Entregas sintéticas num raio de ~10 km do centro de SP."""
    rng = random.Random(seed)
    return [
        StopInput(
            id=f"e{i:03d}",
            lat=CENTRO[0] + rng.uniform(-0.09, 0.09),
            lng=CENTRO[1] + rng.uniform(-0.09, 0.09),
            servico_min=5.0,
        )
        for i in range(n)
    ]


def _comprimento_na_ordem(entregas: list[StopInput], origem) -> float:
    pts = [origem] + [(e.lat, e.lng) for e in entregas]
    m = build_matrix(pts)
    return sum(m[i][i + 1] for i in range(len(pts) - 1))


class TestOptimize(unittest.TestCase):
    def test_ganho_vs_rota_na_ordem_de_entrada(self):
        entregas = _entregas_aleatorias(20)
        resultado = optimize("t1", "moto", entregas, origem=CENTRO, inicio=INICIO)
        baseline = _comprimento_na_ordem(entregas, CENTRO)
        otimizado = resultado.metricas["distancia_total_km"]
        self.assertLess(otimizado, baseline)
        self.assertGreaterEqual((baseline - otimizado) / baseline, 0.15,
                                "ganho deve ser >= 15% vs. baseline")

    def test_todas_as_paradas_presentes_em_ordem(self):
        entregas = _entregas_aleatorias(20)
        resultado = optimize("t1", "carro", entregas, origem=CENTRO, inicio=INICIO)
        ids = [p.id for p in resultado.paradas]
        self.assertEqual(sorted(ids), sorted(e.id for e in entregas))
        self.assertEqual([p.sequencia for p in resultado.paradas],
                         list(range(1, 21)))

    def test_metricas_completas(self):
        entregas = _entregas_aleatorias(10)
        resultado = optimize("t1", "van", entregas, origem=CENTRO, inicio=INICIO)
        m = resultado.metricas
        for chave in ("tempo_total_estimado_min", "distancia_total_km",
                      "combustivel_estimado_l", "aderencia_janelas_pct"):
            self.assertIn(chave, m)
            self.assertGreaterEqual(m[chave], 0)
        self.assertGreater(m["tempo_total_estimado_min"], 0)
        self.assertGreater(m["combustivel_estimado_l"], 0)

    def test_janelas_respeitadas_quando_amplas(self):
        fim = (INICIO + timedelta(hours=10)).isoformat()
        entregas = _entregas_aleatorias(10)
        for e in entregas:
            e.janela_inicio = INICIO
            e.janela_fim = INICIO + timedelta(hours=10)
        resultado = optimize("t1", "moto", entregas, origem=CENTRO, inicio=INICIO)
        self.assertEqual(resultado.metricas["aderencia_janelas_pct"], 100.0)
        self.assertTrue(all(p.janela_respeitada for p in resultado.paradas))

    def test_janela_ja_encerrada_e_rejeitada(self):
        entregas = _entregas_aleatorias(5)
        entregas[0].janela_fim = INICIO - timedelta(hours=1)
        resultado = optimize("t1", "moto", entregas, origem=CENTRO, inicio=INICIO)
        self.assertEqual(len(resultado.rejeitadas), 1)
        self.assertEqual(resultado.rejeitadas[0].motivo, "janela_impossivel")
        self.assertEqual(len(resultado.paradas), 4)

    def test_janela_invertida_e_rejeitada(self):
        e = StopInput(id="e1", lat=CENTRO[0], lng=CENTRO[1],
                      janela_inicio=INICIO + timedelta(hours=3),
                      janela_fim=INICIO + timedelta(hours=2))
        resultado = optimize("t1", "moto", [e], origem=CENTRO, inicio=INICIO)
        self.assertEqual(resultado.rejeitadas[0].motivo, "janela_impossivel")

    def test_coordenada_invalida_e_rejeitada(self):
        e = StopInput(id="e1", lat=91.0, lng=0.0)
        resultado = optimize("t1", "moto", [e], origem=CENTRO, inicio=INICIO)
        self.assertEqual(resultado.rejeitadas[0].motivo, "coordenada_invalida")
        self.assertEqual(resultado.paradas, [])

    def test_tipo_de_veiculo_invalido(self):
        with self.assertRaises(ValueError):
            optimize("t1", "helicoptero", _entregas_aleatorias(3))

    def test_sem_entregas(self):
        resultado = optimize("t1", "moto", [], origem=CENTRO, inicio=INICIO)
        self.assertEqual(resultado.paradas, [])
        self.assertEqual(resultado.metricas["distancia_total_km"], 0.0)

    def test_veiculo_muda_estimativas(self):
        entregas = _entregas_aleatorias(10)
        moto = optimize("t1", "moto", entregas, origem=CENTRO, inicio=INICIO)
        caminhao = optimize("t1", "caminhao", entregas, origem=CENTRO, inicio=INICIO)
        self.assertLess(
            moto.metricas["tempo_total_estimado_min"],
            caminhao.metricas["tempo_total_estimado_min"],
        )
        self.assertLess(
            moto.metricas["combustivel_estimado_l"],
            caminhao.metricas["combustivel_estimado_l"],
        )


class TestEscalaEDesempenho(unittest.TestCase):
    def test_100_entregas_abaixo_do_limite(self):
        entregas = _entregas_aleatorias(100, seed=11)
        t0 = time.perf_counter()
        resultado = optimize("t1", "van", entregas, origem=CENTRO, inicio=INICIO)
        elapsed = time.perf_counter() - t0
        self.assertEqual(len(resultado.paradas), 100)
        self.assertLess(elapsed, 2.0, f"recálculo levou {elapsed:.2f}s (limite: 2s)")

    def test_500_entregas_completam(self):
        entregas = _entregas_aleatorias(500, seed=13)
        t0 = time.perf_counter()
        resultado = optimize("t1", "caminhao", entregas, origem=CENTRO, inicio=INICIO)
        elapsed = time.perf_counter() - t0
        self.assertEqual(len(resultado.paradas), 500)
        self.assertLess(elapsed, 30.0, f"500 entregas levaram {elapsed:.2f}s")


if __name__ == "__main__":
    unittest.main()
