/**
 * Contratos canônicos da plataforma RotaViva.
 *
 * Fonte única de verdade para localização, entrega e rota.
 * Os serviços Python espelham estes contratos (ver docs/openapi/openapi.yaml).
 */

// ---------------------------------------------------------------------------
// Localização (Bloco 2 — registro canônico)
// ---------------------------------------------------------------------------

export type LocationSource = "exif" | "gps" | "plus_code" | "endereco";

/** Registro georreferenciado canônico produzido pelo geo-normalizer. */
export interface CanonicalLocation {
  lat: number;
  lng: number;
  /** Precisão estimada em metros. */
  precisao_m: number;
  fonte: LocationSource;
  /** ISO 8601 UTC. */
  timestamp: string;
  plus_code_equivalente: string;
  validado: boolean;
}

/** Trilha de auditoria (append-only) associada a cada registro. */
export interface AuditRecord {
  quem: string;
  quando: string; // ISO 8601 UTC
  acao: string;
  origem: LocationSource;
}

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

export type DeliveryStatus =
  | "criada"
  | "atribuida"
  | "em_rota"
  | "entregue"
  | "falha"
  | "cancelada";

export interface Delivery {
  id: string;
  tenant_id: string;
  localizacao: CanonicalLocation;
  status: DeliveryStatus;
  janela_inicio?: string; // ISO 8601
  janela_fim?: string; // ISO 8601
  prioridade: number;
  /** Chave de idempotência da fila offline do PWA. */
  idempotency_key?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Otimização de rotas (Bloco 3)
// ---------------------------------------------------------------------------

export type VehicleType = "moto" | "carro" | "van" | "caminhao";

export interface Vehicle {
  tipo: VehicleType;
  /** Capacidade em unidades de carga (pacotes, kg, etc.). */
  capacidade: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DeliveryInput {
  id: string;
  lat: number;
  lng: number;
  janela_inicio?: string; // ISO 8601
  janela_fim?: string; // ISO 8601
  prioridade?: number;
  /** Tempo de serviço na parada, em minutos. */
  servico_min?: number;
}

export interface OptimizeConstraints {
  /** IDs de polígonos de acesso restrito (geofencing via PostGIS — ver ADRs). */
  areas_restritas?: string[];
  horario_operacao?: string;
}

export interface OptimizeRequest {
  tenant_id: string;
  veiculo: Vehicle;
  entregas: DeliveryInput[];
  restricoes?: OptimizeConstraints;
  /** Ponto de partida; se ausente, usa o centroide das entregas. */
  origem?: LatLng;
  /** Início da rota (ISO 8601); se ausente, usa o instante atual. */
  inicio?: string;
}

export interface RouteStop {
  id: string;
  sequencia: number;
  lat: number;
  lng: number;
  /** ETA em ISO 8601. */
  eta: string;
  distancia_desde_anterior_km: number;
  janela_respeitada: boolean;
}

export interface RouteMetrics {
  tempo_total_estimado_min: number;
  distancia_total_km: number;
  combustivel_estimado_l: number;
  aderencia_janelas_pct: number;
}

export type RejectionReason =
  | "janela_impossivel"
  | "area_restrita"
  | "veiculo_incompativel"
  | "coordenada_invalida";

export interface RejectedDelivery {
  id: string;
  motivo: RejectionReason;
  detalhe?: string;
}

export interface OptimizeResponse {
  tenant_id: string;
  paradas: RouteStop[];
  metricas: RouteMetrics;
  rejeitadas: RejectedDelivery[];
}

// ---------------------------------------------------------------------------
// Webhooks e LGPD (Bloco 5)
// ---------------------------------------------------------------------------

export interface WebhookSubscription {
  id: string;
  tenant_id: string;
  url: string;
  eventos: string[];
  /** Segredo para assinatura HMAC-SHA256 do payload. */
  segredo: string;
  ativo: boolean;
}

export type LgpdRequestType = "acesso" | "exportacao" | "eliminacao";

export interface LgpdRequest {
  id: string;
  tenant_id: string;
  titular_id: string;
  tipo: LgpdRequestType;
  status: "recebido" | "em_processamento" | "concluido" | "recusado";
  created_at: string;
}
