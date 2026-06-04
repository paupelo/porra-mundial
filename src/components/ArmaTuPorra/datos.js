export const CATEGORIAS = {
  FAVORITOS: {
    id: 'favoritos',
    nombre: 'Favoritos',
    color: '#C41E3A',
    colorClaro: '#fdf0f2',
    emoji: '🔴',
    max: 3,
  },
  SORPRESAS: {
    id: 'sorpresas',
    nombre: 'Sorpresas',
    color: '#1E5BB8',
    colorClaro: '#f0f4fb',
    emoji: '🔵',
    max: 4,
  },
  PETARDAZOS: {
    id: 'petardazos',
    nombre: 'Petardazos',
    color: '#1FA67A',
    colorClaro: '#f0fbf7',
    emoji: '🟢',
    max: 4,
  },
  CACA: {
    id: 'cacaDeLaVaca',
    nombre: 'Caca de la Vaca',
    color: '#5A6478',
    colorClaro: '#f4f5f7',
    emoji: '⚫',
    max: 3,
  },
};

export const SELECCIONES = [
  // FAVORITOS
  { id: 'alemania', nombre: 'Alemania', bandera: '🇩🇪', codigo: 'de', categoria: 'favoritos' },
  { id: 'argentina', nombre: 'Argentina', bandera: '🇦🇷', codigo: 'ar', categoria: 'favoritos' },
  { id: 'belgica', nombre: 'Bélgica', bandera: '🇧🇪', codigo: 'be', categoria: 'favoritos' },
  { id: 'brasil', nombre: 'Brasil', bandera: '🇧🇷', codigo: 'br', categoria: 'favoritos' },
  { id: 'espana', nombre: 'España', bandera: '🇪🇸', codigo: 'es', categoria: 'favoritos' },
  { id: 'francia', nombre: 'Francia', bandera: '🇫🇷', codigo: 'fr', categoria: 'favoritos' },
  { id: 'inglaterra', nombre: 'Inglaterra', bandera: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', codigo: 'gb-eng', categoria: 'favoritos' },
  { id: 'marruecos', nombre: 'Marruecos', bandera: '🇲🇦', codigo: 'ma', categoria: 'favoritos' },
  { id: 'paises-bajos', nombre: 'Países Bajos', bandera: '🇳🇱', codigo: 'nl', categoria: 'favoritos' },
  { id: 'portugal', nombre: 'Portugal', bandera: '🇵🇹', codigo: 'pt', categoria: 'favoritos' },

  // SORPRESAS
  { id: 'australia', nombre: 'Australia', bandera: '🇦🇺', codigo: 'au', categoria: 'sorpresas' },
  { id: 'austria', nombre: 'Austria', bandera: '🇦🇹', codigo: 'at', categoria: 'sorpresas' },
  { id: 'colombia', nombre: 'Colombia', bandera: '🇨🇴', codigo: 'co', categoria: 'sorpresas' },
  { id: 'corea-sur', nombre: 'Corea del Sur', bandera: '🇰🇷', codigo: 'kr', categoria: 'sorpresas' },
  { id: 'croacia', nombre: 'Croacia', bandera: '🇭🇷', codigo: 'hr', categoria: 'sorpresas' },
  { id: 'ecuador', nombre: 'Ecuador', bandera: '🇪🇨', codigo: 'ec', categoria: 'sorpresas' },
  { id: 'eeuu', nombre: 'EE. UU.', bandera: '🇺🇸', codigo: 'us', categoria: 'sorpresas' },
  { id: 'iran', nombre: 'Irán', bandera: '🇮🇷', codigo: 'ir', categoria: 'sorpresas' },
  { id: 'japon', nombre: 'Japón', bandera: '🇯🇵', codigo: 'jp', categoria: 'sorpresas' },
  { id: 'mexico', nombre: 'México', bandera: '🇲🇽', codigo: 'mx', categoria: 'sorpresas' },
  { id: 'noruega', nombre: 'Noruega', bandera: '🇳🇴', codigo: 'no', categoria: 'sorpresas' },
  { id: 'senegal', nombre: 'Senegal', bandera: '🇸🇳', codigo: 'sn', categoria: 'sorpresas' },
  { id: 'suiza', nombre: 'Suiza', bandera: '🇨🇭', codigo: 'ch', categoria: 'sorpresas' },
  { id: 'turquia', nombre: 'Turquía', bandera: '🇹🇷', codigo: 'tr', categoria: 'sorpresas' },
  { id: 'uruguay', nombre: 'Uruguay', bandera: '🇺🇾', codigo: 'uy', categoria: 'sorpresas' },

  // PETARDAZOS
  { id: 'argelia', nombre: 'Argelia', bandera: '🇩🇿', codigo: 'dz', categoria: 'petardazos' },
  { id: 'canada', nombre: 'Canadá', bandera: '🇨🇦', codigo: 'ca', categoria: 'petardazos' },
  { id: 'catar', nombre: 'Catar', bandera: '🇶🇦', codigo: 'qa', categoria: 'petardazos' },
  { id: 'costa-de-marfil', nombre: 'Costa de Marfil', bandera: '🇨🇮', codigo: 'ci', categoria: 'petardazos' },
  { id: 'egipto', nombre: 'Egipto', bandera: '🇪🇬', codigo: 'eg', categoria: 'petardazos' },
  { id: 'escocia', nombre: 'Escocia', bandera: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', codigo: 'gb-sct', categoria: 'petardazos' },
  { id: 'irak', nombre: 'Irak', bandera: '🇮🇶', codigo: 'iq', categoria: 'petardazos' },
  { id: 'panama', nombre: 'Panamá', bandera: '🇵🇦', codigo: 'pa', categoria: 'petardazos' },
  { id: 'paraguay', nombre: 'Paraguay', bandera: '🇵🇾', codigo: 'py', categoria: 'petardazos' },
  { id: 'rd-congo', nombre: 'RD Congo', bandera: '🇨🇩', codigo: 'cd', categoria: 'petardazos' },
  { id: 'rep-checa', nombre: 'Rep. Checa', bandera: '🇨🇿', codigo: 'cz', categoria: 'petardazos' },
  { id: 'sudafrica', nombre: 'Sudáfrica', bandera: '🇿🇦', codigo: 'za', categoria: 'petardazos' },
  { id: 'suecia', nombre: 'Suecia', bandera: '🇸🇪', codigo: 'se', categoria: 'petardazos' },
  { id: 'tunez', nombre: 'Túnez', bandera: '🇹🇳', codigo: 'tn', categoria: 'petardazos' },
  { id: 'uzbekistan', nombre: 'Uzbekistán', bandera: '🇺🇿', codigo: 'uz', categoria: 'petardazos' },

  // CACA DE LA VACA
  { id: 'arabia-saudita', nombre: 'Arabia Saudita', bandera: '🇸🇦', codigo: 'sa', categoria: 'cacaDeLaVaca' },
  { id: 'bosnia', nombre: 'Bosnia y H.', bandera: '🇧🇦', codigo: 'ba', categoria: 'cacaDeLaVaca' },
  { id: 'cabo-verde', nombre: 'Cabo Verde', bandera: '🇨🇻', codigo: 'cv', categoria: 'cacaDeLaVaca' },
  { id: 'curazao', nombre: 'Curazao', bandera: '🇨🇼', codigo: 'cw', categoria: 'cacaDeLaVaca' },
  { id: 'ghana', nombre: 'Ghana', bandera: '🇬🇭', codigo: 'gh', categoria: 'cacaDeLaVaca' },
  { id: 'haiti', nombre: 'Haití', bandera: '🇭🇹', codigo: 'ht', categoria: 'cacaDeLaVaca' },
  { id: 'jordania', nombre: 'Jordania', bandera: '🇯🇴', codigo: 'jo', categoria: 'cacaDeLaVaca' },
  { id: 'nueva-zelanda', nombre: 'Nueva Zelanda', bandera: '🇳🇿', codigo: 'nz', categoria: 'cacaDeLaVaca' },
];

// Genera jugadores placeholder para una selección.
// Reemplaza esta función cuando tengas la API de FIFA.
export function getJugadoresMock(seleccionId) {
  const posiciones = [
    { id: 'por-1', nombre: 'Portero 1', posicion: 'POR' },
    { id: 'por-2', nombre: 'Portero 2', posicion: 'POR' },
    { id: 'def-1', nombre: 'Defensa 1', posicion: 'DEF' },
    { id: 'def-2', nombre: 'Defensa 2', posicion: 'DEF' },
    { id: 'def-3', nombre: 'Defensa 3', posicion: 'DEF' },
    { id: 'def-4', nombre: 'Defensa 4', posicion: 'DEF' },
    { id: 'def-5', nombre: 'Defensa 5', posicion: 'DEF' },
    { id: 'med-1', nombre: 'Medio 1', posicion: 'MED' },
    { id: 'med-2', nombre: 'Medio 2', posicion: 'MED' },
    { id: 'med-3', nombre: 'Medio 3', posicion: 'MED' },
    { id: 'med-4', nombre: 'Medio 4', posicion: 'MED' },
    { id: 'med-5', nombre: 'Medio 5', posicion: 'MED' },
    { id: 'del-1', nombre: 'Delantero 1', posicion: 'DEL' },
    { id: 'del-2', nombre: 'Delantero 2', posicion: 'DEL' },
    { id: 'del-3', nombre: 'Delantero 3', posicion: 'DEL' },
    { id: 'del-4', nombre: 'Delantero 4', posicion: 'DEL' },
  ];
  return posiciones.map(j => ({ ...j, id: `${seleccionId}-${j.id}`, seleccionId }));
}

export function porraVacia() {
  return {
    participante: '',
    favoritos: [],
    sorpresas: [],
    petardazos: [],
    cacaDeLaVaca: [],
    equipoGanador: null,
    titular: [],
    suplentes: [],
  };
}
