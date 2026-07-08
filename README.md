# Releve photographique contradictoire

Application web statique pour generer localement un PDF de releve photographique contradictoire avant signature immobiliere.

## Utilisation

1. Ouvrir l'application depuis GitHub Pages ou en ouvrant `index.html` dans un navigateur moderne.
2. Verifier ou modifier la date, les horaires, l'adresse et les personnes presentes.
3. Ajouter les photos depuis un telephone ou un ordinateur.
4. Supprimer les photos inutiles si besoin.
5. Faire signer les acheteurs et l'agent immobilier au doigt ou a la souris.
6. Cliquer sur **Generer le PDF**.

Le PDF est genere dans le navigateur. Les photos ne sont pas envoyees a un serveur.

## Deploiement sur GitHub Pages

1. Pousser ces fichiers dans un depot GitHub.
2. Aller dans **Settings** puis **Pages**.
3. Choisir la source **Deploy from a branch**.
4. Selectionner la branche `releve-photo-amilly` et le dossier `/root`.
5. Enregistrer. GitHub affichera ensuite l'adresse publique du site.

## Fichiers

- `index.html` : structure de l'application.
- `style.css` : mise en forme responsive.
- `app.js` : compression des images, signatures et generation PDF avec jsPDF.

## Notes

- L'application est 100 % statique et compatible GitHub Pages.
- Les images sont redimensionnees a 1600 px maximum sur le plus grand cote.
- La qualite JPEG est reglee autour de 0,72 pour limiter le poids du PDF.
- Le PDF final contient une page de garde, une page par photo et une page finale avec signatures.
