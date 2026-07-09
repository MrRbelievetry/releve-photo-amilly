# Modification adresse relais facture

Petite application web 100 % front-end pour remplacer le bloc **Adresse de livraison** d'une facture PDF OrientalDiscount générée par PrestaShop/TCPDF.

## Fonctionnement

1. Choisir la facture PDF d'origine.
2. Coller l'adresse complète du point relais.
3. Cliquer sur **Générer la facture**.
4. Le PDF modifié est téléchargé automatiquement.

L'application conserve le PDF d'origine et ne modifie que le corps du bloc **Adresse de livraison**. Le titre du bloc, l'adresse de facturation, les montants, produits, TVA, numéro de facture, logo et autres éléments restent inchangés.

## Technique

- Compatible GitHub Pages.
- Aucun backend.
- Lecture du texte avec PDF.js pour localiser automatiquement le libellé **Adresse de livraison**.
- Modification du PDF avec pdf-lib.
- Conservation du format A4 et de la mise en page d'origine.
- Masquage propre de l'ancienne adresse avec un rectangle blanc.
- Réécriture de la nouvelle adresse à la même position, avec retours à la ligne automatiques.

## Fichiers

- `index.html`
- `style.css`
- `app.js`
- `README.md`
