# Tester le quiz sur ton téléphone

## 1. Même réseau WiFi
Le PC et le téléphone doivent être sur **le même WiFi** (ou le même réseau).

## 2. Démarrer l’app sur le PC
- **Backend** : `cd backend && npm run dev`  
  → Le terminal affiche par exemple : `Pour tester sur téléphone : http://192.168.1.25:5173`
- **Frontend** : `cd frontend && npm run dev`  
  → En bas du terminal, Vite affiche **Network: http://192.168.x.x:5173/** (c’est cette adresse qu’il faut utiliser).

## 3. Sur le téléphone
Ouvre le **navigateur** (Chrome, Safari, etc.) et va à l’adresse affichée, par exemple :
```text
http://192.168.1.25:5173
```
(Remplace par **ton** IP affichée dans le terminal.)

## 4. Si ça ne marche pas : pare-feu Windows
Le pare-feu peut bloquer les connexions entrantes.

1. Ouvre **Pare-feu Windows Defender** (recherche « Pare-feu » dans le menu Démarrer).
2. **Activer ou désactiver le Pare-feu Windows Defender** → Réseau privé : laisser activé.
3. **Autoriser une application via le Pare-feu** → **Modifier les paramètres** → **Autoriser une autre application** :
   - Ajouter **Node.js** (chemin type : `C:\Program Files\nodejs\node.exe`).
   - Cocher **Réseau privé** pour Node.js.
4. Pour **Vite** (frontend), autoriser aussi **node** si tu lances le front avec `node`/`npm` (même binaire Node.js).

Ou en une commande (PowerShell en **administrateur**) :
```powershell
New-NetFirewallRule -DisplayName "Node dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "Vite dev 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
```

## 5. Trouver l’IP du PC à la main
- **Windows** : Invite de commandes → `ipconfig` → repère **Adresse IPv4** (Wi-Fi), ex. `192.168.1.25`.
- Sur le téléphone, ouvre : `http://CETTE_IP:5173`.

## En résumé
- Ne pas utiliser **localhost** sur le téléphone.
- Utiliser **http://IP_DU_PC:5173** (l’IP affichée au démarrage du backend ou dans Vite).
