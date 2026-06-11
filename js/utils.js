const state = {
  partidos: [],
  playoffs: [],
  eventos: [],
  clubes: []
}; 

// 🔹 MAPAS
const escudos = {
  "Sportivo A. Club": "assets/img/sportivo.png",
  "C.A. Defensores": "assets/img/defensores.png",
  "C.A. El Porvenir del Norte": "assets/img/porvenir.png",
  "AD Everton/Olimpia": "assets/img/everton.png",
  "Sport C. Cañadense": "assets/img/sport.png",
  "C.A. Montes de Oca": "assets/img/montes.png",
  "C.A. Cosmopolita": "assets/img/cosmo.png",

  "C.A. Almafuerte": "assets/img/almafuerte.png",
  "C.A. Williams Kemmis": "assets/img/kemmis.png",
  "C.A. Campaña": "assets/img/campana.png",
  "C.A. Correa": "assets/img/correa.png",
  "Def. Sportsman": "assets/img/sportsman.png",
  "Argentino A. Club": "assets/img/argentino.png",
  "C.A. Unión C.S.D.": "assets/img/union.png",

  "C.A. Carcarañá": "assets/img/carcarana.png",
  "C.A. América": "assets/img/america.png",
  "C.A. N.O. Boys": "assets/img/newells.png",
  "C.A. San Jerónimo": "assets/img/sanjeronimo.png",
  "Belgrano A.C.": "assets/img/belgrano.png",
  "C.A. Unión Tortugas": "assets/img/uniont.png",
  "C.A. Barraca": "assets/img/barraca.png"
};

//Nombres cortos
const nombresCortos = {
  "Sportivo A. Club": "Sportivo",
  "C.A. Defensores": "Defensores",
  "C.A. El Porvenir del Norte": "Porvenir",
  "AD Everton/Olimpia": "ADEO",
  "Sport C. Cañadense": "Sport",
  "C.A. Montes de Oca": "Montes",
  "C.A. Cosmopolita": "Cosmo",

  "C.A. Almafuerte": "Almafuerte",
  "C.A. Williams Kemmis": "Kemmis",
  "C.A. Campaña": "Campaña",
  "C.A. Correa": "Correa",
  "Def. Sportsman": "Sportsman",
  "Argentino A. Club": "Argentino",
  "C.A. Unión C.S.D.": "Unión",

  "C.A. Carcarañá": "Carcarañá",
  "C.A. América": "América",
  "C.A. N.O. Boys": "Newell's",
  "C.A. San Jerónimo": "San Jerónimo",
  "Belgrano A.C.": "Belgrano",
  "C.A. Unión Tortugas": "Unión T.",
  "C.A. Barraca": "Barraca"
};

const equiposPorZona = {
  1: [
  "C.A. Campaña",
  "C.A. Carcarañá",
  "C.A. Correa",
  "C.A. Cosmopolita",
  "C.A. El Porvenir del Norte",
  "C.A. San Jerónimo",
  "Def. Sportsman"
  ],
  2: [
  "AD Everton/Olimpia",
  "C.A. América",
  "C.A. Barraca",
  "C.A. Defensores",
  "C.A. N.O. Boys",
  "C.A. Unión C.S.D.",
  "Sport C. Cañadense"
  ],
  3: [
  "Argentino A. Club",
  "Belgrano A.C.",
  "C.A. Almafuerte",
  "C.A. Montes de Oca",
  "C.A. Unión Tortugas",
  "C.A. Williams Kemmis",
  "Sportivo A. Club"
]
};

const clubesPorNombre = new Map();

function aplicarClubes(clubes) {
  if (!Array.isArray(clubes) || clubes.length === 0) return;

  state.clubes = clubes;
  clubesPorNombre.clear();

  Object.keys(equiposPorZona).forEach(zona => {
    equiposPorZona[zona].splice(0);
  });

  clubes
    .filter(club => club.activo !== false)
    .sort((a, b) =>
      Number(a.zona) - Number(b.zona) ||
      String(a.nombre_corto).localeCompare(
        String(b.nombre_corto),
        "es",
        { sensitivity: "base" }
      )
    )
    .forEach(club => {
      clubesPorNombre.set(club.nombre_oficial, club);
      nombresCortos[club.nombre_oficial] =
        club.nombre_corto || club.nombre_oficial;

      if (club.escudo_url) {
        escudos[club.nombre_oficial] = club.escudo_url;
      }

      const zona = Number(club.zona);
      if (equiposPorZona[zona]) {
        equiposPorZona[zona].push(club.nombre_oficial);
      }
    });
}

function obtenerClub(equipo) {
  return clubesPorNombre.get(equipo) || null;
}
  
function nombre(equipo) {
  return nombresCortos[equipo] || equipo;
}
