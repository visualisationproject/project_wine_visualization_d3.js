WINE — VISUALISATION EXPLORATOIRE HORS LIGNE
===========================================

Démarrage
---------
1. Décompressez cette archive.
2. Ouvrez index.html avec Chrome ou Chromium (double-clic suffit).
3. Aucune installation, aucun serveur et aucune connexion Internet ne sont nécessaires.
   L'application lit wine-data.js comme un script local : elle n'utilise pas fetch(),
   ce qui évite le blocage habituel des fichiers JSON sous file://.

Contenu
-------
index.html       Page réunissant les trois visualisations du TP.
app.js           Interactions, calcul de la densité et rendu D3.
styles.css       Mise en page et styles.
d3.v7.min.js     D3.js v7.1.1, repris du fichier fourni dans exemple_*.zip.
wine.csv         Jeu préparé, 178 lignes × 13 variables numériques.
wine.json        Même jeu préparé au format JSON pur (tableau d'objets).
wine-data.js     Le même JSON enveloppé dans window.WINE_DATA pour le chargement
                 local fiable par le navigateur; c'est ce fichier qui est chargé.

Application du TP (document de 2 pages)
----------------------------------------
• Application HTML/SVG/JavaScript : D3.js est inclus dans le dossier; aucune
  bibliothèque n'est appelée sur Internet.
• Vue globale 1 — matrice de dispersion : les 13 variables sont comparées deux à
  deux; la diagonale montre une petite distribution univariée. Un glisser-déposer
  dans une case sélectionne les observations de cette plage.
• Vue globale 2 — coordonnées parallèles : chaque ligne correspond à une
  observation. Le brossage vertical sélectionne une plage sur un axe; les plages
  de plusieurs axes se combinent par intersection.
• Vue détaillée — histogramme et densité sont superposés. Le menu permet de
  choisir la variable; cliquer sur un libellé de variable dans les deux vues
  globales la sélectionne aussi. Deux curseurs règlent la largeur des classes et
  la largeur de bande (lissage) du noyau gaussien.
• La sélection de la matrice et des coordonnées parallèles est répercutée dans les
  deux vues globales et dans la vue détaillée. « Effacer la sélection » réinitialise
  toutes les vues.
• Les libellés des deux vues globales sont abrégés pour éviter les collisions :
  survolez-les pour afficher le nom complet, cliquez pour choisir la variable
  détaillée. La matrice, les coordonnées parallèles et la distribution utilisent
  des couleurs distinctes; l'orange indique la sélection.

Données et préparation
----------------------
Le fichier Wine fourni contient 178 observations et 14 colonnes : le premier champ
est l'identifiant de classe (1, 2 ou 3); les 13 champs suivants sont les mesures
continues. Pour respecter la demande de visualiser uniquement les données
numériques, l'identifiant de classe a été retiré. wine.csv et wine.json contiennent
exactement les 13 mesures numériques, sans identifiant de ligne ni colonne de
classe. L'ordre des lignes est préservé; l'application utilise un numéro d'observation
interne seulement pour relier les marques graphiques.

Les noms de variables sont les 13 attributs documentés dans wine.names : Alcohol,
Malic acid, Ash, Alcalinity of ash, Magnesium, Total phenols, Flavanoids,
Nonflavanoid phenols, Proanthocyanins, Color intensity, Hue,
OD280/OD315 of diluted wines et Proline. Le fichier de description indique des
attributs continus et aucune valeur manquante.

Estimation KDE : f(x) = (1 / (n h)) Σ φ((x − xᵢ) / h), où φ est le noyau
normal standard et h la largeur de bande. Pour partager l'échelle verticale avec
l'histogramme, l'estimation est affichée en effectifs équivalents (n × largeur de
classe × f(x)). Chaque variable possède sa propre échelle; aucune standardisation
n'est appliquée aux valeurs d'origine.

À propos de l'exemple fourni
----------------------------
L'archive exemple_*.zip contient : d3.v7.min.js (D3 v7.1.1), data.js (un tableau
JavaScript de données), segmentation.csv et segmentation.data (fichiers du jeu
Segmentation), puis visu.html et visu2.html. Les deux pages chargent localement
les scripts et montrent la liaison de données D3, notamment .data(...), .enter(),
.append() et .text(). Le TP Wine reprend le D3 local et les données comme tableau
JavaScript, mais va plus loin en ajoutant les trois graphiques interactifs exigés.
À noter : les fichiers tabulaires de l'exemple ont 19 noms dans l'en-tête mais
20 champs par ligne d'observation; les démos lisent data.js, qui contient 210
objets cohérents à 19 propriétés, et non ces fichiers CSV directement.
