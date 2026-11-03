# ADR 0002 — Abstração MapProvider para mapas, geocodificação e trânsito

## Status
Aceito

## Contexto
Geocodificação (Bloco 2), matrizes de tempo com trânsito (Bloco 3) e renderização
de mapas (Bloco 4) dependem de provedores externos com custos e limites
contratuais distintos (Google, Mapbox, OSM). Prender o código a um provedor
cria risco de custo e de negociação.

## Decisão
Toda dependência de mapas passa por uma interface `MapProvider`
(implementada em `services/geo-normalizer/app/geocoder.py` para geocodificação;
a mesma abstração será estendida para matrizes de tempo e tiles). O provedor
ativo é escolhido por configuração (`MAP_PROVIDER`), nunca por código do
consumidor. Implementação inicial: Nominatim/OSM para desenvolvimento e
`StaticProvider` determinístico para testes e sandbox.

## Consequências
- Testes não dependem de rede nem de chaves de API.
- A troca Google ↔ Mapbox ↔ OSM é mudança de configuração, não de código.
- Custo de API de matrizes de distância é controlado por cache Redis com TTL
  curto (Bloco 3, item 6), implementado na camada do provedor.
