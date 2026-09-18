# Procédure de rollback — Esprit Padel Communication OS

**Sauvegarde réalisée le : 18/09/2026**
**État sauvegardé : production avant refonte V1**

---

## Ce qui est sauvegardé

| Quoi | Où | Vérifié |
|------|-----|---------|
| Code source complet | Git tag `v0-production-avant-refonte` (hash `7534b6a`) | ✅ |
| Copie locale code | `/Users/Mel/Downloads/esprit-padel-app-BACKUP-2026-09` | ✅ |
| Données Firestore | `gs://esprit-padel-communication-backups` (18/09/2026) | ✅ |
| Cloud Functions | Incluses dans le code (functions/index.js) | ✅ |

**Firestore : 1 192 documents · 2,12 Mo · toutes collections**

---

## Rollback CODE UNIQUEMENT (sans données)

Utiliser si : l'application plante ou régresse après une modification du code.

```bash
# Revenir au code de production d'origine
git checkout v0-production-avant-refonte

# Rebuilder
npm install
npm run build

# Redéployer sur Netlify
# Option A — interface Netlify : drag & drop du dossier build/ dans "Deploys"
# Option B — CLI :
npx netlify-cli deploy --prod --dir=build
```

**Temps estimé : 5–10 minutes**

---

## Rollback DONNÉES FIRESTORE UNIQUEMENT

Utiliser si : des données ont été supprimées ou corrompues dans Firestore.

### ACTION MÉLISSA NÉCESSAIRE — console Firebase

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. Sélectionner le projet **esprit-padel-communication**
3. Menu gauche → **Firestore Database** → **Importation/Exportation**
4. Cliquer sur **"Importer des données"**
5. Saisir le chemin : `gs://esprit-padel-communication-backups`
6. Sélectionner le dossier de l'export du 18/09/2026
7. Cliquer **Importer**

⚠️ **Attention** : l'import Firestore ÉCRASE les données existantes. À n'utiliser qu'en cas de perte de données confirmée.

**Temps estimé : 5–15 minutes selon volume**

---

## Rollback COMPLET (code + données)

Utiliser si : la migration a causé des problèmes à la fois sur le code et les données.

1. Rollback code (voir section ci-dessus)
2. Rollback données Firestore (voir section ci-dessus)
3. Vérifier que l'application fonctionne sur espritpadelcom.netlify.app

**Temps estimé : 15–30 minutes**

---

## Rollback Netlify en urgence (30 secondes)

Si le site est cassé après un déploiement :

1. Aller sur [app.netlify.com](https://app.netlify.com)
2. Sélectionner le site espritpadelcom
3. Onglet **Deploys**
4. Cliquer sur le déploiement précédent (vert)
5. Cliquer **"Publish deploy"**

Le site précédent est restauré en 30 secondes, sans toucher au code ni aux données.

---

## Vérification après rollback

- [ ] Login fonctionne
- [ ] Dashboard charge les données
- [ ] Cloud Functions actives (vérifier dans Firebase Console → Functions)
- [ ] Sync Metricool OK (vérifier le lendemain matin à 4h15)
