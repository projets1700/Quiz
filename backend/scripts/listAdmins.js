const { pool } = require('../config/db');

pool.query("SELECT id, email, role, verified, created_at FROM users ORDER BY role, email")
  .then((r) => {
    const admins = r.rows.filter((u) => u.role === 'admin');
    const creators = r.rows.filter((u) => u.role === 'creator');
    console.log('Comptes administrateurs :');
    if (admins.length === 0) {
      console.log('  Aucun compte admin trouvé.');
    } else {
      admins.forEach((u) => console.log(`  - ${u.email} (id: ${u.id}, vérifié: ${u.verified})`));
    }
    console.log('\nComptes créateurs :', creators.length);
    creators.forEach((u) => console.log(`  - ${u.email} (id: ${u.id}, rôle: ${u.role})`));
    process.exit(0);
  })
  .catch((e) => {
    console.error('Erreur:', e.message);
    process.exit(1);
  });
