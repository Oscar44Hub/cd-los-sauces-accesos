-- Comprobaciones tras aplicar 0002 sobre una base con datos
\set ON_ERROR_STOP on
\set QUIET on
create function public.comprobar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FALLO: %', p_msg; end if;
  raise notice 'ok  %', p_msg;
end $$;
grant execute on function public.comprobar(boolean, text) to authenticated;
select comprobar((select rol::text from perfiles where email = 'presidente@club.es') = 'superadmin', 'migración: el administrador pasa a superadmin');
select comprobar((select rol::text from perfiles where email = 'taquilla@club.es') = 'admin', 'migración: la taquilla pasa a admin');
select comprobar((select count(*) = 1 and sum(importe) = 150 and min(metodo) = 'Bizum' from pagos), 'migración: la cuota pagada conserva su pago');
select comprobar((select pagada from cuotas where importe = 150) and not (select pagada from cuotas where importe = 90), 'migración: el estado de las cuotas no cambia');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select comprobar((registrar_acceso('11111111-1111-1111-1111-111111111111') ->> 'resultado') = 'autorizado', 'migración: la taquilla sigue pudiendo escanear');
select comprobar((registrar_acceso('22222222-2222-2222-2222-222222222222') ->> 'motivo') = 'Cuota de la temporada pendiente de pago', 'migración: las reglas de acceso se mantienen');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select comprobar((select count(*) = 2 from cuotas), 'migración: el superadmin ve las cuotas');
reset role;
\echo 'MIGRACIÓN SOBRE DATOS EXISTENTES: OK'
