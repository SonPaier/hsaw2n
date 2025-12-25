// Popular car models for autocomplete suggestions
// Format: "Brand Model" - simple, without engine details or versions

export const CAR_MODELS = [
  // Audi
  "Audi A1", "Audi A3", "Audi A4", "Audi A5", "Audi A6", "Audi A7", "Audi A8",
  "Audi Q2", "Audi Q3", "Audi Q5", "Audi Q7", "Audi Q8", "Audi e-tron", "Audi TT", "Audi R8",
  
  // BMW
  "BMW 1", "BMW 2", "BMW 3", "BMW 4", "BMW 5", "BMW 6", "BMW 7", "BMW 8",
  "BMW X1", "BMW X2", "BMW X3", "BMW X4", "BMW X5", "BMW X6", "BMW X7", "BMW iX", "BMW i4", "BMW i7",
  
  // Mercedes
  "Mercedes A", "Mercedes B", "Mercedes C", "Mercedes E", "Mercedes S",
  "Mercedes CLA", "Mercedes CLS", "Mercedes GLA", "Mercedes GLB", "Mercedes GLC", 
  "Mercedes GLE", "Mercedes GLS", "Mercedes G", "Mercedes EQC", "Mercedes EQS",
  
  // Volkswagen
  "VW Golf", "VW Polo", "VW Passat", "VW Arteon", "VW Tiguan", "VW Touareg", 
  "VW T-Roc", "VW T-Cross", "VW ID.3", "VW ID.4", "VW ID.5", "VW Caddy", "VW Multivan",
  
  // Toyota
  "Toyota Yaris", "Toyota Corolla", "Toyota Camry", "Toyota RAV4", "Toyota C-HR",
  "Toyota Land Cruiser", "Toyota Highlander", "Toyota bZ4X", "Toyota Supra", "Toyota GR86",
  
  // Skoda
  "Skoda Fabia", "Skoda Scala", "Skoda Octavia", "Skoda Superb", 
  "Skoda Kamiq", "Skoda Karoq", "Skoda Kodiaq", "Skoda Enyaq",
  
  // Ford
  "Ford Fiesta", "Ford Focus", "Ford Mondeo", "Ford Puma", "Ford Kuga", 
  "Ford Edge", "Ford Explorer", "Ford Mustang", "Ford Mustang Mach-E", "Ford Ranger",
  
  // Opel
  "Opel Corsa", "Opel Astra", "Opel Insignia", "Opel Mokka", 
  "Opel Grandland", "Opel Crossland", "Opel Combo", "Opel Zafira",
  
  // Renault
  "Renault Clio", "Renault Megane", "Renault Captur", "Renault Kadjar", 
  "Renault Arkana", "Renault Scenic", "Renault Talisman", "Renault Zoe",
  
  // Peugeot
  "Peugeot 208", "Peugeot 308", "Peugeot 408", "Peugeot 508", 
  "Peugeot 2008", "Peugeot 3008", "Peugeot 5008", "Peugeot e-208",
  
  // Citroen
  "Citroen C3", "Citroen C4", "Citroen C5", "Citroen C3 Aircross", 
  "Citroen C5 Aircross", "Citroen Berlingo", "Citroen SpaceTourer",
  
  // Fiat
  "Fiat 500", "Fiat Panda", "Fiat Tipo", "Fiat 500X", "Fiat Ducato",
  
  // Hyundai
  "Hyundai i10", "Hyundai i20", "Hyundai i30", "Hyundai Kona", "Hyundai Tucson",
  "Hyundai Santa Fe", "Hyundai Ioniq 5", "Hyundai Ioniq 6", "Hyundai Bayon",
  
  // Kia
  "Kia Picanto", "Kia Rio", "Kia Ceed", "Kia ProCeed", "Kia Stonic", 
  "Kia Niro", "Kia Sportage", "Kia Sorento", "Kia EV6", "Kia EV9",
  
  // Mazda
  "Mazda 2", "Mazda 3", "Mazda 6", "Mazda CX-3", "Mazda CX-30", 
  "Mazda CX-5", "Mazda CX-60", "Mazda MX-5", "Mazda MX-30",
  
  // Honda
  "Honda Jazz", "Honda Civic", "Honda Accord", "Honda HR-V", "Honda CR-V", "Honda e",
  
  // Nissan
  "Nissan Micra", "Nissan Juke", "Nissan Qashqai", "Nissan X-Trail", 
  "Nissan Leaf", "Nissan Ariya", "Nissan Navara",
  
  // Volvo
  "Volvo S60", "Volvo S90", "Volvo V60", "Volvo V90", 
  "Volvo XC40", "Volvo XC60", "Volvo XC90", "Volvo C40",
  
  // Seat
  "Seat Ibiza", "Seat Leon", "Seat Arona", "Seat Ateca", "Seat Tarraco",
  
  // Cupra
  "Cupra Leon", "Cupra Formentor", "Cupra Born", "Cupra Ateca",
  
  // Jeep
  "Jeep Renegade", "Jeep Compass", "Jeep Cherokee", "Jeep Grand Cherokee", "Jeep Wrangler",
  
  // Land Rover
  "Land Rover Defender", "Land Rover Discovery", "Land Rover Discovery Sport",
  "Range Rover", "Range Rover Sport", "Range Rover Evoque", "Range Rover Velar",
  
  // Porsche
  "Porsche 911", "Porsche Cayenne", "Porsche Macan", "Porsche Panamera", 
  "Porsche Taycan", "Porsche Boxster", "Porsche Cayman",
  
  // Tesla
  "Tesla Model 3", "Tesla Model S", "Tesla Model X", "Tesla Model Y",
  
  // Mini
  "Mini Cooper", "Mini Clubman", "Mini Countryman", "Mini Paceman",
  
  // Alfa Romeo
  "Alfa Romeo Giulia", "Alfa Romeo Stelvio", "Alfa Romeo Tonale", "Alfa Romeo Giulietta",
  
  // Lexus
  "Lexus CT", "Lexus ES", "Lexus IS", "Lexus LS", "Lexus NX", "Lexus RX", "Lexus UX",
  
  // Subaru
  "Subaru Impreza", "Subaru XV", "Subaru Outback", "Subaru Forester", "Subaru BRZ",
  
  // Suzuki
  "Suzuki Swift", "Suzuki Vitara", "Suzuki S-Cross", "Suzuki Jimny", "Suzuki Ignis",
  
  // Dacia
  "Dacia Sandero", "Dacia Logan", "Dacia Duster", "Dacia Jogger", "Dacia Spring",
  
  // Chrysler/Dodge
  "Chrysler Grand Voyager", "Chrysler 300", "Chrysler Pacifica",
  "Dodge Durango", "Dodge Challenger", "Dodge Charger", "Dodge RAM",
  
  // Mitsubishi
  "Mitsubishi Space Star", "Mitsubishi ASX", "Mitsubishi Eclipse Cross", 
  "Mitsubishi Outlander", "Mitsubishi L200",
  
  // DS
  "DS 3", "DS 4", "DS 7", "DS 9",
];

/**
 * Search car models by query
 * Returns up to `limit` matching models
 */
export function searchCarModels(query: string, limit = 2): string[] {
  if (!query || query.length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Find models that match the query
  const matches = CAR_MODELS.filter(model => 
    model.toLowerCase().includes(normalizedQuery)
  );
  
  // Sort by relevance (models starting with query first)
  matches.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(normalizedQuery);
    const bStarts = b.toLowerCase().startsWith(normalizedQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.localeCompare(b);
  });
  
  return matches.slice(0, limit);
}
