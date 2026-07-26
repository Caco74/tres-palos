begin;

-- Carga transaccional Clausura 2026.
-- Estado inicial requerido: torneo_id=2 sin partidos y Apertura id=1 con 140 partidos.
-- Proteccion: este SQL falla hasta reemplazar el literal PENDIENTE_AUTORIZACION
-- por la frase exacta autorizada por el usuario.

do $$
declare
  v_autorizacion constant text := 'PENDIENTE_AUTORIZACION';
  v_fixture constant jsonb := $fixture_json$
[
  {
    "source_fixture_key": "C2026-F01-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 46,
    "local": "C.A. Cosmopolita",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 54,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 53,
    "local": "Sportivo A. Club",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 2,
    "local_id": 58,
    "visitante_id": 61,
    "local": "C.A. Am\u00e9rica",
    "visitante": "Belgrano A.C.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 2,
    "local_id": 52,
    "visitante_id": 56,
    "local": "C.A. Campa\u00f1a",
    "visitante": "C.A. Uni\u00f3n C.S.D.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 2,
    "local_id": 48,
    "visitante_id": 59,
    "local": "C.A. Montes de Oca",
    "visitante": "C.A. N.O. Boys",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 62,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 45,
    "local": "C.A. Defensores",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F01-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 1,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 63,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 55,
    "local": "AD Everton/Olimpia",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 47,
    "local": "C.A. Correa",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 49,
    "local": "Def. Sportsman",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 2,
    "local_id": 61,
    "visitante_id": 52,
    "local": "Belgrano A.C.",
    "visitante": "C.A. Campa\u00f1a",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 2,
    "local_id": 58,
    "visitante_id": 48,
    "local": "C.A. Am\u00e9rica",
    "visitante": "C.A. Montes de Oca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 2,
    "local_id": 56,
    "visitante_id": 59,
    "local": "C.A. Uni\u00f3n C.S.D.",
    "visitante": "C.A. N.O. Boys",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 44,
    "local": "C.A. Barraca",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 51,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F02-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 2,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 60,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 54,
    "local": "Argentino A. Club",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 53,
    "local": "C.A. Cosmopolita",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 43,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 2,
    "local_id": 52,
    "visitante_id": 58,
    "local": "C.A. Campa\u00f1a",
    "visitante": "C.A. Am\u00e9rica",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 2,
    "local_id": 48,
    "visitante_id": 56,
    "local": "C.A. Montes de Oca",
    "visitante": "C.A. Uni\u00f3n C.S.D.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 2,
    "local_id": 59,
    "visitante_id": 61,
    "local": "C.A. N.O. Boys",
    "visitante": "Belgrano A.C.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 62,
    "local": "C.A. Defensores",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 50,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F03-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 3,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 63,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 55,
    "local": "C.A. Correa",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 46,
    "local": "Def. Sportsman",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 49,
    "local": "Sportivo A. Club",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 2,
    "local_id": 61,
    "visitante_id": 56,
    "local": "Belgrano A.C.",
    "visitante": "C.A. Uni\u00f3n C.S.D.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 2,
    "local_id": 58,
    "visitante_id": 59,
    "local": "C.A. Am\u00e9rica",
    "visitante": "C.A. N.O. Boys",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 2,
    "local_id": 52,
    "visitante_id": 48,
    "local": "C.A. Campa\u00f1a",
    "visitante": "C.A. Montes de Oca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 44,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 45,
    "local": "C.A. Barraca",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F04-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 4,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 51,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 53,
    "local": "AD Everton/Olimpia",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 43,
    "local": "Argentino A. Club",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 47,
    "local": "C.A. Cosmopolita",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 2,
    "local_id": 48,
    "visitante_id": 61,
    "local": "C.A. Montes de Oca",
    "visitante": "Belgrano A.C.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 2,
    "local_id": 59,
    "visitante_id": 52,
    "local": "C.A. N.O. Boys",
    "visitante": "C.A. Campa\u00f1a",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 2,
    "local_id": 56,
    "visitante_id": 58,
    "local": "C.A. Uni\u00f3n C.S.D.",
    "visitante": "C.A. Am\u00e9rica",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 60,
    "local": "C.A. Defensores",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 62,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F05-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 5,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 50,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 54,
    "local": "C.A. Correa",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 55,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 46,
    "local": "Sportivo A. Club",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 45,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 51,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F06-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 6,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 63,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 47,
    "local": "AD Everton/Olimpia",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 49,
    "local": "Argentino A. Club",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 43,
    "local": "Def. Sportsman",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 50,
    "local": "C.A. Barraca",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 60,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F07-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 7,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 44,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 49,
    "local": "AD Everton/Olimpia",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 43,
    "local": "C.A. Correa",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 47,
    "local": "Def. Sportsman",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 2,
    "local_id": 61,
    "visitante_id": 58,
    "local": "Belgrano A.C.",
    "visitante": "C.A. Am\u00e9rica",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 2,
    "local_id": 59,
    "visitante_id": 48,
    "local": "C.A. N.O. Boys",
    "visitante": "C.A. Montes de Oca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 2,
    "local_id": 56,
    "visitante_id": 52,
    "local": "C.A. Uni\u00f3n C.S.D.",
    "visitante": "C.A. Campa\u00f1a",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 60,
    "local": "C.A. Barraca",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 44,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F08-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 8,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 50,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 46,
    "local": "Argentino A. Club",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 54,
    "local": "C.A. Cosmopolita",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 53,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 2,
    "local_id": 52,
    "visitante_id": 61,
    "local": "C.A. Campa\u00f1a",
    "visitante": "Belgrano A.C.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 2,
    "local_id": 48,
    "visitante_id": 58,
    "local": "C.A. Montes de Oca",
    "visitante": "C.A. Am\u00e9rica",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 2,
    "local_id": 59,
    "visitante_id": 56,
    "local": "C.A. N.O. Boys",
    "visitante": "C.A. Uni\u00f3n C.S.D.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 63,
    "local": "C.A. Defensores",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 62,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F09-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 9,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 45,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 49,
    "local": "C.A. Correa",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 55,
    "local": "Def. Sportsman",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 47,
    "local": "Sportivo A. Club",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 2,
    "local_id": 61,
    "visitante_id": 59,
    "local": "Belgrano A.C.",
    "visitante": "C.A. N.O. Boys",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 2,
    "local_id": 58,
    "visitante_id": 52,
    "local": "C.A. Am\u00e9rica",
    "visitante": "C.A. Campa\u00f1a",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 2,
    "local_id": 56,
    "visitante_id": 48,
    "local": "C.A. Uni\u00f3n C.S.D.",
    "visitante": "C.A. Montes de Oca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 60,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 51,
    "local": "C.A. Barraca",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F10-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 10,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 44,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 54,
    "local": "AD Everton/Olimpia",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 53,
    "local": "Argentino A. Club",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 43,
    "local": "C.A. Cosmopolita",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 2,
    "local_id": 48,
    "visitante_id": 52,
    "local": "C.A. Montes de Oca",
    "visitante": "C.A. Campa\u00f1a",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 2,
    "local_id": 59,
    "visitante_id": 58,
    "local": "C.A. N.O. Boys",
    "visitante": "C.A. Am\u00e9rica",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 2,
    "local_id": 56,
    "visitante_id": 61,
    "local": "C.A. Uni\u00f3n C.S.D.",
    "visitante": "Belgrano A.C.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 50,
    "local": "C.A. Defensores",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 63,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F11-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 11,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 62,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 1,
    "local_id": 53,
    "visitante_id": 46,
    "local": "C.A. Correa",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 49,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "C.A. Cosmopolita",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 55,
    "local": "Sportivo A. Club",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z2-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 2,
    "local_id": 61,
    "visitante_id": 48,
    "local": "Belgrano A.C.",
    "visitante": "C.A. Montes de Oca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z2-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 2,
    "local_id": 58,
    "visitante_id": 56,
    "local": "C.A. Am\u00e9rica",
    "visitante": "C.A. Uni\u00f3n C.S.D.",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z2-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 2,
    "local_id": 52,
    "visitante_id": 59,
    "local": "C.A. Campa\u00f1a",
    "visitante": "C.A. N.O. Boys",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 51,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 44,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. Defensores",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F12-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 12,
    "zona": 3,
    "local_id": 62,
    "visitante_id": 45,
    "local": "C.A. Uni\u00f3n Tortugas",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 1,
    "local_id": 46,
    "visitante_id": 43,
    "local": "AD Everton/Olimpia",
    "visitante": "Sportivo A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 1,
    "local_id": 55,
    "visitante_id": 47,
    "local": "Argentino A. Club",
    "visitante": "Sport C. Ca\u00f1adense",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 1,
    "local_id": 54,
    "visitante_id": 53,
    "local": "Def. Sportsman",
    "visitante": "C.A. Correa",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 3,
    "local_id": 63,
    "visitante_id": 62,
    "local": "C.A. Barraca",
    "visitante": "C.A. Uni\u00f3n Tortugas",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 3,
    "local_id": 45,
    "visitante_id": 50,
    "local": "C.A. El Porvenir del Norte",
    "visitante": "C.A. Almafuerte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F13-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 13,
    "zona": 3,
    "local_id": 51,
    "visitante_id": 60,
    "local": "C.A. Williams Kemmis",
    "visitante": "C.A. San Jer\u00f3nimo",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z1-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 1,
    "local_id": 49,
    "visitante_id": 55,
    "local": "C.A. Cosmopolita",
    "visitante": "Argentino A. Club",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z1-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 1,
    "local_id": 47,
    "visitante_id": 46,
    "local": "Sport C. Ca\u00f1adense",
    "visitante": "AD Everton/Olimpia",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z1-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 1,
    "local_id": 43,
    "visitante_id": 54,
    "local": "Sportivo A. Club",
    "visitante": "Def. Sportsman",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z3-01",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 3,
    "local_id": 50,
    "visitante_id": 63,
    "local": "C.A. Almafuerte",
    "visitante": "C.A. Barraca",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z3-02",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 3,
    "local_id": 44,
    "visitante_id": 51,
    "local": "C.A. Defensores",
    "visitante": "C.A. Williams Kemmis",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  },
  {
    "source_fixture_key": "C2026-F14-Z3-03",
    "torneo_id": 2,
    "tipo": "regular",
    "fecha": 14,
    "zona": 3,
    "local_id": 60,
    "visitante_id": 45,
    "local": "C.A. San Jer\u00f3nimo",
    "visitante": "C.A. El Porvenir del Norte",
    "fecha_partido": null,
    "dia": null,
    "hora": null,
    "estadio": null,
    "arbitro": null,
    "estado": "programado",
    "goles_local": null,
    "goles_visitante": null,
    "penales_local": null,
    "penales_visitante": null,
    "fase": null,
    "numero_playoff": null,
    "source_local": null,
    "source_visitante": null
  }
]
$fixture_json$::jsonb;
  v_expected_clubs constant jsonb := $clubs_json$
[
  {
    "nombre_fuente": "C.A. COSMOPOLITA",
    "nombre_en_proyecto": "C.A. Cosmopolita",
    "club_id": 49,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "SPORT C. CA\u00d1ADENSE",
    "nombre_en_proyecto": "Sport C. Ca\u00f1adense",
    "club_id": 47,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "SPORTIVO A. CLUB",
    "nombre_en_proyecto": "Sportivo A. Club",
    "club_id": 43,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. CORREA",
    "nombre_en_proyecto": "C.A. Correa",
    "club_id": 53,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "DEF. SPORTSMAN",
    "nombre_en_proyecto": "Def. Sportsman",
    "club_id": 54,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "AD.EVERTON/OLIMPIA",
    "nombre_en_proyecto": "AD Everton/Olimpia",
    "club_id": 46,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "ARGENTINO A. CLUB",
    "nombre_en_proyecto": "Argentino A. Club",
    "club_id": 55,
    "zona_clausura": 1,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. MONTES DE OCA",
    "nombre_en_proyecto": "C.A. Montes de Oca",
    "club_id": 48,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. N.O. BOYS",
    "nombre_en_proyecto": "C.A. N.O. Boys",
    "club_id": 59,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. CAMPA\u00d1A",
    "nombre_en_proyecto": "C.A. Campa\u00f1a",
    "club_id": 52,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. UNION C.S.D.",
    "nombre_en_proyecto": "C.A. Uni\u00f3n C.S.D.",
    "club_id": 56,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. AMERICA",
    "nombre_en_proyecto": "C.A. Am\u00e9rica",
    "club_id": 58,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "BELGRANO A.C.",
    "nombre_en_proyecto": "Belgrano A.C.",
    "club_id": 61,
    "zona_clausura": 2,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. DEFENSORES",
    "nombre_en_proyecto": "C.A. Defensores",
    "club_id": 44,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. SAN JERONIMO",
    "nombre_en_proyecto": "C.A. San Jer\u00f3nimo",
    "club_id": 60,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. ALMAFUERTE",
    "nombre_en_proyecto": "C.A. Almafuerte",
    "club_id": 50,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. UNION TORTUGAS",
    "nombre_en_proyecto": "C.A. Uni\u00f3n Tortugas",
    "club_id": 62,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. BARRACA",
    "nombre_en_proyecto": "C.A. Barraca",
    "club_id": 63,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A. EL PORVENIR DEL NORTE",
    "nombre_en_proyecto": "C.A. El Porvenir del Norte",
    "club_id": 45,
    "zona_clausura": 3,
    "estado": "confirmado"
  },
  {
    "nombre_fuente": "C.A.WILLIAMS KEMMIS",
    "nombre_en_proyecto": "C.A. Williams Kemmis",
    "club_id": 51,
    "zona_clausura": 3,
    "estado": "confirmado"
  }
]
$clubs_json$::jsonb;
  v_torneo public.torneos%rowtype;
  v_inserted integer := 0;
  v_total_before integer := 0;
  v_total_after integer := 0;
  v_existing_matched integer := 0;
  v_existing_identical integer := 0;
  v_existing_unmatched integer := 0;
  v_existing_duplicate_keys integer := 0;
  v_conflicts integer := 0;
  v_bad integer := 0;
  v_apertura_total_before integer := 0;
  v_apertura_total_after integer := 0;
  v_historical_checksum_before text := '';
  v_historical_checksum_after text := '';
  v_clubes_zona_checksum_before text := '';
  v_clubes_zona_checksum_after text := '';
begin
  if v_autorizacion is distinct from 'AUTORIZO CARGA CLAUSURA 2026' then
    raise exception 'Autorizacion exacta requerida antes de cargar Clausura 2026.';
  end if;

  perform pg_advisory_xact_lock(hashtext('tres-palos:cargar-clausura-2026:torneo:2'));

  select *
  into v_torneo
  from public.torneos
  where id = 2
  for update;

  if not found then
    raise exception 'No existe torneo_id=2.';
  end if;

  if v_torneo.anio <> 2026
    or v_torneo.tipo <> 'clausura'
    or v_torneo.nombre <> 'Clausura 2026'
  then
    raise exception 'torneo_id=2 no corresponde a Clausura 2026.';
  end if;

  if v_torneo.activo is not false then
    raise exception 'El Clausura no debe estar activo antes de esta carga.';
  end if;

  if not exists (
    select 1
    from public.torneos
    where id = 1
      and anio = 2026
      and tipo = 'apertura'
      and nombre = 'Apertura 2026'
      and activo is true
  ) then
    raise exception 'El torneo activo actual no es Apertura 2026 id 1.';
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_expected_clubs) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  )
  left join public.clubes club
    on club.id = expected.club_id
  where club.id is null
    or club.nombre_oficial is distinct from expected.nombre_en_proyecto
    or club.activo is false
    or expected.estado is distinct from 'confirmado';

  if v_bad <> 0 then
    raise exception 'Hay % club(es) esperados sin mapeo remoto confirmado.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_expected_clubs) as expected(
    nombre_fuente text,
    nombre_en_proyecto text,
    club_id bigint,
    zona_clausura integer,
    estado text
  );

  if v_bad <> 20 then
    raise exception 'Se esperaban 20 clubes mapeados y hay %.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_fixture) as fixture(
    source_fixture_key text,
    torneo_id bigint,
    tipo text,
    fecha integer,
    zona text,
    local_id integer,
    visitante_id integer,
    local text,
    visitante text,
    fecha_partido date,
    dia text,
    hora text,
    estadio text,
    arbitro text,
    estado text,
    goles_local integer,
    goles_visitante integer,
    penales_local integer,
    penales_visitante integer,
    fase text,
    numero_playoff integer,
    source_local text,
    source_visitante text
  )
  where fixture.torneo_id <> 2
    or fixture.tipo <> 'regular'
    or fixture.fecha is null
    or fixture.zona not in ('1', '2', '3')
    or fixture.local_id is null
    or fixture.visitante_id is null
    or fixture.local_id = fixture.visitante_id
    or fixture.local is null
    or fixture.visitante is null
    or fixture.local = fixture.visitante
    or fixture.fecha_partido is not null
    or fixture.dia is not null
    or fixture.hora is not null
    or fixture.estadio is not null
    or fixture.arbitro is not null
    or fixture.estado <> 'programado'
    or fixture.goles_local is not null
    or fixture.goles_visitante is not null
    or fixture.penales_local is not null
    or fixture.penales_visitante is not null
    or fixture.fase is not null
    or fixture.numero_playoff is not null
    or fixture.source_local is not null
    or fixture.source_visitante is not null
    or fixture.local_id = 57
    or fixture.visitante_id = 57;

  if v_bad <> 0 then
    raise exception 'Hay % registro(s) del fixture con campos iniciales invalidos.', v_bad;
  end if;

  select count(*)
  into v_bad
  from jsonb_to_recordset(v_fixture) as fixture(
    source_fixture_key text,
    torneo_id bigint,
    tipo text,
    fecha integer,
    zona text,
    local_id integer,
    visitante_id integer,
    local text,
    visitante text,
    fecha_partido date,
    dia text,
    hora text,
    estadio text,
    arbitro text,
    estado text,
    goles_local integer,
    goles_visitante integer,
    penales_local integer,
    penales_visitante integer,
    fase text,
    numero_playoff integer,
    source_local text,
    source_visitante text
  );

  if v_bad <> 114 then
    raise exception 'Se esperaban 114 registros del fixture y hay %.', v_bad;
  end if;

  select count(*)
  into v_bad
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from jsonb_to_recordset(v_fixture) as fixture(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicated_fixture;

  if v_bad <> 0 then
    raise exception 'El fixture contiene % clave(s) logicas duplicadas.', v_bad;
  end if;

  select count(*)
  into v_apertura_total_before
  from public.partidos
  where torneo_id = 1;

  if v_apertura_total_before <> 140 then
    raise exception 'Apertura 2026 debe tener 140 partidos antes de cargar; tiene %.', v_apertura_total_before;
  end if;

  if (
    select count(*)
    from public.partidos
    where torneo_id = 1
      and tipo = 'regular'
      and (
        source_local is not null
        or source_visitante is not null
      )
  ) <> 0 then
    raise exception 'La fase regular del Apertura usa source_local/source_visitante; revisar convencion antes de cargar.';
  end if;

  select md5(coalesce(string_agg(to_jsonb(partido)::text, '|' order by partido.id), ''))
  into v_historical_checksum_before
  from public.partidos partido
  where partido.torneo_id is distinct from 2;

  select md5(coalesce(string_agg((club.id::text || ':' || club.zona::text), '|' order by club.id), ''))
  into v_clubes_zona_checksum_before
  from public.clubes club;

  select count(*)
  into v_total_before
  from public.partidos
  where torneo_id = 2;

  select count(*)
  into v_existing_duplicate_keys
  from (
    select torneo_id, tipo, fecha, zona, local_id, visitante_id
    from public.partidos
    where torneo_id = 2
      and tipo = 'regular'
    group by torneo_id, tipo, fecha, zona, local_id, visitante_id
    having count(*) > 1
  ) duplicated_existing;

  if v_existing_duplicate_keys <> 0 then
    raise exception 'El Clausura ya tiene % clave(s) logicas duplicadas.', v_existing_duplicate_keys;
  end if;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  ),
  matched as (
    select
      fixture.*,
      partido.id as partido_id,
      partido.fecha_partido as p_fecha_partido,
      partido.dia as p_dia,
      partido.hora as p_hora,
      partido.estadio as p_estadio,
      partido.arbitro as p_arbitro,
      partido.estado as p_estado,
      partido.goles_local as p_goles_local,
      partido.goles_visitante as p_goles_visitante,
      partido.penales_local as p_penales_local,
      partido.penales_visitante as p_penales_visitante,
      partido.fase as p_fase,
      partido.numero_playoff as p_numero_playoff,
      partido.local as p_local,
      partido.visitante as p_visitante,
      partido.source_local as p_source_local,
      partido.source_visitante as p_source_visitante
    from fixture
    join public.partidos partido
      on partido.torneo_id = fixture.torneo_id
      and partido.tipo = fixture.tipo
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
  )
  select
    count(*),
    count(*) filter (
      where p_local is not distinct from local
        and p_visitante is not distinct from visitante
        and p_fecha_partido is not distinct from fecha_partido
        and p_dia is not distinct from dia
        and p_hora is not distinct from hora
        and p_estadio is not distinct from estadio
        and p_arbitro is not distinct from arbitro
        and p_estado is not distinct from estado
        and p_goles_local is not distinct from goles_local
        and p_goles_visitante is not distinct from goles_visitante
        and p_penales_local is not distinct from penales_local
        and p_penales_visitante is not distinct from penales_visitante
        and p_fase is not distinct from fase
        and p_numero_playoff is not distinct from numero_playoff
        and p_source_local is not distinct from source_local
        and p_source_visitante is not distinct from source_visitante
    )
  into v_existing_matched, v_existing_identical
  from matched;

  v_conflicts := v_existing_matched - v_existing_identical;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  )
  select count(*)
  into v_existing_unmatched
  from public.partidos partido
  where partido.torneo_id = 2
    and not exists (
      select 1
      from fixture
      where fixture.torneo_id = partido.torneo_id
        and fixture.tipo = partido.tipo
        and fixture.fecha = partido.fecha
        and fixture.zona = partido.zona
        and fixture.local_id = partido.local_id
        and fixture.visitante_id = partido.visitante_id
    );

  if v_conflicts <> 0 then
    raise exception 'Hay % partido(s) existentes con diferencias.', v_conflicts;
  end if;

  if v_existing_unmatched <> 0 then
    raise exception 'Hay % partido(s) no esperados en Clausura.', v_existing_unmatched;
  end if;

  if v_total_before not in (0, 114) then
    raise exception 'Estado parcial del Clausura: % partido(s) antes de cargar.', v_total_before;
  end if;

  if v_total_before = 114 and v_existing_identical <> 114 then
    raise exception 'El Clausura tiene 114 partidos, pero no coinciden exactamente con el fixture.';
  end if;

  if v_total_before = 0 then
    insert into public.partidos (
      torneo_id,
      tipo,
      fecha,
      zona,
      local_id,
      visitante_id,
      local,
      visitante,
      fecha_partido,
      dia,
      hora,
      estadio,
      arbitro,
      estado,
      goles_local,
      goles_visitante,
      penales_local,
      penales_visitante,
      fase,
      numero_playoff,
      source_local,
      source_visitante
    )
    select
      fixture.torneo_id,
      fixture.tipo,
      fixture.fecha,
      fixture.zona,
      fixture.local_id,
      fixture.visitante_id,
      fixture.local,
      fixture.visitante,
      fixture.fecha_partido,
      fixture.dia,
      fixture.hora,
      fixture.estadio,
      fixture.arbitro,
      fixture.estado,
      fixture.goles_local,
      fixture.goles_visitante,
      fixture.penales_local,
      fixture.penales_visitante,
      fixture.fase,
      fixture.numero_playoff,
      fixture.source_local,
      fixture.source_visitante
    from jsonb_to_recordset(v_fixture) as fixture(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
    where not exists (
      select 1
      from public.partidos partido
      where partido.torneo_id = fixture.torneo_id
        and partido.tipo = fixture.tipo
        and partido.fecha = fixture.fecha
        and partido.zona = fixture.zona
        and partido.local_id = fixture.local_id
        and partido.visitante_id = fixture.visitante_id
    );

    get diagnostics v_inserted = row_count;

    if v_inserted <> 114 then
      raise exception 'La insercion debia crear 114 partidos y creo %.', v_inserted;
    end if;
  end if;

  if v_total_before = 114 and v_inserted <> 0 then
    raise exception 'La re-ejecucion idempotente no debe insertar registros.';
  end if;

  select count(*)
  into v_total_after
  from public.partidos
  where torneo_id = 2;

  if v_total_after <> 114 then
    raise exception 'Post-carga invalida: Clausura tiene % partidos.', v_total_after;
  end if;

  select count(*)
  into v_bad
  from public.partidos
  where torneo_id = 2
    and tipo = 'regular'
    and (
      fase is not null
      or estado <> 'programado'
      or goles_local is not null
      or goles_visitante is not null
      or penales_local is not null
      or penales_visitante is not null
      or fecha_partido is not null
      or dia is not null
      or hora is not null
      or estadio is not null
      or arbitro is not null
      or numero_playoff is not null
      or source_local is not null
      or source_visitante is not null
      or local_id = visitante_id
      or local = visitante
    );

  if v_bad <> 0 then
    raise exception 'Post-carga invalida: % partido(s) tienen campos no esperados.', v_bad;
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and tipo = 'regular') <> 114 then
    raise exception 'Post-carga invalida: no todos los partidos son regulares.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '1') <> 42 then
    raise exception 'Post-carga invalida: Zona 1 no tiene 42 partidos.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '2') <> 30 then
    raise exception 'Post-carga invalida: Zona 2 no tiene 30 partidos.';
  end if;

  if (select count(*) from public.partidos where torneo_id = 2 and zona = '3') <> 42 then
    raise exception 'Post-carga invalida: Zona 3 no tiene 42 partidos.';
  end if;

  if (
    select count(*)
    from (
      select torneo_id, tipo, fecha, zona, local_id, visitante_id
      from public.partidos
      where torneo_id = 2
        and tipo = 'regular'
      group by torneo_id, tipo, fecha, zona, local_id, visitante_id
      having count(*) > 1
    ) duplicated_after
  ) <> 0 then
    raise exception 'Post-carga invalida: hay duplicados por clave logica.';
  end if;

  if (
    select count(*)
    from public.partidos
    where torneo_id = 2
      and (
        local_id = 57
        or visitante_id = 57
        or local ilike '%Carcara%'
        or visitante ilike '%Carcara%'
      )
  ) <> 0 then
    raise exception 'Post-carga invalida: Carcarana aparece en Clausura.';
  end if;

  with fixture as (
    select *
    from jsonb_to_recordset(v_fixture) as item(
      source_fixture_key text,
      torneo_id bigint,
      tipo text,
      fecha integer,
      zona text,
      local_id integer,
      visitante_id integer,
      local text,
      visitante text,
      fecha_partido date,
      dia text,
      hora text,
      estadio text,
      arbitro text,
      estado text,
      goles_local integer,
      goles_visitante integer,
      penales_local integer,
      penales_visitante integer,
      fase text,
      numero_playoff integer,
      source_local text,
      source_visitante text
    )
  )
  select count(*)
  into v_bad
  from fixture
  where not exists (
    select 1
    from public.partidos partido
    where partido.torneo_id = fixture.torneo_id
      and partido.tipo = fixture.tipo
      and partido.fecha = fixture.fecha
      and partido.zona = fixture.zona
      and partido.local_id = fixture.local_id
      and partido.visitante_id = fixture.visitante_id
      and partido.local is not distinct from fixture.local
      and partido.visitante is not distinct from fixture.visitante
      and partido.estado is not distinct from fixture.estado
      and partido.goles_local is not distinct from fixture.goles_local
      and partido.goles_visitante is not distinct from fixture.goles_visitante
      and partido.penales_local is not distinct from fixture.penales_local
      and partido.penales_visitante is not distinct from fixture.penales_visitante
      and partido.fase is not distinct from fixture.fase
      and partido.numero_playoff is not distinct from fixture.numero_playoff
      and partido.fecha_partido is not distinct from fixture.fecha_partido
      and partido.dia is not distinct from fixture.dia
      and partido.hora is not distinct from fixture.hora
      and partido.estadio is not distinct from fixture.estadio
      and partido.arbitro is not distinct from fixture.arbitro
      and partido.source_local is not distinct from fixture.source_local
      and partido.source_visitante is not distinct from fixture.source_visitante
  );

  if v_bad <> 0 then
    raise exception 'Post-carga invalida: faltan % partido(s) esperados.', v_bad;
  end if;

  select count(*)
  into v_apertura_total_after
  from public.partidos
  where torneo_id = 1;

  if v_apertura_total_after <> 140
    or v_apertura_total_after <> v_apertura_total_before
  then
    raise exception 'Apertura fue alterado: antes %, despues %.', v_apertura_total_before, v_apertura_total_after;
  end if;

  select md5(coalesce(string_agg(to_jsonb(partido)::text, '|' order by partido.id), ''))
  into v_historical_checksum_after
  from public.partidos partido
  where partido.torneo_id is distinct from 2;

  if v_historical_checksum_after is distinct from v_historical_checksum_before then
    raise exception 'Algun partido historico fue actualizado.';
  end if;

  select md5(coalesce(string_agg((club.id::text || ':' || club.zona::text), '|' order by club.id), ''))
  into v_clubes_zona_checksum_after
  from public.clubes club;

  if v_clubes_zona_checksum_after is distinct from v_clubes_zona_checksum_before then
    raise exception 'clubes.zona fue modificado.';
  end if;

  raise notice 'Carga Clausura 2026 verificada. Insertados: %, total Clausura: %, Apertura: %.',
    v_inserted,
    v_total_after,
    v_apertura_total_after;
end;
$$;

commit;
