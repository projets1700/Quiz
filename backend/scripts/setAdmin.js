const { pool } = require('../config/db');

const email = 'a.amrane@coeuressonne.fr';

pool.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role", [email])
  .then((r) => {
    if (r.rows.length === 0) {
      console.log('Compte non trouvé:', email);
    } else {
      console.log('Compte mis à jour :', r.rows[0].email, '→ rôle:', r.rows[0].role);
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error('Erreur:', e.message);
    process.exit(1);
  });
