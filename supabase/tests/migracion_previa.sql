-- Datos como los que ya tiene el club antes de aplicar 0002 (perfiles con los nombres antiguos)
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'presidente@club.es'),
  ('00000000-0000-0000-0000-0000000000b1', 'taquilla@club.es');
update perfiles set rol = 'admin' where email = 'presidente@club.es';
update perfiles set rol = 'taquilla' where email = 'taquilla@club.es';
insert into temporadas (nombre, fecha_inicio, fecha_fin, activa) values ('Verano', hoy() - 5, hoy() + 5, true);
insert into socios (numero, tipo) values (1, 'familiar'), (2, 'individual');
insert into personas (socio_id, nombre, apellidos, codigo_qr) values
  ((select id from socios where numero = 1), 'Ana', 'García', '11111111-1111-1111-1111-111111111111'),
  ((select id from socios where numero = 2), 'Pedro', 'López', '22222222-2222-2222-2222-222222222222');
insert into cuotas (socio_id, temporada_id, importe, pagada, fecha_pago, metodo) values
  ((select id from socios where numero = 1), (select id from temporadas), 150, true, hoy() - 3, 'Bizum'),
  ((select id from socios where numero = 2), (select id from temporadas), 90, false, null, null);
