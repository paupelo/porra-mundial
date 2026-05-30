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
  { id: 'alemania', nombre: 'Alemania', bandera: '🇩🇪', categoria: 'favoritos' },
  { id: 'argentina', nombre: 'Argentina', bandera: '🇦🇷', categoria: 'favoritos' },
  { id: 'belgica', nombre: 'Bélgica', bandera: '🇧🇪', categoria: 'favoritos' },
  { id: 'brasil', nombre: 'Brasil', bandera: '🇧🇷', categoria: 'favoritos' },
  { id: 'espana', nombre: 'España', bandera: '🇪🇸', categoria: 'favoritos' },
  { id: 'francia', nombre: 'Francia', bandera: '🇫🇷', categoria: 'favoritos' },
  { id: 'inglaterra', nombre: 'Inglaterra', bandera: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', categoria: 'favoritos' },
  { id: 'marruecos', nombre: 'Marruecos', bandera: '🇲🇦', categoria: 'favoritos' },
  { id: 'paises-bajos', nombre: 'Países Bajos', bandera: '🇳🇱', categoria: 'favoritos' },
  { id: 'portugal', nombre: 'Portugal', bandera: '🇵🇹', categoria: 'favoritos' },

  // SORPRESAS
  { id: 'australia', nombre: 'Australia', bandera: '🇦🇺', categoria: 'sorpresas' },
  { id: 'austria', nombre: 'Austria', bandera: '🇦🇹', categoria: 'sorpresas' },
  { id: 'colombia', nombre: 'Colombia', bandera: '🇨🇴', categoria: 'sorpresas' },
  { id: 'corea-sur', nombre: 'Corea del Sur', bandera: '🇰🇷', categoria: 'sorpresas' },
  { id: 'croacia', nombre: 'Croacia', bandera: '🇭🇷', categoria: 'sorpresas' },
  { id: 'ecuador', nombre: 'Ecuador', bandera: '🇪🇨', categoria: 'sorpresas' },
  { id: 'eeuu', nombre: 'EE. UU.', bandera: '🇺🇸', categoria: 'sorpresas' },
  { id: 'iran', nombre: 'Irán', bandera: '🇮🇷', categoria: 'sorpresas' },
  { id: 'japon', nombre: 'Japón', bandera: '🇯🇵', categoria: 'sorpresas' },
  { id: 'mexico', nombre: 'México', bandera: '🇲🇽', categoria: 'sorpresas' },
  { id: 'noruega', nombre: 'Noruega', bandera: '🇳🇴', categoria: 'sorpresas' },
  { id: 'senegal', nombre: 'Senegal', bandera: '🇸🇳', categoria: 'sorpresas' },
  { id: 'suiza', nombre: 'Suiza', bandera: '🇨🇭', categoria: 'sorpresas' },
  { id: 'turquia', nombre: 'Turquía', bandera: '🇹🇷', categoria: 'sorpresas' },
  { id: 'uruguay', nombre: 'Uruguay', bandera: '🇺🇾', categoria: 'sorpresas' },

  // PETARDAZOS
  { id: 'argelia', nombre: 'Argelia', bandera: '🇩🇿', categoria: 'petardazos' },
  { id: 'canada', nombre: 'Canadá', bandera: '🇨🇦', categoria: 'petardazos' },
  { id: 'catar', nombre: 'Catar', bandera: '🇶🇦', categoria: 'petardazos' },
  { id: 'costa-marfil', nombre: 'Costa de Marfil', bandera: '🇨🇮', categoria: 'petardazos' },
  { id: 'egipto', nombre: 'Egipto', bandera: '🇪🇬', categoria: 'petardazos' },
  { id: 'escocia', nombre: 'Escocia', bandera: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', categoria: 'petardazos' },
  { id: 'irak', nombre: 'Irak', bandera: '🇮🇶', categoria: 'petardazos' },
  { id: 'panama', nombre: 'Panamá', bandera: '🇵🇦', categoria: 'petardazos' },
  { id: 'paraguay', nombre: 'Paraguay', bandera: '🇵🇾', categoria: 'petardazos' },
  { id: 'rd-congo', nombre: 'RD Congo', bandera: '🇨🇩', categoria: 'petardazos' },
  { id: 'rep-checa', nombre: 'Rep. Checa', bandera: '🇨🇿', categoria: 'petardazos' },
  { id: 'sudafrica', nombre: 'Sudáfrica', bandera: '🇿🇦', categoria: 'petardazos' },
  { id: 'suecia', nombre: 'Suecia', bandera: '🇸🇪', categoria: 'petardazos' },
  { id: 'tunez', nombre: 'Túnez', bandera: '🇹🇳', categoria: 'petardazos' },
  { id: 'uzbekistan', nombre: 'Uzbekistán', bandera: '🇺🇿', categoria: 'petardazos' },

  // CACA DE LA VACA
  { id: 'arabia-saudita', nombre: 'Arabia Saudita', bandera: '🇸🇦', categoria: 'cacaDeLaVaca' },
  { id: 'bosnia', nombre: 'Bosnia y H.', bandera: '🇧🇦', categoria: 'cacaDeLaVaca' },
  { id: 'cabo-verde', nombre: 'Cabo Verde', bandera: '🇨🇻', categoria: 'cacaDeLaVaca' },
  { id: 'curazao', nombre: 'Curazao', bandera: '🇨🇼', categoria: 'cacaDeLaVaca' },
  { id: 'ghana', nombre: 'Ghana', bandera: '🇬🇭', categoria: 'cacaDeLaVaca' },
  { id: 'haiti', nombre: 'Haití', bandera: '🇭🇹', categoria: 'cacaDeLaVaca' },
  { id: 'jordania', nombre: 'Jordania', bandera: '🇯🇴', categoria: 'cacaDeLaVaca' },
  { id: 'nueva-zelanda', nombre: 'Nueva Zelanda', bandera: '🇳🇿', categoria: 'cacaDeLaVaca' },
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
