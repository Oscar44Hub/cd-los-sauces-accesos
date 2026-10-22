-- Pruebas de la lógica de acceso. Se ejecutan con supabase/tests/ejecutar.sh
\set ON_ERROR_STOP on
\set QUIET on

create function public.comprobar(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FALLO: %', p_msg;
  end if;
  raise notice 'ok  %', p_msg;
end $$;
grant execute on function public.comprobar(boolean, text) to anon, authenticated;

-- Usuarios: un admin, un taquillero y una cuenta pendiente
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@club.es'),
  ('00000000-0000-0000-0000-00000000000b', 'taquilla@club.es'),
  ('00000000-0000-0000-0000-00000000000c', 'nuevo@club.es');
select comprobar((select count(*) = 3 from perfiles where rol = 'pendiente'), 'las cuentas nuevas quedan pendientes');
update perfiles set rol = 'admin' where email = 'admin@club.es';
update perfiles set rol = 'taquilla' where email = 'taquilla@club.es';

-- Datos de ejemplo
insert into temporadas (nombre, fecha_inicio, fecha_fin, activa, max_pases_por_socio, precio_pase)
values ('Verano', hoy() - 10, hoy() + 10, true, 2, 3);

insert into socios (numero, tipo) values (1, 'familiar'), (2, 'individual'), (3, 'familiar');
insert into socios (numero, tipo, exento_cuota) values (4, 'individual', true);

insert into personas (socio_id, nombre, apellidos, parentesco, fecha_nacimiento, codigo_qr, es_fundador)
values
  ((select id from socios where numero = 1), 'Ana', 'García', 'titular', '1980-05-01', '11111111-1111-1111-1111-111111111111', true),
  ((select id from socios where numero = 1), 'Leo', 'García', 'hijo', hoy() - interval '8 years', '11111111-1111-1111-1111-222222222222', false),
  ((select id from socios where numero = 2), 'Pedro', 'López', 'titular', null, '22222222-2222-2222-2222-222222222222', false),
  ((select id from socios where numero = 3), 'Rosa', 'Martín', 'abuelo', '1950-01-01', '33333333-3333-3333-3333-333333333333', false),
  ((select id from socios where numero = 4), 'Luis', 'Sanz', 'titular', '1945-01-01', '44444444-4444-4444-4444-444444444444', true);
update personas set es_jubilado = true where nombre in ('Rosa', 'Luis');

insert into cuotas (socio_id, temporada_id, importe, pagada)
select id, (select id from temporadas), 120, numero in (1, 2) from socios where numero in (1, 2, 3);

-- Un socio individual no admite una segunda persona
do $$ begin
  insert into personas (socio_id, nombre, apellidos) values ((select id from socios where numero = 2), 'X', 'Y');
  raise exception 'debía fallar';
exception when others then
  perform comprobar(sqlerrm like 'Un socio individual%', 'socio individual: solo una persona');
end $$;

-- normalizar_codigo
select comprobar(normalizar_codigo('11111111-1111-1111-1111-111111111111') = '11111111-1111-1111-1111-111111111111', 'código normal');
select comprobar(normalizar_codigo('https://club/#/carnet/11111111-1111-1111-1111-111111111111') = '11111111-1111-1111-1111-111111111111', 'código dentro de una URL');
select comprobar(normalizar_codigo('11111111''1111''1111''1111''111111111111') = '11111111-1111-1111-1111-111111111111', 'lector USB con teclado español');
select comprobar(normalizar_codigo('hola') is null, 'texto que no es código');

-- ===== Como anónimo =====
set role anon;
select comprobar((carnet_publico('11111111-1111-1111-1111-111111111111') ->> 'nombre') = 'Ana', 'carnet digital accesible sin cuenta');
select comprobar(not (carnet_publico('11111111-1111-1111-1111-111111111111') ? 'dni'), 'el carnet digital no expone el DNI');
do $$ begin
  perform registrar_acceso('11111111-1111-1111-1111-111111111111');
  raise exception 'debía fallar';
exception when insufficient_privilege then
  perform comprobar(true, 'anónimo no puede registrar accesos');
end $$;
reset role;

-- ===== Cuenta pendiente =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select comprobar((select count(*) = 0 from socios), 'cuenta pendiente no ve socios');
do $$ begin
  perform registrar_acceso('11111111-1111-1111-1111-111111111111');
  raise exception 'debía fallar';
exception when insufficient_privilege then
  perform comprobar(true, 'cuenta pendiente no puede registrar accesos');
end $$;
do $$ begin
  update perfiles set rol = 'admin' where id = auth.uid();
  perform comprobar((select rol from perfiles where id = auth.uid()) is null
                    or (select rol from perfiles where id = auth.uid()) = 'pendiente', 'no puede hacerse admin a sí mismo');
end $$;

-- ===== Taquilla =====
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select comprobar((select count(*) = 4 from socios), 'taquilla ve los socios');
do $$ begin
  update socios set activo = false where numero = 1;
  perform comprobar((select activo from socios where numero = 1), 'taquilla no puede modificar socios');
end $$;

select comprobar((registrar_acceso('11111111-1111-1111-1111-111111111111') ->> 'resultado') = 'autorizado', 'socio con cuota pagada entra');
select comprobar((registrar_acceso('11111111-1111-1111-1111-111111111111') ->> 'duplicado')::boolean, 'doble lectura no se duplica');
select comprobar((select count(*) = 1 from accesos where persona_id = (select id from personas where nombre = 'Ana')), 'solo un registro de entrada');
select comprobar((registrar_acceso('11111111-1111-1111-1111-222222222222') -> 'persona' ->> 'edad')::int = 8, 'muestra la edad del menor');
select comprobar(aforo_actual() = 2, 'aforo = 2 tras dos entradas');
select comprobar((registrar_acceso('33333333-3333-3333-3333-333333333333') ->> 'motivo') = 'Cuota de la temporada pendiente de pago', 'cuota impagada se deniega');
select comprobar((registrar_acceso('44444444-4444-4444-4444-444444444444') ->> 'resultado') = 'autorizado', 'socio exento de cuota entra');
select comprobar((registrar_acceso('99999999-9999-9999-9999-999999999999') ->> 'motivo') = 'Código no reconocido', 'QR desconocido');
select comprobar((registrar_acceso('11111111-1111-1111-1111-111111111111', 'salida') ->> 'resultado') = 'autorizado', 'salida registrada');
select comprobar(aforo_actual() = 2, 'aforo baja tras la salida');
do $$ begin
  insert into accesos (tipo, resultado) values ('entrada', 'autorizado');
  raise exception 'debía fallar';
exception when insufficient_privilege then
  perform comprobar(true, 'no se pueden insertar accesos a mano');
end $$;

-- Invitados: límite de 2 por temporada, pase con precio debe estar pagado
insert into pases_dia (socio_id, nombre_invitado, importe, pagado)
values ((select id from socios where numero = 1), 'Primo Juan', 3, false);
select comprobar((registrar_acceso((select codigo_qr::text from pases_dia where nombre_invitado = 'Primo Juan')) ->> 'motivo')
  = 'Pase de invitado pendiente de pago', 'pase sin pagar se deniega');
update pases_dia set pagado = true where nombre_invitado = 'Primo Juan';
select comprobar((registrar_acceso((select codigo_qr::text from pases_dia where nombre_invitado = 'Primo Juan')) ->> 'resultado')
  = 'autorizado', 'pase pagado entra');
insert into pases_dia (socio_id, nombre_invitado, fecha) values ((select id from socios where numero = 1), 'Amiga Eva', hoy() + 1);
select comprobar((registrar_acceso((select codigo_qr::text from pases_dia where nombre_invitado = 'Amiga Eva')) ->> 'motivo')
  like 'Pase válido solo para el%', 'pase de otro día se deniega');
do $$ begin
  insert into pases_dia (socio_id, nombre_invitado) values ((select id from socios where numero = 1), 'Tercero');
  raise exception 'debía fallar';
exception when others then
  perform comprobar(sqlerrm like 'El socio ya ha usado sus 2 pases%', 'límite de invitados por temporada');
end $$;

select comprobar((estadisticas(hoy(), hoy()) ->> 'total_visitas')::int = 4, 'estadísticas: 4 visitas hoy');
select comprobar((estadisticas(hoy(), hoy()) ->> 'invitados')::int = 1, 'estadísticas: 1 invitado');
select comprobar((estadisticas(hoy(), hoy()) ->> 'denegados')::int = 4, 'estadísticas: 4 denegados');

-- ===== Admin =====
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update personas set estado_tarjeta = 'perdida' where nombre = 'Pedro';
select comprobar((registrar_acceso('22222222-2222-2222-2222-222222222222') ->> 'motivo') = 'Tarjeta marcada como perdida', 'tarjeta perdida se deniega');
update personas set codigo_qr = gen_random_uuid(), estado_tarjeta = 'activa' where nombre = 'Pedro';
select comprobar((registrar_acceso((select codigo_qr::text from personas where nombre = 'Pedro')) ->> 'resultado') = 'autorizado', 'tarjeta nueva tras regenerar el QR');

update temporadas set aforo_maximo = 4;
insert into personas (socio_id, nombre, apellidos, parentesco, codigo_qr)
values ((select id from socios where numero = 1), 'Sara', 'García', 'conyuge', '55555555-5555-5555-5555-555555555555');
select comprobar(aforo_actual() = 4, 'aforo lleno (4)');
select comprobar((registrar_acceso('55555555-5555-5555-5555-555555555555') ->> 'motivo') = 'Aforo completo', 'aforo completo se deniega');
select comprobar((registrar_acceso('11111111-1111-1111-1111-222222222222', 'salida') ->> 'resultado') = 'autorizado', 'con aforo lleno se puede salir');

insert into temporadas (nombre, fecha_inicio, fecha_fin) values ('Siguiente', hoy() + 300, hoy() + 360);
select activar_temporada((select id from temporadas where nombre = 'Siguiente'));
select comprobar((select nombre from temporadas where activa) = 'Siguiente', 'activar temporada');
select comprobar((registrar_acceso('44444444-4444-4444-4444-444444444444') ->> 'motivo') = 'Fuera de las fechas de la temporada', 'fuera de temporada se deniega');

update perfiles set rol = 'taquilla' where email = 'nuevo@club.es';
select comprobar((select rol from perfiles where email = 'nuevo@club.es') = 'taquilla', 'admin aprueba cuentas');
reset role;

\echo 'TODAS LAS PRUEBAS SUPERADAS'
