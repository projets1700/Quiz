# Déploiement avec Docker Compose

## Prérequis

- Docker et Docker Compose installés

## Lancement

```bash
# Depuis la racine du projet
docker compose up -d --build
```

L'application sera accessible sur :
- **Frontend** : http://localhost
- **Backend API** : http://localhost/api (proxifié par nginx)
- **PostgreSQL** : localhost:5432 (user: quiz, db: quiz_app)

## Configuration

Copier `.env.example` en `.env` et adapter :

```bash
cp .env.example .env
```

Variables principales :
- `JWT_SECRET` : secret pour les tokens (obligatoire en production)
- `APP_URL` : URL du frontend (ex. https://quiz.example.com)
- `API_URL` : URL de l'API (souvent identique à APP_URL)
- `MOCK_EMAIL` : `true` pour mode dev (pas d'envoi d'emails)

## Utiliser une base PostgreSQL externe

Pour utiliser une base existante (ex. AlwaysData), modifier les variables du service `backend` dans `docker-compose.yml` :

```yaml
backend:
  environment:
    DB_HOST: postgresql-votrecompte.alwaysdata.net
    DB_PORT: 5432
    DB_NAME: votre_base
    DB_USER: votre_user
    DB_PASSWORD: votre_mot_de_passe
```

Puis désactiver le service `db` ou le retirer du `depends_on` du backend.

## Commandes utiles

```bash
# Arrêter
docker compose down

# Voir les logs
docker compose logs -f backend

# Reconstruire après modifications
docker compose up -d --build
```
