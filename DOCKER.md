# Déploiement avec Docker Compose

## Prérequis

- **Docker Desktop pour Windows** installé et **démarré** (icône baleine dans la barre des tâches → *Engine running*).
- Docker Compose est inclus avec Docker Desktop.

### Erreur `connect ENOENT \\.\pipe\dockerBackendApiServer` ou « Max retries reached »

Cela signifie que **le moteur Docker ne tourne pas** ou que le client ne peut pas lui parler (pipe Windows). Ce n’est **pas** un problème du fichier `docker-compose.yml`.

1. Ouvrez **Docker Desktop** (menu Démarrer → Docker Desktop).
2. Attendez la fin du démarrage (plus de spinner ; état du moteur OK).
3. Testez dans un terminal : `docker info` (doit afficher des infos sans erreur).
4. Relancez : `start-docker.cmd` ou `docker compose up -d --build`.

Si ça échoue encore : quittez Docker Desktop complètement (clic droit sur l’icône → *Quit*), rouvrez-le ; en dernier recours **redémarrez Windows**. Vérifiez aussi que la virtualisation / WSL 2 est activée (Docker Desktop vous le signale dans les paramètres).

## Lancement

**Le plus simple (CMD, racine du projet)** — crée `.env` depuis `.env.example` si besoin, build et démarre :

```cmd
start-docker.cmd
```

**Ou à la main** :

```cmd
docker compose up -d --build --remove-orphans
```

*(PowerShell : même commande. La première fois, le build peut prendre une minute.)*

L'application sera accessible sur :
- **Frontend** : http://localhost
- **Backend API** : http://localhost/api (proxifié par nginx), ex. http://localhost/api/v1/auth/login
- **Santé** : http://localhost/health ou http://localhost:3000/health
- **PostgreSQL** : **non exposé sur Windows par défaut** (le backend parle à `db` dans le réseau Docker uniquement). Ainsi **aucun conflit** avec un PostgreSQL local sur le port 5432.
  - Ligne de commande : `docker compose exec db psql -U quiz -d quiz_app`
  - Pour **DBeaver** : dans `docker-compose.yml`, sous le service `db`, décommenter `ports: - "5433:5432"` puis `docker compose up -d`

Le backend est aussi exposé directement sur le **port 3000** pour le debug.

### Erreur « port 5432 already in use » ou conteneur `app-postgres-1`

Souvent un **ancien** conteneur (`app-postgres-1`) ou un projet nommé `app` publie encore 5432. Le fichier compose actuel utilise le projet **`quiz-mvp`** et le service **`db`** (sans port hôte par défaut).

**CMD :**

```cmd
docker stop app-postgres-1 app-db-1 2>nul
docker rm app-postgres-1 2>nul
cd /d CHEMIN\VERS\App
docker compose down --remove-orphans
docker compose up -d --build
```

Ensuite, vérifier que les conteneurs s’appellent `quiz-mvp-db-1`, `quiz-mvp-backend-1`, etc.

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

Si Compose signale des conteneurs « orphan » (ancien nom de projet), nettoyer avec :

```bash
docker compose up -d --build --remove-orphans
```
