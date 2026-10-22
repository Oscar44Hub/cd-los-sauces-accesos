-- =====================================================================
-- Club Deportivo Los Sauces (Papatrigo) · Control de accesos a la piscina
-- Esquema inicial. Ejecutar completo en el SQL Editor de Supabase.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.tipo_socio       as enum ('familiar', 'individual');
create type public.parentesco       as enum ('titular', 'conyuge', 'hijo', 'abuelo', 'otro');
create type public.estado_tarjeta   as enum ('activa', 'bloqueada', 'perdida');
create type public.rol_usuario      as enum ('pendiente', 'taquilla', 'admin');
create type public.tipo_movimiento  as enum ('entrada', 'salida');
create type public.resultado_acceso as enum ('autorizado', 'denegado');

-- ---------------------------------------------------------------------
-- Fecha "de hoy" en hora de España (el servidor de Supabase va en UTC)
-- ---------------------------------------------------------------------
create function public.hoy() returns date
language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Madrid')::date
$$;

create function public.inicio_de_hoy() returns timestamptz
language sql stable set search_path = public as $$
  select public.hoy()::timestamp at time zone 'Europe/Madrid'
$$;

-- ---------------------------------------------------------------------
-- Usuarios de la app (junta directiva y taquilla)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  email     text,
  nombre    text,
  rol       public.rol_usuario not null default 'pendiente',
  creado_en timestamptz not null default now()
);

-- Cada cuenta nueva queda "pendiente" hasta que un administrador la aprueba
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

create function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('taquilla', 'admin'))
$$;

create function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin')
$$;

-- ---------------------------------------------------------------------
-- Temporadas (normalmente una por verano)
-- ---------------------------------------------------------------------
create table public.temporadas (
  id                  bigint generated always as identity primary key,
  nombre              text not null unique,
  fecha_inicio        date not null,
  fecha_fin           date not null,
  activa              boolean not null default false,
  max_pases_por_socio int not null default 10 check (max_pases_por_socio >= 0),
  precio_pase         numeric(6, 2) not null default 0 check (precio_pase >= 0),
  aforo_maximo        int check (aforo_maximo > 0),
  check (fecha_fin >= fecha_inicio)
);
-- Solo puede haber una temporada activa
create unique index temporadas_una_activa on public.temporadas (activa) where activa;

-- ---------------------------------------------------------------------
-- Socios: la "cuenta" que paga la cuota (familiar o individual)
-- ---------------------------------------------------------------------
create table public.socios (
  id            bigint generated always as identity primary key,
  numero        int not null unique check (numero > 0),
  tipo          public.tipo_socio not null default 'familiar',
  exento_cuota  boolean not null default false,
  activo        boolean not null default true,
  telefono      text,
  email         text,
  direccion     text,
  observaciones text,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Personas: cada miembro con su carnet (padres, hijos, abuelos…)
-- ---------------------------------------------------------------------
create table public.personas (
  id               bigint generated always as identity primary key,
  socio_id         bigint not null references public.socios (id) on delete cascade,
  nombre           text not null,
  apellidos        text not null,
  parentesco       public.parentesco not null default 'titular',
  fecha_nacimiento date,
  dni              text,
  telefono         text,
  email            text,
  es_jubilado      boolean not null default false,
  es_fundador      boolean not null default false,
  foto_path        text,
  -- Lo único que va dentro del QR: un identificador aleatorio, sin datos personales
  codigo_qr        uuid not null unique default gen_random_uuid(),
  estado_tarjeta   public.estado_tarjeta not null default 'activa',
  activo           boolean not null default true,
  observaciones    text,
  creado_en        timestamptz not null default now()
);
create index personas_socio on public.personas (socio_id);

-- Un socio individual solo puede tener una persona
create function public.comprobar_socio_individual() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select tipo from public.socios where id = new.socio_id) = 'individual'
     and exists (select 1 from public.personas where socio_id = new.socio_id and id is distinct from new.id) then
    raise exception 'Un socio individual solo puede tener una persona. Cámbialo a familiar para añadir más.';
  end if;
  return new;
end $$;

create trigger personas_socio_individual
  before insert or update of socio_id on public.personas
  for each row execute function public.comprobar_socio_individual();

-- ---------------------------------------------------------------------
-- Cuotas por temporada
-- ---------------------------------------------------------------------
create table public.cuotas (
  id            bigint generated always as identity primary key,
  socio_id      bigint not null references public.socios (id) on delete cascade,
  temporada_id  bigint not null references public.temporadas (id) on delete cascade,
  importe       numeric(8, 2) not null default 0 check (importe >= 0),
  pagada        boolean not null default false,
  fecha_pago    date,
  metodo        text,
  observaciones text,
  unique (socio_id, temporada_id)
);

-- ---------------------------------------------------------------------
-- Invitados: pase de día asociado al socio que invita
-- ---------------------------------------------------------------------
create table public.pases_dia (
  id              bigint generated always as identity primary key,
  socio_id        bigint not null references public.socios (id) on delete cascade,
  temporada_id    bigint references public.temporadas (id) on delete cascade,
  fecha           date not null default public.hoy(),
  nombre_invitado text not null,
  dni_invitado    text,
  importe         numeric(6, 2) not null default 0 check (importe >= 0),
  pagado          boolean not null default false,
  codigo_qr       uuid not null unique default gen_random_uuid(),
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now()
);
create index pases_socio_temporada on public.pases_dia (socio_id, temporada_id);

-- Asigna la temporada activa y comprueba el límite de invitados por socio
create function public.preparar_pase() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_t public.temporadas;
  v_usados int;
begin
  select * into v_t from public.temporadas where activa;
  if v_t.id is null then
    raise exception 'No hay ninguna temporada activa';
  end if;
  new.temporada_id := v_t.id;
  if tg_op = 'INSERT' then
    select count(*) into v_usados from public.pases_dia
     where socio_id = new.socio_id and temporada_id = v_t.id;
    if v_usados >= v_t.max_pases_por_socio then
      raise exception 'El socio ya ha usado sus % pases de invitado de esta temporada', v_t.max_pases_por_socio;
    end if;
  end if;
  return new;
end $$;

create trigger pases_preparar
  before insert on public.pases_dia
  for each row execute function public.preparar_pase();

-- ---------------------------------------------------------------------
-- Registro de accesos (solo se escribe a través de registrar_acceso)
-- ---------------------------------------------------------------------
create table public.accesos (
  id           bigint generated always as identity primary key,
  fecha_hora   timestamptz not null default now(),
  tipo         public.tipo_movimiento not null,
  resultado    public.resultado_acceso not null,
  motivo       text,
  codigo_leido text,
  persona_id   bigint references public.personas (id) on delete set null,
  pase_id      bigint references public.pases_dia (id) on delete set null,
  usuario_id   uuid default auth.uid() references auth.users (id) on delete set null
);
create index accesos_fecha on public.accesos (fecha_hora desc);
create index accesos_persona on public.accesos (persona_id, fecha_hora desc);
create index accesos_pase on public.accesos (pase_id, fecha_hora desc);

-- =====================================================================
-- Lógica de acceso
-- =====================================================================

-- Extrae el UUID de lo que haya leído el lector. Acepta también lecturas de
-- lectores USB con el teclado mal configurado (p. ej. ' en lugar de -).
create function public.normalizar_codigo(p_codigo text) returns uuid
language plpgsql immutable set search_path = public as $$
declare
  v_match text;
  v_hex   text;
begin
  if p_codigo is null then
    return null;
  end if;
  v_match := substring(lower(p_codigo) from '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
  if v_match is not null then
    return v_match::uuid;
  end if;
  v_hex := regexp_replace(lower(p_codigo), '[^0-9a-f]', '', 'g');
  if length(v_hex) = 32 then
    return v_hex::uuid;
  end if;
  return null;
end $$;

-- Personas e invitados que están dentro ahora (último movimiento de hoy = entrada)
create function public.presentes()
returns table (persona_id bigint, pase_id bigint, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select u.persona_id, u.pase_id, u.fecha_hora
  from (
    select distinct on (coalesce('p' || a.persona_id, 'i' || a.pase_id))
           a.persona_id, a.pase_id, a.tipo, a.fecha_hora
      from public.accesos a
     where a.resultado = 'autorizado'
       and a.fecha_hora >= public.inicio_de_hoy()
       and (a.persona_id is not null or a.pase_id is not null)
     order by coalesce('p' || a.persona_id, 'i' || a.pase_id), a.fecha_hora desc
  ) u
  where u.tipo = 'entrada'
    and public.es_staff()
$$;

create function public.aforo_actual() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.presentes()
$$;

create function public.registrar_acceso(p_codigo text, p_tipo public.tipo_movimiento default 'entrada')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uuid    uuid := public.normalizar_codigo(p_codigo);
  v_hoy     date := public.hoy();
  v_t       public.temporadas;
  v_p       public.personas;
  v_s       public.socios;
  v_pase    public.pases_dia;
  v_motivo  text;
  v_res     public.resultado_acceso;
  v_dentro  boolean := false;
  v_previo  public.accesos;
  v_info    jsonb := null;
  v_aforo   int;
begin
  if not public.es_staff() then
    raise exception 'No tienes permiso para registrar accesos' using errcode = '42501';
  end if;

  select * into v_t from public.temporadas where activa;
  v_aforo := public.aforo_actual();

  if v_uuid is not null then
    select * into v_p from public.personas where codigo_qr = v_uuid;
    if v_p.id is null then
      select * into v_pase from public.pases_dia where codigo_qr = v_uuid;
    end if;
  end if;

  if v_p.id is not null then
    -- ----- Socio -----
    select * into v_s from public.socios where id = v_p.socio_id;
    v_dentro := exists (select 1 from public.presentes() x where x.persona_id = v_p.id);
    v_motivo := case
      when p_tipo = 'salida' then null
      when v_t.id is null then 'No hay ninguna temporada activa'
      when v_hoy not between v_t.fecha_inicio and v_t.fecha_fin then 'Fuera de las fechas de la temporada'
      when not v_s.activo then 'Socio dado de baja'
      when not v_p.activo then 'Persona dada de baja'
      when v_p.estado_tarjeta = 'bloqueada' then 'Tarjeta bloqueada'
      when v_p.estado_tarjeta = 'perdida' then 'Tarjeta marcada como perdida'
      when not v_s.exento_cuota and not exists (
             select 1 from public.cuotas c
              where c.socio_id = v_s.id and c.temporada_id = v_t.id and c.pagada)
        then 'Cuota de la temporada pendiente de pago'
      when not v_dentro and v_t.aforo_maximo is not null and v_aforo >= v_t.aforo_maximo
        then 'Aforo completo'
    end;
    v_info := jsonb_build_object(
      'tipo', 'socio',
      'persona_id', v_p.id,
      'nombre', v_p.nombre,
      'apellidos', v_p.apellidos,
      'parentesco', v_p.parentesco,
      'edad', case when v_p.fecha_nacimiento is not null
                   then extract(year from age(v_hoy, v_p.fecha_nacimiento))::int end,
      'es_jubilado', v_p.es_jubilado,
      'es_fundador', v_p.es_fundador,
      'foto_path', v_p.foto_path,
      'numero_socio', v_s.numero,
      'tipo_socio', v_s.tipo,
      'observaciones', v_p.observaciones
    );
    select * into v_previo from public.accesos
     where persona_id = v_p.id and fecha_hora > now() - interval '30 seconds'
     order by fecha_hora desc limit 1;

  elsif v_pase.id is not null then
    -- ----- Invitado -----
    select * into v_s from public.socios where id = v_pase.socio_id;
    v_dentro := exists (select 1 from public.presentes() x where x.pase_id = v_pase.id);
    v_motivo := case
      when p_tipo = 'salida' then null
      when v_pase.fecha <> v_hoy then 'Pase válido solo para el ' || to_char(v_pase.fecha, 'DD/MM/YYYY')
      when v_pase.importe > 0 and not v_pase.pagado then 'Pase de invitado pendiente de pago'
      when not v_s.activo then 'El socio que invita está dado de baja'
      when not v_dentro and v_t.aforo_maximo is not null and v_aforo >= v_t.aforo_maximo
        then 'Aforo completo'
    end;
    v_info := jsonb_build_object(
      'tipo', 'invitado',
      'pase_id', v_pase.id,
      'nombre', v_pase.nombre_invitado,
      'apellidos', '',
      'numero_socio', v_s.numero,
      'fecha_pase', v_pase.fecha
    );
    select * into v_previo from public.accesos
     where pase_id = v_pase.id and fecha_hora > now() - interval '30 seconds'
     order by fecha_hora desc limit 1;

  else
    v_motivo := 'Código no reconocido';
    select * into v_previo from public.accesos
     where persona_id is null and pase_id is null and codigo_leido = p_codigo
       and tipo = p_tipo and fecha_hora > now() - interval '30 seconds'
     order by fecha_hora desc limit 1;
  end if;

  v_res := case when v_motivo is null then 'autorizado' else 'denegado' end;

  -- La cámara puede leer el mismo QR varias veces seguidas: no se duplica el registro
  if v_previo.id is not null and v_previo.tipo = p_tipo and v_previo.resultado = v_res then
    return jsonb_build_object(
      'resultado', v_res, 'motivo', v_motivo, 'tipo', p_tipo, 'duplicado', true,
      'fecha_hora', v_previo.fecha_hora, 'persona', v_info, 'aforo', v_aforo);
  end if;

  insert into public.accesos (tipo, resultado, motivo, codigo_leido, persona_id, pase_id)
  values (p_tipo, v_res, v_motivo, left(p_codigo, 200), v_p.id, v_pase.id)
  returning * into v_previo;

  return jsonb_build_object(
    'resultado', v_res, 'motivo', v_motivo, 'tipo', p_tipo, 'duplicado', false,
    'fecha_hora', v_previo.fecha_hora, 'persona', v_info,
    'aforo', public.aforo_actual());
end $$;

-- Activar una temporada desactivando las demás
create function public.activar_temporada(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede activar temporadas' using errcode = '42501';
  end if;
  update public.temporadas set activa = false where activa and id <> p_id;
  update public.temporadas set activa = true where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Carnet digital: lo consulta el propio socio desde su móvil, sin cuenta.
-- Solo devuelve lo necesario para mostrar el carnet (sin DNI, teléfono ni foto).
-- ---------------------------------------------------------------------
create function public.carnet_publico(p_codigo uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.personas;
  v_s public.socios;
  v_t public.temporadas;
  v_pase public.pases_dia;
begin
  select * into v_t from public.temporadas where activa;
  select * into v_p from public.personas where codigo_qr = p_codigo;
  if v_p.id is not null then
    select * into v_s from public.socios where id = v_p.socio_id;
    return jsonb_build_object(
      'tipo', 'socio',
      'codigo', v_p.codigo_qr,
      'nombre', v_p.nombre,
      'apellidos', v_p.apellidos,
      'parentesco', v_p.parentesco,
      'es_jubilado', v_p.es_jubilado,
      'es_fundador', v_p.es_fundador,
      'numero_socio', v_s.numero,
      'tipo_socio', v_s.tipo,
      'valido', v_s.activo and v_p.activo and v_p.estado_tarjeta = 'activa',
      'temporada', v_t.nombre,
      'cuota_al_dia', v_s.exento_cuota or exists (
         select 1 from public.cuotas c where c.socio_id = v_s.id and c.temporada_id = v_t.id and c.pagada)
    );
  end if;
  select * into v_pase from public.pases_dia where codigo_qr = p_codigo;
  if v_pase.id is not null then
    select * into v_s from public.socios where id = v_pase.socio_id;
    return jsonb_build_object(
      'tipo', 'invitado',
      'codigo', v_pase.codigo_qr,
      'nombre', v_pase.nombre_invitado,
      'numero_socio', v_s.numero,
      'fecha', v_pase.fecha,
      'valido', v_pase.fecha = public.hoy()
    );
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Estadísticas
-- ---------------------------------------------------------------------
create function public.estadisticas(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_desde timestamptz := p_desde::timestamp at time zone 'Europe/Madrid';
  v_hasta timestamptz := (p_hasta + 1)::timestamp at time zone 'Europe/Madrid';
  v_r jsonb;
begin
  if not public.es_staff() then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  with ent as (
    select a.*, (a.fecha_hora at time zone 'Europe/Madrid')::date as dia
      from public.accesos a
     where a.fecha_hora >= v_desde and a.fecha_hora < v_hasta and a.tipo = 'entrada'
  ),
  -- Una persona cuenta una vez al día aunque entre y salga varias veces
  visitas as (
    select distinct e.dia, e.persona_id, e.pase_id
      from ent e
     where e.resultado = 'autorizado'
  )
  select jsonb_build_object(
    'por_dia', coalesce((
      select jsonb_agg(d order by d.dia) from (
        select v.dia,
               count(*) filter (where v.persona_id is not null) as socios,
               count(*) filter (where v.pase_id is not null) as invitados
          from visitas v group by v.dia
      ) d), '[]'::jsonb),
    'total_visitas', (select count(*) from visitas),
    'personas_distintas', (select count(distinct persona_id) from visitas),
    'invitados', (select count(*) from visitas where pase_id is not null),
    'por_parentesco', coalesce((
      select jsonb_object_agg(x.parentesco, x.n) from (
        select p.parentesco, count(*) as n
          from visitas v join public.personas p on p.id = v.persona_id
         group by p.parentesco) x), '{}'::jsonb),
    'jubilados', (select count(*) from visitas v join public.personas p on p.id = v.persona_id where p.es_jubilado),
    'fundadores', (select count(*) from visitas v join public.personas p on p.id = v.persona_id where p.es_fundador),
    'denegados', (select count(*) from ent where resultado = 'denegado'),
    'motivos_denegacion', coalesce((
      select jsonb_object_agg(x.motivo, x.n) from (
        select motivo, count(*) as n from ent where resultado = 'denegado' group by motivo) x), '{}'::jsonb),
    'por_hora', coalesce((
      select jsonb_object_agg(x.hora, x.n) from (
        select extract(hour from fecha_hora at time zone 'Europe/Madrid')::int as hora, count(*) as n
          from ent where resultado = 'autorizado' group by 1) x), '{}'::jsonb)
  ) into v_r;
  return v_r;
end $$;

-- =====================================================================
-- Seguridad (Row Level Security)
-- =====================================================================
alter table public.perfiles   enable row level security;
alter table public.temporadas enable row level security;
alter table public.socios     enable row level security;
alter table public.personas   enable row level security;
alter table public.cuotas     enable row level security;
alter table public.pases_dia  enable row level security;
alter table public.accesos    enable row level security;

-- Perfiles: cada uno ve el suyo; el administrador ve y cambia todos
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());
create policy perfiles_admin on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Datos del club: taquilla lee, administración escribe
create policy temporadas_ver on public.temporadas for select to authenticated using (public.es_staff());
create policy temporadas_admin on public.temporadas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy socios_ver on public.socios for select to authenticated using (public.es_staff());
create policy socios_admin on public.socios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy personas_ver on public.personas for select to authenticated using (public.es_staff());
create policy personas_admin on public.personas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy cuotas_ver on public.cuotas for select to authenticated using (public.es_staff());
create policy cuotas_admin on public.cuotas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Invitados: la taquilla también puede darlos de alta y cobrarlos
create policy pases_ver on public.pases_dia for select to authenticated using (public.es_staff());
create policy pases_crear on public.pases_dia for insert to authenticated with check (public.es_staff());
create policy pases_editar on public.pases_dia for update to authenticated
  using (public.es_staff()) with check (public.es_staff());
create policy pases_borrar on public.pases_dia for delete to authenticated using (public.es_admin());

-- Accesos: se leen, pero solo se escriben con registrar_acceso()
create policy accesos_ver on public.accesos for select to authenticated using (public.es_staff());

-- Funciones: quitar el acceso anónimo salvo al carnet digital
revoke execute on all functions in schema public from public, anon;
grant execute on function public.carnet_publico(uuid) to anon, authenticated;
grant execute on function public.registrar_acceso(text, public.tipo_movimiento) to authenticated;
grant execute on function public.presentes() to authenticated;
grant execute on function public.aforo_actual() to authenticated;
grant execute on function public.estadisticas(date, date) to authenticated;
grant execute on function public.activar_temporada(bigint) to authenticated;
grant execute on function public.es_staff() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.hoy() to anon, authenticated;
grant execute on function public.inicio_de_hoy() to authenticated;
grant execute on function public.normalizar_codigo(text) to authenticated;

-- =====================================================================
-- Fotos (Storage privado)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.es_staff());
create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_admin());
create policy fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_admin());
create policy fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_admin());
