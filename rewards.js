// Configuration du calendrier et récompenses.
// MOCK : ces 24 récompenses sont des exemples, à remplacer par la vraie liste.
// La répartition dans les cases est tirée une seule fois à partir de `seed` :
// même seed = même répartition, sur tous les écrans et à chaque rechargement.

window.ADVENT_CONFIG = {
  year: 2026,
  seed: 66,
  streamer: "Fakeheal66",
};

// type   : sub | game | giftcard | vip | coaching | goodies | wow | emote | mystery
// rarity : uncommon | rare | epic | legendary (couleurs de qualité WoW)
window.ADVENT_REWARDS = [
  { type: "sub",      rarity: "rare",      title: "5 subs offerts",          detail: "Distribués au hasard dans le chat" },
  { type: "game",     rarity: "epic",      title: "Clé Steam mystère",       detail: "Un jeu surprise pour un viewer" },
  { type: "emote",    rarity: "uncommon",  title: "Vote de la prochaine emote", detail: "La commu choisit la prochaine emote" },
  { type: "vip",      rarity: "uncommon",  title: "Rôle VIP Discord",        detail: "Pendant 1 mois" },
  { type: "coaching", rarity: "epic",      title: "Coaching heal 1h",        detail: "Session perso avec Fakeheal" },
  { type: "giftcard", rarity: "rare",      title: "Carte cadeau 20 €",       detail: "Pour un viewer tiré au sort" },
  { type: "sub",      rarity: "epic",      title: "10 subs offerts",         detail: "Pluie de subs sur le chat" },
  { type: "goodies",  rarity: "rare",      title: "Mug Fakeheal",            detail: "Livré à la maison" },
  { type: "wow",      rarity: "legendary", title: "Jeton WoW",               detail: "Un mois de jeu offert" },
  { type: "mystery",  rarity: "rare",      title: "Récompense mystère",      detail: "Dévoilée en live" },
  { type: "vip",      rarity: "uncommon",  title: "Couleur de pseudo custom", detail: "Sur le Discord, pendant 1 mois" },
  { type: "game",     rarity: "epic",      title: "2 clés Steam",            detail: "Deux gagnants dans le chat" },
  { type: "sub",      rarity: "uncommon",  title: "1 sub offert",            detail: "Au plus rapide dans le chat" },
  { type: "coaching", rarity: "rare",      title: "Review de logs",          detail: "Analyse de ton heal en raid" },
  { type: "goodies",  rarity: "epic",      title: "T-shirt Fakeheal",        detail: "Taille au choix" },
  { type: "emote",    rarity: "rare",      title: "Emote personnalisée",     detail: "Ton pseudo dans une emote" },
  { type: "wow",      rarity: "epic",      title: "Place en raid viewers",   detail: "Une place réservée au prochain raid" },
  { type: "giftcard", rarity: "legendary", title: "Carte cadeau 50 €",       detail: "Pour un viewer tiré au sort" },
  { type: "sub",      rarity: "uncommon",  title: "3 subs offerts",          detail: "Distribués au hasard dans le chat" },
  { type: "mystery",  rarity: "uncommon",  title: "Défi en live",            detail: "Fakeheal relève ton défi" },
  { type: "game",     rarity: "legendary", title: "Jeu au choix",            detail: "Jusqu'à 30 €" },
  { type: "vip",      rarity: "rare",      title: "VIP Twitch",              detail: "Pendant 1 mois" },
  { type: "goodies",  rarity: "uncommon",  title: "Pack de stickers",        detail: "Livré à la maison" },
  { type: "wow",      rarity: "legendary", title: "Monture de la boutique",  detail: "Offerte sur ton compte" },
];
