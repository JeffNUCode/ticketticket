/** Chain booking homepages — safe for client bundles (no Node fs). */
export const OFFICIAL_BOOKERS = [
  { chain: "SM Cinema", url: "https://www.smcinema.com/" },
  { chain: "Ayala Malls", url: "https://www.ayalaallaccess.com/" },
  { chain: "Robinsons", url: "https://www.robinsonsmovieworld.com/" },
  { chain: "Megaworld", url: "https://tickets.megaworldcinemas.com/" },
  { chain: "Vista Cinemas", url: "https://www.vistacinemas.com.ph/" },
  { chain: "Gateway Cineplex", url: "https://www.ticketnet.com.ph/gateway-cineplex-18-movies" },
  { chain: "Power Plant", url: "https://powerplantcinema.com/bin/homepage.php" },
  { chain: "Fisher Mall", url: "https://fisherboxoffice.fishermall.com.ph/" },
] as const;
