export type TipoSocio = 'familiar' | 'individual';
export type Parentesco = 'titular' | 'conyuge' | 'hijo' | 'abuelo' | 'otro';
export type EstadoTarjeta = 'activa' | 'bloqueada' | 'perdida';
export type Rol = 'pendiente' | 'taquilla' | 'admin';
export type TipoMovimiento = 'entrada' | 'salida';

export interface Perfil {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: Rol;
}

export interface Temporada {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  max_pases_por_socio: number;
  precio_pase: number;
  aforo_maximo: number | null;
}

export interface Socio {
  id: number;
  numero: number;
  tipo: TipoSocio;
  exento_cuota: boolean;
  activo: boolean;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  observaciones: string | null;
}

export interface Persona {
  id: number;
  socio_id: number;
  nombre: string;
  apellidos: string;
  parentesco: Parentesco;
  fecha_nacimiento: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  es_jubilado: boolean;
  es_fundador: boolean;
  foto_path: string | null;
  codigo_qr: string;
  estado_tarjeta: EstadoTarjeta;
  activo: boolean;
  observaciones: string | null;
}

export interface Cuota {
  id: number;
  socio_id: number;
  temporada_id: number;
  importe: number;
  pagada: boolean;
  fecha_pago: string | null;
  metodo: string | null;
  observaciones: string | null;
}

export interface PaseDia {
  id: number;
  socio_id: number;
  temporada_id: number | null;
  fecha: string;
  nombre_invitado: string;
  dni_invitado: string | null;
  importe: number;
  pagado: boolean;
  codigo_qr: string;
  creado_en: string;
}

export interface SocioCompleto extends Socio {
  personas: Persona[];
  cuotas: Cuota[];
}

/** Respuesta de la función registrar_acceso() */
export interface ResultadoAcceso {
  resultado: 'autorizado' | 'denegado';
  motivo: string | null;
  tipo: TipoMovimiento;
  duplicado: boolean;
  fecha_hora: string;
  aforo: number;
  persona: null | {
    tipo: 'socio' | 'invitado';
    nombre: string;
    apellidos: string;
    parentesco?: Parentesco;
    edad?: number | null;
    es_jubilado?: boolean;
    es_fundador?: boolean;
    foto_path?: string | null;
    numero_socio: number;
    tipo_socio?: TipoSocio;
    observaciones?: string | null;
    fecha_pase?: string;
  };
}

/** Respuesta de carnet_publico() */
export interface CarnetPublico {
  tipo: 'socio' | 'invitado';
  codigo: string;
  nombre: string;
  apellidos?: string;
  parentesco?: Parentesco;
  es_jubilado?: boolean;
  es_fundador?: boolean;
  numero_socio: number;
  tipo_socio?: TipoSocio;
  valido: boolean;
  temporada?: string | null;
  cuota_al_dia?: boolean;
  fecha?: string;
}
