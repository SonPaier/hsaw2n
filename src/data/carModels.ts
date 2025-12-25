// Popular car models for autocomplete suggestions
// Format: "Brand Model" - simple, without engine details or versions
// ORDERED BY POPULARITY within each brand (most popular first)

// Popularity score map - higher = more popular in Poland
const MODEL_POPULARITY: Record<string, number> = {
  // Very popular (score 100)
  "VW Golf": 100, "VW Passat": 100, "VW Polo": 100, "VW Tiguan": 100,
  "Skoda Octavia": 100, "Skoda Fabia": 100,
  "Ford Focus": 100, "Ford Mondeo": 100,
  "Opel Astra": 100, "Opel Corsa": 100,
  "Toyota Corolla": 100, "Toyota Yaris": 100,
  "Audi A4": 100, "Audi A3": 100, "Audi A6": 100,
  "BMW 3": 100, "BMW 5": 100,
  "Mercedes C": 100, "Mercedes E": 100,
  "Renault Clio": 100, "Renault Megane": 100,
  "Peugeot 308": 100, "Peugeot 208": 100,
  "Kia Ceed": 100, "Kia Sportage": 100,
  "Hyundai i30": 100, "Hyundai Tucson": 100,
  "Dacia Duster": 100, "Dacia Sandero": 100,
  "Fiat Tipo": 100, "Fiat 500": 100,
  "Seat Leon": 100, "Seat Ibiza": 100,
  "Honda Civic": 100,
  "Mazda 3": 100, "Mazda 6": 100, "Mazda CX-5": 100,
  "Nissan Qashqai": 100,
  
  // Popular (score 80)
  "VW T-Roc": 80, "VW Caddy": 80, "VW Touran": 80,
  "Skoda Superb": 80, "Skoda Kodiaq": 80, "Skoda Karoq": 80,
  "Ford Kuga": 80, "Ford Fiesta": 80, "Ford Puma": 80,
  "Opel Insignia": 80, "Opel Mokka": 80, "Opel Zafira": 80,
  "Toyota RAV4": 80, "Toyota C-HR": 80, "Toyota Camry": 80,
  "Audi Q5": 80, "Audi A5": 80, "Audi Q3": 80,
  "BMW X3": 80, "BMW X5": 80, "BMW 1": 80,
  "Mercedes A": 80, "Mercedes GLC": 80, "Mercedes B": 80,
  "Renault Captur": 80, "Renault Scenic": 80,
  "Peugeot 3008": 80, "Peugeot 508": 80,
  "Kia Rio": 80, "Kia Picanto": 80, "Kia Niro": 80,
  "Hyundai i20": 80, "Hyundai Kona": 80, "Hyundai i10": 80,
  "Volvo XC60": 80, "Volvo V60": 80,
  "Fiat Panda": 80,
  "Honda CR-V": 80,
  "Nissan Juke": 80, "Nissan X-Trail": 80,
  "Citroen C3": 80, "Citroen C4": 80,
  "Suzuki Vitara": 80, "Suzuki Swift": 80,
  "Cupra Formentor": 80,
  "Mini Cooper": 80, "Mini Countryman": 80,
  "Dacia Logan": 80, "Dacia Jogger": 80,
  "Jeep Grand Cherokee": 80, "Jeep Compass": 80,
  "Chrysler Grand Voyager": 80,
  "Mitsubishi Outlander": 80, "Mitsubishi ASX": 80,
  
  // Moderate (score 60)
  "VW Arteon": 60, "VW Touareg": 60, "VW T-Cross": 60, "VW Multivan": 60, "VW ID.4": 60, "VW ID.3": 60,
  "Skoda Scala": 60, "Skoda Kamiq": 60, "Skoda Enyaq": 60,
  "Ford S-Max": 60, "Ford Galaxy": 60, "Ford Ranger": 60,
  "Opel Grandland": 60, "Opel Crossland": 60, "Opel Combo": 60,
  "Toyota Avensis": 80, "Toyota Land Cruiser": 60, "Toyota Auris": 80,
  "Audi Q7": 60, "Audi A1": 60, "Audi Q2": 60, "Audi A7": 60,
  "BMW X1": 60, "BMW 4": 60, "BMW 2": 60, "BMW X6": 60,
  "Mercedes GLE": 60, "Mercedes CLA": 60, "Mercedes S": 60, "Mercedes GLA": 60,
  "Renault Kadjar": 60, "Renault Talisman": 60, "Renault Arkana": 60,
  "Peugeot 2008": 60, "Peugeot 5008": 60, "Peugeot 408": 60,
  "Kia Stonic": 60, "Kia Sorento": 60, "Kia ProCeed": 60,
  "Hyundai Santa Fe": 60, "Hyundai Ioniq 5": 60, "Hyundai Bayon": 60,
  "Volvo XC90": 60, "Volvo XC40": 60, "Volvo V90": 60, "Volvo S60": 60,
  "Seat Ateca": 60, "Seat Arona": 60, "Seat Tarraco": 60,
  "Alfa Romeo Giulia": 60, "Alfa Romeo Stelvio": 60, "Alfa Romeo Giulietta": 60,
  "Subaru Outback": 60, "Subaru Forester": 60, "Subaru XV": 60,
  "Lexus NX": 60, "Lexus RX": 60,
  "Honda Jazz": 60, "Honda HR-V": 60,
  "Nissan Micra": 60, "Nissan Leaf": 60,
  "Citroen C5 Aircross": 60, "Citroen C3 Aircross": 60, "Citroen Berlingo": 60,
  "Range Rover Evoque": 60, "Range Rover Sport": 60,
  "Porsche Cayenne": 60, "Porsche Macan": 60,
  "Tesla Model 3": 60, "Tesla Model Y": 60,
  "Mazda CX-30": 60, "Mazda CX-3": 60,
  "Suzuki S-Cross": 60, "Suzuki Jimny": 60,
  "Cupra Leon": 60, "Cupra Born": 60,
  "Mitsubishi L200": 60, "Mitsubishi Eclipse Cross": 60,
  
  // Less common (score 40)
  "Ford Edge": 40, "Ford Explorer": 40, "Ford Mustang": 40, "Ford Mustang Mach-E": 40,
  "Audi Q8": 40, "Audi A8": 40, "Audi e-tron": 40, "Audi TT": 40, "Audi R8": 40,
  "BMW 6": 40, "BMW 7": 40, "BMW 8": 40, "BMW X2": 40, "BMW X4": 40, "BMW X7": 40, "BMW iX": 40, "BMW i4": 40, "BMW i7": 40,
  "Mercedes CLS": 40, "Mercedes GLB": 40, "Mercedes GLS": 40, "Mercedes G": 40, "Mercedes EQC": 40, "Mercedes EQS": 40,
  "Renault Zoe": 40,
  "Peugeot e-208": 40,
  "Kia EV6": 40, "Kia EV9": 40,
  "Hyundai Ioniq 6": 40,
  "Volvo S90": 40, "Volvo C40": 40,
  "Fiat 500X": 40, "Fiat Ducato": 40,
  "Citroen C5": 40, "Citroen SpaceTourer": 40,
  "Honda Accord": 40, "Honda e": 40,
  "Nissan Ariya": 40, "Nissan Navara": 40,
  "Land Rover Defender": 40, "Land Rover Discovery": 40, "Land Rover Discovery Sport": 40,
  "Range Rover": 40, "Range Rover Velar": 40,
  "Porsche 911": 40, "Porsche Panamera": 40, "Porsche Taycan": 40, "Porsche Boxster": 40, "Porsche Cayman": 40,
  "Tesla Model S": 40, "Tesla Model X": 40,
  "Toyota Highlander": 40, "Toyota bZ4X": 40, "Toyota Supra": 40, "Toyota GR86": 40,
  "Lexus CT": 40, "Lexus ES": 40, "Lexus IS": 40, "Lexus LS": 40, "Lexus UX": 40,
  "Subaru Impreza": 40, "Subaru BRZ": 40,
  "Suzuki Ignis": 40,
  "Alfa Romeo Tonale": 40,
  "DS 3": 40, "DS 4": 40, "DS 7": 40, "DS 9": 40,
  "Mini Clubman": 40, "Mini Paceman": 40,
  "Dacia Spring": 40,
  "Mazda 2": 40, "Mazda MX-5": 40, "Mazda MX-30": 40, "Mazda CX-60": 40,
  "Cupra Ateca": 40,
  "Jeep Renegade": 40, "Jeep Cherokee": 40, "Jeep Wrangler": 40,
  "Chrysler 300": 40, "Chrysler Pacifica": 40,
  "Dodge Durango": 40, "Dodge Challenger": 40, "Dodge Charger": 40, "Dodge RAM": 40,
  "Mitsubishi Space Star": 40,
};

export const CAR_MODELS = [
  // VW - very popular
  "VW Golf", "VW Passat", "VW Polo", "VW Tiguan", "VW T-Roc", "VW Caddy", "VW Touran",
  "VW Arteon", "VW Touareg", "VW T-Cross", "VW Multivan", "VW ID.4", "VW ID.3", "VW ID.5",
  
  // Skoda - very popular in Poland
  "Skoda Octavia", "Skoda Fabia", "Skoda Superb", "Skoda Kodiaq", "Skoda Karoq",
  "Skoda Scala", "Skoda Kamiq", "Skoda Enyaq",
  
  // Ford - Focus and Mondeo most popular
  "Ford Focus", "Ford Mondeo", "Ford Fiesta", "Ford Kuga", "Ford Puma",
  "Ford S-Max", "Ford Galaxy", "Ford Ranger", "Ford Edge", "Ford Explorer", 
  "Ford Mustang", "Ford Mustang Mach-E",
  
  // Opel
  "Opel Astra", "Opel Corsa", "Opel Insignia", "Opel Mokka", "Opel Zafira",
  "Opel Grandland", "Opel Crossland", "Opel Combo",
  
  // Toyota
  "Toyota Corolla", "Toyota Yaris", "Toyota Avensis", "Toyota Auris", "Toyota RAV4", "Toyota C-HR", "Toyota Camry",
  "Toyota Land Cruiser", "Toyota Highlander", "Toyota bZ4X", "Toyota Supra", "Toyota GR86",
  
  // Audi
  "Audi A4", "Audi A3", "Audi A6", "Audi Q5", "Audi A5", "Audi Q3",
  "Audi Q7", "Audi A1", "Audi Q2", "Audi A7", "Audi Q8", "Audi A8", 
  "Audi e-tron", "Audi TT", "Audi R8",
  
  // BMW
  "BMW 3", "BMW 5", "BMW X3", "BMW X5", "BMW 1",
  "BMW X1", "BMW 4", "BMW 2", "BMW X6", "BMW 6", "BMW 7", "BMW 8", 
  "BMW X2", "BMW X4", "BMW X7", "BMW iX", "BMW i4", "BMW i7",
  
  // Mercedes
  "Mercedes C", "Mercedes E", "Mercedes A", "Mercedes GLC", "Mercedes B",
  "Mercedes GLE", "Mercedes CLA", "Mercedes S", "Mercedes GLA",
  "Mercedes CLS", "Mercedes GLB", "Mercedes GLS", "Mercedes G", "Mercedes EQC", "Mercedes EQS",
  
  // Renault
  "Renault Clio", "Renault Megane", "Renault Captur", "Renault Scenic",
  "Renault Kadjar", "Renault Talisman", "Renault Arkana", "Renault Zoe",
  
  // Peugeot
  "Peugeot 308", "Peugeot 208", "Peugeot 3008", "Peugeot 508",
  "Peugeot 2008", "Peugeot 5008", "Peugeot 408", "Peugeot e-208",
  
  // Kia
  "Kia Ceed", "Kia Sportage", "Kia Rio", "Kia Picanto", "Kia Niro",
  "Kia Stonic", "Kia Sorento", "Kia ProCeed", "Kia EV6", "Kia EV9",
  
  // Hyundai
  "Hyundai i30", "Hyundai Tucson", "Hyundai i20", "Hyundai Kona", "Hyundai i10",
  "Hyundai Santa Fe", "Hyundai Ioniq 5", "Hyundai Bayon", "Hyundai Ioniq 6",
  
  // Dacia - very popular budget brand
  "Dacia Duster", "Dacia Sandero", "Dacia Logan", "Dacia Jogger", "Dacia Spring",
  
  // Fiat
  "Fiat Tipo", "Fiat 500", "Fiat Panda", "Fiat 500X", "Fiat Ducato",
  
  // Seat
  "Seat Leon", "Seat Ibiza", "Seat Ateca", "Seat Arona", "Seat Tarraco",
  
  // Volvo
  "Volvo XC60", "Volvo V60", "Volvo XC90", "Volvo XC40", "Volvo V90", 
  "Volvo S60", "Volvo S90", "Volvo C40",
  
  // Honda
  "Honda Civic", "Honda CR-V", "Honda Jazz", "Honda HR-V", "Honda Accord", "Honda e",
  
  // Mazda
  "Mazda 3", "Mazda 6", "Mazda CX-5", "Mazda CX-30", "Mazda CX-3",
  "Mazda 2", "Mazda MX-5", "Mazda MX-30", "Mazda CX-60",
  
  // Nissan
  "Nissan Qashqai", "Nissan Juke", "Nissan X-Trail",
  "Nissan Micra", "Nissan Leaf", "Nissan Ariya", "Nissan Navara",
  
  // Citroen
  "Citroen C3", "Citroen C4", "Citroen C5 Aircross", "Citroen C3 Aircross", 
  "Citroen Berlingo", "Citroen C5", "Citroen SpaceTourer",
  
  // Suzuki
  "Suzuki Vitara", "Suzuki Swift", "Suzuki S-Cross", "Suzuki Jimny", "Suzuki Ignis",
  
  // Cupra
  "Cupra Formentor", "Cupra Leon", "Cupra Born", "Cupra Ateca",
  
  // Mini
  "Mini Cooper", "Mini Countryman", "Mini Clubman", "Mini Paceman",
  
  // Alfa Romeo
  "Alfa Romeo Giulia", "Alfa Romeo Stelvio", "Alfa Romeo Giulietta", "Alfa Romeo Tonale",
  
  // Subaru
  "Subaru Outback", "Subaru Forester", "Subaru XV", "Subaru Impreza", "Subaru BRZ",
  
  // Lexus
  "Lexus NX", "Lexus RX", "Lexus CT", "Lexus ES", "Lexus IS", "Lexus LS", "Lexus UX",
  
  // Jeep
  "Jeep Grand Cherokee", "Jeep Compass", "Jeep Renegade", "Jeep Cherokee", "Jeep Wrangler",
  
  // Chrysler/Dodge
  "Chrysler Grand Voyager", "Chrysler 300", "Chrysler Pacifica",
  "Dodge Durango", "Dodge Challenger", "Dodge Charger", "Dodge RAM",
  
  // Range Rover / Land Rover
  "Range Rover Evoque", "Range Rover Sport", "Range Rover", "Range Rover Velar",
  "Land Rover Defender", "Land Rover Discovery", "Land Rover Discovery Sport",
  
  // Porsche
  "Porsche Cayenne", "Porsche Macan", "Porsche 911", "Porsche Panamera", 
  "Porsche Taycan", "Porsche Boxster", "Porsche Cayman",
  
  // Tesla
  "Tesla Model 3", "Tesla Model Y", "Tesla Model S", "Tesla Model X",
  
  // Mitsubishi
  "Mitsubishi Outlander", "Mitsubishi ASX", "Mitsubishi L200", 
  "Mitsubishi Eclipse Cross", "Mitsubishi Space Star",
  
  // DS
  "DS 3", "DS 4", "DS 7", "DS 9",
];

/**
 * Get popularity score for a model (higher = more popular)
 */
function getPopularity(model: string): number {
  return MODEL_POPULARITY[model] ?? 30; // Default to low score for unknown models
}

/**
 * Search car models by query
 * Returns up to `limit` matching models, sorted by popularity
 */
export function searchCarModels(query: string, limit = 2): string[] {
  if (!query || query.length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Find models that match the query
  const matches = CAR_MODELS.filter(model => 
    model.toLowerCase().includes(normalizedQuery)
  );
  
  // Sort by popularity first, then by whether it starts with query
  matches.sort((a, b) => {
    const popA = getPopularity(a);
    const popB = getPopularity(b);
    
    // Primary: popularity
    if (popA !== popB) return popB - popA;
    
    // Secondary: starts with query
    const aStarts = a.toLowerCase().startsWith(normalizedQuery);
    const bStarts = b.toLowerCase().startsWith(normalizedQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    return a.localeCompare(b);
  });
  
  return matches.slice(0, limit);
}
