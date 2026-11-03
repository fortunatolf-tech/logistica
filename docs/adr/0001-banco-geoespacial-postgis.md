# ADR 0001 — PostgreSQL + PostGIS como banco transacional e geoespacial

## Status
Aceito

## Contexto
A plataforma precisa persistir entregas, rotas e registros de localização
normalizados, e responder consultas geoespaciais (entregas por bairro, pontos
dentro de polígonos de restrição, áreas com falha de localização).

## Decisão
PostgreSQL 16 com extensão PostGIS como banco único para dados transacionais
e geoespaciais. Coordenadas em colunas `geography(Point, 4326)`; polígonos de
áreas restritas em `geography(Polygon, 4326)` com índice GiST. Isolamento
multi-tenant por coluna `tenant_id` em todas as tabelas, com políticas de
acesso por perfil (a ser reforçado por RLS no incremento do gateway).

## Consequências
- Uma só tecnologia de banco para operar (transações + geospatial + materialized
  views para analytics, Bloco 7).
- Geofencing de áreas restritas será validado em SQL (`ST_Covers`) quando o
  route-optimizer ganhar persistência — neste incremento, restrições de área
  são aceitas no contrato mas ainda não avaliadas geometricamente.
- Alternativas rejeitadas: MongoDB (geoespacial mais fraco e sem joins
  transacionais), banco separado para geo (complexidade operacional).
