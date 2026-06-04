import React from 'react';

function BanderaImg({ codigo, nombre, className, style }) {
  if (!codigo) return null;
  return (
    <img
      src={`https://flagcdn.com/w20/${codigo}.png`}
      srcSet={`https://flagcdn.com/w40/${codigo}.png 2x`}
      width="20"
      height="15"
      alt={nombre || codigo}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}

export default BanderaImg;
