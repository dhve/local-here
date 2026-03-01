export interface CityConfig {
  id: string;
  name: string;
  tagline: string;
  voiceId: string;
  accentColor: string;
  image: any;
}

export const CITIES: CityConfig[] = [
  {
    id: "nyc",
    name: "New York",
    tagline: "The city that never sleeps",
    voiceId: "hU9xpIwLBrQ7ueYNjP7b",
    accentColor: "#FF6B6B",
    image: require("../../assets/images/nyc-city.png"),
  },
  {
    id: "boston",
    name: "Boston",
    tagline: "Americas walking city",
    voiceId: "Gf1KYedBUv2F4rCJhVFJ",
    accentColor: "#4ECDC4",
    image: require("../../assets/images/boston-city.png"),
  },
  {
    id: "nashville",
    name: "Nashville",
    tagline: "Music city USA",
    voiceId: "Bj9UqZbhQsanLzgalpEG",
    accentColor: "#FFE66D",
    image: require("../../assets/images/nashville-city.png"),
  },
];

export const getCityById = (id: string): CityConfig | undefined => {
  return CITIES.find((city) => city.id === id);
};
