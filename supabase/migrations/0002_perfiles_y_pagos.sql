-- =====================================================================
-- 0002 · Perfiles superadmin / admin / socio y gestión de pagos
-- Ejecutar completo en el SQL Editor de Supabase (después de 0001).
-- Se aplica sobre una base con datos: no se pierde nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfiles
--    antes: admin (todo) · taquilla (escanear)
--    ahora: superadmin (todo, incluidos pagos) · admin (solo acceso) · socio
--    Las cuentas existentes se renombran solas: admin → superadmin, taquilla → admin.
-- ---------------------------------------------------------------------
alter type public.rol_usuario rename value 'admin' to 'superadmin';
alter type public.rol_usuario rename value 'taquilla' to 'admin';
alter type public.rol_usuario add value if not exists 'socio';

-- Cuenta de socio → familia a la que pertenece (puede haber varias cuentas por familia)
alter table public.perfiles add column socio_id bigint references public.socios (id) on delete set null;

-- Nota: se compara rol::text porque el valor 'socio' recién añadido no puede usarse
-- como literal del tipo dentro de la misma transacción.
create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text in ('admin', 'superadmin'))
$$;

create or replace function public.es_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol::text = 'superadmin')
$$;

-- Todas las políticas de escritura de 0001 usan es_admin(): pasan a ser solo del superadmin
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_superadmin()
$$;

-- Familia de la cuenta de socio que ha iniciado sesión (null si no es socio)
create or replace function public.mi_socio() returns bigint
language sql stable security definer set search_path = public as $$
  select socio_id from public.perfiles where id = auth.uid() and rol::text = 'socio'
$$;

-- ---------------------------------------------------------------------
-- 2. Lo que ve cada socio: solo su familia
-- ---------------------------------------------------------------------
create policy socios_propio on public.socios for select to authenticated using (id = public.mi_socio());
create policy personas_propias on public.personas for select to authenticated using (socio_id = public.mi_socio());
create policy temporadas_socio on public.temporadas for select to authenticated using (public.mi_socio() is not null);
create policy pases_propios on public.pases_dia for select to authenticated using (socio_id = public.mi_socio());
create policy pases_crear_socio on public.pases_dia for insert to authenticated with check (socio_id = public.mi_socio());
create policy accesos_propios on public.accesos for select to authenticated using (
  exists (select 1 from public.personas p where p.id = accesos.persona_id and p.socio_id = public.mi_socio())
  or exists (select 1 from public.pases_dia x where x.id = accesos.pase_id and x.socio_id = public.mi_socio())
);
create policy fotos_socio on storage.objects for select to authenticated using (
  bucket_id = 'fotos'
  and exists (select 1 from public.personas p where p.foto_path = storage.objects.name and p.socio_id = public.mi_socio())
);

-- Las cuotas (importes) solo las ven el superadmin y la propia familia; la taquilla no
drop policy cuotas_ver on public.cuotas;
create policy cuotas_ver on public.cuotas for select to authenticated
  using (public.es_superadmin() or socio_id = public.mi_socio());

-- La taquilla necesita saber si la cuota está al día, sin ver importes
create function public.cuotas_al_dia()
returns table (socio_id bigint, al_dia boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.exento_cuota or coalesce(c.pagada, false)
    from public.socios s
    left join public.cuotas c on c.socio_id = s.id and c.temporada_id = (select id from public.temporadas where activa)
   where public.es_staff()
$$;

-- Pases de invitado pedidos por el socio: se pagan en la taquilla y no pueden ser de días pasados
create or replace function public.preparar_pase() returns trigger
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
  if not public.es_staff() then
    if new.fecha < public.hoy() then
      raise exception 'El pase no puede ser para un día que ya ha pasado';
    end if;
    new.importe := v_t.precio_pase;
    new.pagado := v_t.precio_pase = 0;
  end if;
  select count(*) into v_usados from public.pases_dia
   where socio_id = new.socio_id and temporada_id = v_t.id;
  if v_usados >= v_t.max_pases_por_socio then
    raise exception 'El socio ya ha usado sus % pases de invitado de esta temporada', v_t.max_pases_por_socio;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Tarifas por tipo de socio
-- ---------------------------------------------------------------------
-- Tarifa que paga cada socio. Vacía = la de su tipo (familiar o individual).
alter table public.socios add column tarifa text
  check (tarifa in ('familiar', 'individual', 'jubilado', 'fundador'));

create table public.tarifas (
  temporada_id bigint not null references public.temporadas (id) on delete cascade,
  tarifa       text not null check (tarifa in ('familiar', 'individual', 'jubilado', 'fundador')),
  importe      numeric(8, 2) not null check (importe >= 0),
  primary key (temporada_id, tarifa)
);

-- ---------------------------------------------------------------------
-- 4. Pagos (una cuota puede pagarse en varios plazos)
-- ---------------------------------------------------------------------
create table public.pagos (
  id         bigint generated always as identity primary key,
  cuota_id   bigint not null references public.cuotas (id) on delete cascade,
  fecha      date not null default public.hoy(),
  importe    numeric(8, 2) not null check (importe > 0),
  metodo     text not null default 'Efectivo',
  referencia text,
  notas      text,
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en  timestamptz not null default now()
);
create index pagos_cuota on public.pagos (cuota_id);

-- Las cuotas marcadas como pagadas antes de esta versión pasan a tener su pago
insert into public.pagos (cuota_id, fecha, importe, metodo, notas)
select id, coalesce(fecha_pago, public.hoy()), importe, coalesce(metodo, 'Efectivo'), 'Pago registrado antes de la gestión de pagos'
  from public.cuotas
 where pagada and importe > 0;

-- La cuota está pagada cuando la suma de sus pagos cubre el importe.
-- Una cuota de 0 € no cuenta como pagada (evita dar acceso por una tarifa sin configurar).
create function public.recalcular_cuota(p_cuota bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_ultimo public.pagos;
begin
  select coalesce(sum(importe), 0) into v_total from public.pagos where cuota_id = p_cuota;
  select * into v_ultimo from public.pagos where cuota_id = p_cuota order by fecha desc, id desc limit 1;
  update public.cuotas
     set pagada = v_total > 0 and v_total >= importe,
         fecha_pago = case when v_total > 0 and v_total >= importe then v_ultimo.fecha end,
         metodo = v_ultimo.metodo
   where id = p_cuota;
end $$;

create function public.pagos_cambiados() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalcular_cuota(old.cuota_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.cuota_id <> old.cuota_id) then
    perform public.recalcular_cuota(new.cuota_id);
  end if;
  return null;
end $$;

create trigger pagos_actualizan_cuota
  after insert or update or delete on public.pagos
  for each row execute function public.pagos_cambiados();

-- Si cambia el importe de la cuota (p. ej. se corrige la tarifa), se vuelve a comprobar
create function public.cuota_importe_cambiado() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
begin
  select coalesce(sum(importe), 0) into v_total from public.pagos where cuota_id = new.id;
  new.pagada := v_total > 0 and v_total >= new.importe;
  return new;
end $$;

create trigger cuotas_importe
  before update of importe on public.cuotas
  for each row execute function public.cuota_importe_cambiado();

-- Crea la cuota de la temporada a cada socio activo según su tarifa
create function public.generar_cuotas(p_temporada bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_creadas int;
  v_sin_tarifa int;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el superadmin puede generar cuotas' using errcode = '42501';
  end if;
  insert into public.cuotas (socio_id, temporada_id, importe)
  select s.id, p_temporada, t.importe
    from public.socios s
    join public.tarifas t on t.temporada_id = p_temporada and t.tarifa = coalesce(s.tarifa, s.tipo::text)
   where s.activo and not s.exento_cuota
  on conflict (socio_id, temporada_id) do nothing;
  get diagnostics v_creadas = row_count;
  select count(*) into v_sin_tarifa
    from public.socios s
   where s.activo and not s.exento_cuota
     and not exists (select 1 from public.cuotas c where c.socio_id = s.id and c.temporada_id = p_temporada);
  return jsonb_build_object('creadas', v_creadas, 'sin_tarifa', v_sin_tarifa);
end $$;

-- ---------------------------------------------------------------------
-- 5. Seguridad de las tablas nuevas
-- ---------------------------------------------------------------------
alter table public.tarifas enable row level security;
alter table public.pagos enable row level security;

create policy tarifas_super on public.tarifas for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

create policy pagos_ver on public.pagos for select to authenticated using (
  public.es_superadmin()
  or exists (select 1 from public.cuotas c where c.id = pagos.cuota_id and c.socio_id = public.mi_socio())
);
create policy pagos_super on public.pagos for all to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

revoke execute on all functions in schema public from public, anon;
grant execute on function public.carnet_publico(uuid) to anon, authenticated;
grant execute on function public.hoy() to anon, authenticated;
grant execute on function public.es_superadmin() to authenticated;
grant execute on function public.mi_socio() to authenticated;
grant execute on function public.cuotas_al_dia() to authenticated;
grant execute on function public.generar_cuotas(bigint) to authenticated;
-- Funciones internas (solo las usan los triggers)
revoke execute on function public.recalcular_cuota(bigint) from authenticated;
revoke execute on function public.pagos_cambiados() from authenticated;
revoke execute on function public.cuota_importe_cambiado() from authenticated;
