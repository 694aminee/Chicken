// Le menu complet du snack.
//
// Étape 1 : le menu est écrit ici, dans le code.
// Étape 2 : il sera déplacé dans la base de données Supabase (tables
// categories, products, option_groups, options) pour que le patron puisse
// changer un prix ou masquer un produit. Les types ci-dessous ont déjà la
// même forme que ces futures tables.
//
// Tous les prix sont en centimes (750 = 7,50 €) pour éviter les erreurs
// d'arrondi.

export type Choice = {
  id: string;
  name: string;
  price: number; // supplément en centimes
};

export type OptionGroup = {
  id: string;
  label: string;
  min: number;
  max: number;
  /** Choix pré-sélectionné à l'ouverture */
  defaultChoice?: string;
  /** Petit texte affiché à droite du titre quand le groupe est facultatif */
  hint?: string;
  /** Le groupe n'apparaît que si ce choix est fait (ex. boisson si formule menu) */
  showIf?: { group: string; choice: string };
  /** Dans le résumé : "Sauces : Mayo" (true) ou juste "Poulet" (false) */
  labelInSummary?: boolean;
  choices: Choice[];
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Prix en formule menu, affiché à côté du prix seul */
  menuPrice?: number;
  image?: string;
  /** Vignette texte en attendant les photos : [gros mot, petit mot] */
  tag?: [string, string];
  options: OptionGroup[];
};

export type Category = {
  id: string;
  title: string;
  subtitle: string;
  products: Product[];
};

const free = (names: string[]): Choice[] => names.map((name) => ({ id: slug(name), name, price: 0 }));

const priced = (list: [string, number][]): Choice[] => list.map(([name, price]) => ({ id: slug(name), name, price }));

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const VIANDES = free(["Steak", "Poulet", "Cordon bleu", "Tenders", "Kebab", "Fish", "Merguez", "Nuggets"]);
const SAUCES = free([
  "Mayo",
  "Ketchup",
  "Burger",
  "Blanche",
  "Barbecue",
  "Fish",
  "Algérienne",
  "Curry",
  "Samouraï",
  "Harissa",
  "Tartare",
]);
const SUPPLEMENTS = priced([
  ["Cheddar", 60],
  ["Chèvre", 60],
  ["Raclette", 60],
  ["Boursin", 60],
  ["Olives", 60],
  ["Crudités", 50],
  ["Poivrons", 60],
  ["Œuf", 100],
  ["Jambon", 100],
  ["Chorizo", 100],
  ["Bacon", 100],
  ["Lardons", 100],
  ["Rösti", 150],
  ["Viande en plus", 200],
]);
const GRATINAGES = priced([
  ["Cheddar", 100],
  ["Mozza", 100],
  ["Raclette", 100],
  ["Chèvre", 100],
  ["Oignon crispy", 100],
  ["Bleu", 100],
]);
// À confirmer avec le propriétaire : liste exacte des boissons 33 cl.
const BOISSONS = free(["Coca-Cola", "Coca-Cola Zéro", "Fanta Orange", "Oasis Tropical", "Ice Tea Pêche", "Eau"]);

const formule = (supplement: number): OptionGroup => ({
  id: "formule",
  label: "Formule",
  min: 1,
  max: 1,
  defaultChoice: "seul",
  choices: [
    { id: "seul", name: "Seul", price: 0 },
    { id: "menu", name: "Menu frites + boisson 33cl", price: supplement },
  ],
});

const boisson: OptionGroup = {
  id: "boisson",
  label: "Ta boisson",
  min: 1,
  max: 1,
  showIf: { group: "formule", choice: "menu" },
  choices: BOISSONS,
};

const aComposer = (viandes: number): OptionGroup[] => [
  {
    id: "viande",
    label: viandes > 1 ? `${viandes} viandes` : "Viande",
    min: viandes,
    max: viandes,
    choices: VIANDES,
  },
  { id: "sauce", label: "Sauces", min: 0, max: 2, hint: "2 max", labelInSummary: true, choices: SAUCES },
  { id: "supplement", label: "Suppléments", min: 0, max: SUPPLEMENTS.length, labelInSummary: true, choices: SUPPLEMENTS },
  { id: "gratinage", label: "Gratinage", min: 0, max: 1, labelInSummary: true, choices: GRATINAGES },
  formule(300),
  boisson,
];

const burgerOptions = (): OptionGroup[] => [formule(300), boisson];

// À confirmer avec le propriétaire : contenu exact des formules menu des Box.
const boxOptions = (compositions: [string, string, string], supplementMenu: number): OptionGroup[] => [
  {
    id: "composition",
    label: "Composition",
    min: 1,
    max: 1,
    defaultChoice: slug(compositions[0]),
    choices: free(compositions),
  },
  formule(supplementMenu),
  boisson,
];

const taille = (supplementGrande: number): OptionGroup[] => [
  {
    id: "taille",
    label: "Taille",
    min: 1,
    max: 1,
    defaultChoice: "petite",
    choices: [
      { id: "petite", name: "Petite", price: 0 },
      { id: "grande", name: "Grande", price: supplementGrande },
    ],
  },
];

const BURGERS: [string, string, string, number][] = [
  ["cheese", "Cheese", "Steak 80 g", 450],
  ["double-cheese", "Double Cheese", "2 steaks 80 g", 650],
  ["triple-cheese", "Triple Cheese", "3 steaks 80 g", 850],
  ["chicken", "Chicken", "Chicken", 550],
  ["fish", "Fish", "Fish, sauce fish", 550],
  ["baps", "Bap's", "Steak 80 g, rösti", 650],
  ["monster", "Monster", "Steak 80 g, tenders", 700],
  ["chevre", "Chèvre", "Steak 80 g, chèvre", 600],
  ["raclette", "Raclette", "Steak 80 g, raclette", 600],
  ["bacon", "Bacon", "Steak 80 g, bacon", 650],
];

const TEX_MEX = ["Bouchées camembert", "Jalapeños", "Sticks mozza", "Nuggets", "Onion rings"];

export const MENU: Category[] = [
  {
    id: "a-composer",
    title: "À composer",
    subtitle: "Galette, sandwich, wrap ou bowl. Tu choisis tout.",
    products: [
      {
        id: "simple",
        name: "Simple",
        description: "1 viande, 1 galette",
        price: 750,
        image: "/tacos.png",
        options: aComposer(1),
      },
      { id: "maxi", name: "Maxi", description: "2 viandes, 2 galettes", price: 1150, image: "/tacos.png", options: aComposer(2) },
      {
        id: "sandwich",
        name: "Sandwich baguette",
        description: "1 viande, sauces au choix",
        price: 750,
        tag: ["Baguette", "sandwich"],
        options: aComposer(1),
      },
      {
        id: "wrap",
        name: "Wrap",
        description: "1 viande, sauces au choix",
        price: 750,
        tag: ["Wrap", "roulé"],
        options: aComposer(1),
      },
      {
        id: "bowl",
        name: "Bowl",
        description: "1 viande, sauces au choix",
        price: 800,
        tag: ["Bowl", "à la fourchette"],
        options: aComposer(1),
      },
    ],
  },
  {
    id: "chicken-box",
    title: "Chicken Box",
    subtitle: "Tenders et wings à partager.",
    products: [
      {
        id: "box-1",
        name: "Box 1",
        description: "1 personne",
        price: 690,
        menuPrice: 990,
        tag: ["1", "personne"],
        options: boxOptions(["3 tenders + 3 wings", "4 tenders", "6 wings"], 300),
      },
      {
        id: "box-2",
        name: "Box 2",
        description: "2 à 3 personnes",
        price: 1290,
        menuPrice: 1690,
        tag: ["2/3", "personnes"],
        options: boxOptions(["6 tenders + 6 wings", "12 tenders", "12 wings"], 400),
      },
      {
        id: "box-3",
        name: "Box 3",
        description: "4 à 5 personnes",
        price: 2790,
        menuPrice: 3190,
        tag: ["4/5", "personnes"],
        options: boxOptions(["16 tenders + 16 wings", "32 tenders", "32 wings"], 400),
      },
      {
        id: "box-4",
        name: "Box 4",
        description: "6 à 7 personnes",
        price: 3590,
        menuPrice: 3990,
        tag: ["6/7", "personnes"],
        options: boxOptions(["20 tenders + 20 wings", "40 tenders", "40 wings"], 400),
      },
    ],
  },
  {
    id: "smash",
    title: "Smash burgers",
    subtitle: "Steak écrasé à la plancha.",
    products: [
      {
        id: "smash-simple",
        name: "Smash Simple",
        description: "1 steak smashé",
        price: 650,
        tag: ["Smash", "simple"],
        options: burgerOptions(),
      },
      {
        id: "smash-double",
        name: "Smash Double",
        description: "2 steaks smashés",
        price: 850,
        tag: ["Smash", "double"],
        options: burgerOptions(),
      },
      {
        id: "smash-chicken",
        name: "Smash Chicken",
        description: "Poulet",
        price: 650,
        tag: ["Smash", "chicken"],
        options: burgerOptions(),
      },
      {
        id: "smash-fish",
        name: "Smash Fish",
        description: "Poisson pané",
        price: 650,
        tag: ["Smash", "fish"],
        options: burgerOptions(),
      },
    ],
  },
  {
    id: "burgers",
    title: "Burgers",
    subtitle: "Sauce burger, crudités et cheddar sur chaque burger.",
    products: BURGERS.map(([id, name, composition, price]) => ({
      id: `burger-${id}`,
      name,
      description: composition.includes("sauce fish")
        ? `${composition}, crudités, cheddar`
        : `${composition}, sauce burger, crudités, cheddar`,
      price,
      tag: [name.split(" ")[0], "burger"],
      options: burgerOptions(),
    })),
  },
  {
    id: "tex-mex",
    title: "Tex-Mex",
    subtitle: "5 pièces 4,90 € · 10 pièces 8,90 €",
    products: TEX_MEX.map((name) => ({
      id: `tex-mex-${slug(name)}`,
      name,
      description: "Par 5 ou par 10",
      price: 490,
      tag: ["x5", "x10"],
      options: [
        {
          id: "quantite",
          label: "Quantité",
          min: 1,
          max: 1,
          defaultChoice: "5",
          choices: [
            { id: "5", name: "5 pièces", price: 0 },
            { id: "10", name: "10 pièces", price: 400 },
          ],
        },
      ],
    })),
  },
  {
    id: "accompagnements",
    title: "Accompagnements",
    subtitle: "Petite ou grande portion.",
    products: [
      {
        id: "frites",
        name: "Frites",
        description: "Petite 2,00 € · Grande 3,00 €",
        price: 200,
        tag: ["Frites", "portion"],
        options: taille(100),
      },
      {
        id: "potatoes",
        name: "Potatoes",
        description: "Petite 2,50 € · Grande 3,50 €",
        price: 250,
        tag: ["Potatoes", "portion"],
        options: taille(100),
      },
    ],
  },
];

const PRODUCTS = new Map(MENU.flatMap((c) => c.products).map((p) => [p.id, p]));

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.get(id);
}
