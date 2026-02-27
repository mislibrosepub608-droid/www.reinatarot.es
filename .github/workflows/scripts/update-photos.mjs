import mysql from 'mysql2/promise';

const BASE = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663356619570/';

// Fotos extraídas de Tarot Meiga (en orden de aparición)
const photos = [
  { name: 'Luna Oscura',           url: BASE + 'wgnQbUFtxujbQEtk.png' },
  { name: 'Sol Dorado',            url: BASE + 'LbPhBicfBjwdHqSi.png' },
  { name: 'Sombra Antigua',        url: BASE + 'ZthBvdVkyfRPXTrQ.png' },
  { name: 'Estrella Polar',        url: BASE + 'EwwneFZVdxvScidQ.png' },
  { name: 'Fuego Sagrado',         url: BASE + 'YaOwXSVIzrRmoyMo.png' },
  { name: 'Agua Profunda',         url: BASE + 'AEBlgTOzmuLGgblh.png' },
  { name: 'Tierra Madre',          url: BASE + 'ASkJXLYqRHfJNdYu.png' },
  { name: 'Viento del Norte',      url: BASE + 'kNLdNeTLjlCgkJhE.png' },
  { name: 'Cristal Amatista',      url: BASE + 'UbydlRfDlqABCvxw.png' },
  { name: 'Oráculo del Tiempo',    url: BASE + 'nfNdmhlhrgVAKxXI.png' },
  { name: 'Rosa Mística',          url: BASE + 'ihVAaAKBFPePSagW.png' },
  { name: 'Serpiente de Plata',    url: BASE + 'dgbDzqcopkHxJDWA.png' },
  { name: 'Águila Visionaria',     url: BASE + 'lmgaIabSvLhNtULg.png' },
  { name: 'Lobo Lunar',            url: BASE + 'crPGmgvCwvenfcRN.png' },
  { name: 'Mariposa Dorada',       url: BASE + 'tptnZmUNqiBMxNdh.png' },
  { name: 'Espejo Negro',          url: BASE + 'mIzboCbpRFmnmVml.png' },
  { name: 'Hada del Bosque',       url: BASE + 'kOlhkYUXdnjLMdBl.png' },
  { name: 'Dragón Rojo',           url: BASE + 'KRBUIgnSKwlqrtVC.png' },
  { name: 'Perla del Mar',         url: BASE + 'ERqkDkwvNVPDlYUn.png' },
  { name: 'Cuervo Sabio',          url: BASE + 'VojXKTLCFXwKEWkX.png' },
  { name: 'Flor de Loto',          url: BASE + 'jlEkUKVzlbhfWIFs.png' },
  { name: 'Titán de Piedra',       url: BASE + 'dLLtAkxBiBQOqLYo.png' },
  { name: 'Cometa Plateado',       url: BASE + 'CLdjfElsqjHnPOmb.png' },
  { name: 'Maga de Hielo',         url: BASE + 'WszhWZCWpBbxmYbN.png' },
  { name: 'Guardián del Umbral',   url: BASE + 'kPTGiyDxzYVBovvT.png' },
  { name: 'Sirena del Abismo',     url: BASE + 'xdPVXhkBfiRvqJiG.png' },
  { name: 'Fénix Eterno',          url: BASE + 'uoEnqBBGhPSswnsY.png' },
  { name: 'Alquimista Dorado',     url: BASE + 'QbSWBDLxSZQkfzhZ.png' },
  { name: 'Bruja de las Runas',    url: BASE + 'mvjqTUcljwtMrsGu.png' },
  { name: 'Espíritu del Desierto', url: BASE + 'OnloHbVPoxfhKYrd.png' },
  { name: 'Ninfa de la Luna',      url: BASE + 'RuJRQNGWUFKMrKvH.png' },
  { name: 'Maestro del Caos',      url: BASE + 'IZObqKjsfIOWdYQB.png' },
  { name: 'Ángel de la Guarda',    url: BASE + 'pxxGxynKxbwfVDaH.png' },
  { name: 'Chamán del Norte',      url: BASE + 'QowPPVDySXKkVRZG.png' },
  { name: 'Hechicera Estelar',     url: BASE + 'DySyeclLTlRpjBSA.png' },
  { name: 'Monje del Silencio',    url: BASE + 'bNHWaxOVGvHHyAMd.png' },
  { name: 'Reina de Espadas',      url: BASE + 'llIhFcOMjhNjpRKA.png' },
  { name: 'Mago del Tiempo',       url: BASE + 'tlNuVYuKfYURhUJj.png' },
  { name: 'Sacerdotisa Lunar',     url: BASE + 'hkrlGyZbGhfmsbVu.png' },
  { name: 'Guerrero de Luz',       url: BASE + 'tTRvgVMSalgiVSzT.png' },
  { name: 'Viajero Astral',        url: BASE + 'zpMDcKcjZMiVysRv.png' },
  { name: 'Hechicero del Bosque',  url: BASE + 'RPYTCEQMiuNMjXVH.png' },
  { name: 'Ojos de Tigre',         url: BASE + 'EHtGBqHxKCrUgmHW.png' },
  { name: 'Voz del Cosmos',        url: BASE + 'jxKGkvGCPGnKfjkA.png' },
  { name: 'Dama de Copas',         url: BASE + 'osgGvNaOzrQAcvuf.png' },
  { name: 'Sabio del Pentagrama',  url: BASE + 'vWlVOibfCGCouNsz.png' },
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Obtener todas las tarotistas ordenadas por id
const [tarotistas] = await conn.execute('SELECT id, name FROM tarotistas ORDER BY id');

console.log(`Tarotistas en BD: ${tarotistas.length}`);
console.log(`Fotos disponibles: ${photos.length}`);

let updated = 0;
for (let i = 0; i < tarotistas.length; i++) {
  const tarotista = tarotistas[i];
  // Asignar foto rotando si hay menos fotos que tarotistas
  const photo = photos[i % photos.length];
  await conn.execute('UPDATE tarotistas SET imageUrl = ? WHERE id = ?', [photo.url, tarotista.id]);
  console.log(`✓ ${tarotista.name} → ${photo.name}`);
  updated++;
}

await conn.end();
console.log(`\n✅ ${updated} tarotistas actualizadas con fotos.`);
