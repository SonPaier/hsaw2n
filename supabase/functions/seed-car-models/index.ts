import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Car models data from carsList.json
const carsListData = [
  {
    "brand": "Alfa Romeo",
    "models": [
      { "name": "Giulia", "size": "M" },
      { "name": "Giulietta", "size": "M" },
      { "name": "Stelvio", "size": "L" },
      { "name": "Tonale", "size": "M" },
      { "name": "MiTo", "size": "S" },
      { "name": "159", "size": "M" },
      { "name": "147", "size": "S" },
      { "name": "Brera", "size": "M" },
      { "name": "Spider", "size": "M" },
      { "name": "GT", "size": "M" },
      { "name": "166", "size": "L" },
      { "name": "156", "size": "M" },
      { "name": "4C", "size": "S" }
    ]
  },
  {
    "brand": "Audi",
    "models": [
      { "name": "A1", "size": "S" },
      { "name": "A3", "size": "M" },
      { "name": "A4", "size": "M" },
      { "name": "A5", "size": "M" },
      { "name": "A6", "size": "L" },
      { "name": "A7", "size": "L" },
      { "name": "A8", "size": "L" },
      { "name": "Q2", "size": "S" },
      { "name": "Q3", "size": "M" },
      { "name": "Q4 e-tron", "size": "M" },
      { "name": "Q5", "size": "L" },
      { "name": "Q7", "size": "L" },
      { "name": "Q8", "size": "L" },
      { "name": "e-tron", "size": "L" },
      { "name": "e-tron GT", "size": "L" },
      { "name": "TT", "size": "S" },
      { "name": "R8", "size": "M" },
      { "name": "RS3", "size": "M" },
      { "name": "RS4", "size": "M" },
      { "name": "RS5", "size": "M" },
      { "name": "RS6", "size": "L" },
      { "name": "RS7", "size": "L" },
      { "name": "RS Q3", "size": "M" },
      { "name": "RS Q8", "size": "L" },
      { "name": "S3", "size": "M" },
      { "name": "S4", "size": "M" },
      { "name": "S5", "size": "M" },
      { "name": "S6", "size": "L" },
      { "name": "S7", "size": "L" },
      { "name": "S8", "size": "L" },
      { "name": "SQ5", "size": "L" },
      { "name": "SQ7", "size": "L" },
      { "name": "SQ8", "size": "L" }
    ]
  },
  {
    "brand": "BMW",
    "models": [
      { "name": "Seria 1", "size": "S" },
      { "name": "Seria 2", "size": "M" },
      { "name": "Seria 2 Active Tourer", "size": "M" },
      { "name": "Seria 2 Gran Coupe", "size": "M" },
      { "name": "Seria 3", "size": "M" },
      { "name": "Seria 4", "size": "M" },
      { "name": "Seria 5", "size": "L" },
      { "name": "Seria 6", "size": "L" },
      { "name": "Seria 7", "size": "L" },
      { "name": "Seria 8", "size": "L" },
      { "name": "X1", "size": "M" },
      { "name": "X2", "size": "M" },
      { "name": "X3", "size": "L" },
      { "name": "X4", "size": "L" },
      { "name": "X5", "size": "L" },
      { "name": "X6", "size": "L" },
      { "name": "X7", "size": "L" },
      { "name": "XM", "size": "L" },
      { "name": "Z4", "size": "M" },
      { "name": "iX", "size": "L" },
      { "name": "iX1", "size": "M" },
      { "name": "iX3", "size": "L" },
      { "name": "i3", "size": "S" },
      { "name": "i4", "size": "M" },
      { "name": "i5", "size": "L" },
      { "name": "i7", "size": "L" },
      { "name": "M2", "size": "M" },
      { "name": "M3", "size": "M" },
      { "name": "M4", "size": "M" },
      { "name": "M5", "size": "L" },
      { "name": "M8", "size": "L" },
      { "name": "X3 M", "size": "L" },
      { "name": "X4 M", "size": "L" },
      { "name": "X5 M", "size": "L" },
      { "name": "X6 M", "size": "L" }
    ]
  },
  {
    "brand": "Chevrolet",
    "models": [
      { "name": "Camaro", "size": "L" },
      { "name": "Corvette", "size": "L" },
      { "name": "Malibu", "size": "L" },
      { "name": "Spark", "size": "S" },
      { "name": "Aveo", "size": "S" },
      { "name": "Cruze", "size": "M" },
      { "name": "Orlando", "size": "L" },
      { "name": "Captiva", "size": "L" },
      { "name": "Trax", "size": "M" },
      { "name": "Equinox", "size": "L" },
      { "name": "Tahoe", "size": "L" },
      { "name": "Suburban", "size": "L" },
      { "name": "Silverado", "size": "L" }
    ]
  },
  {
    "brand": "Citroën",
    "models": [
      { "name": "C1", "size": "S" },
      { "name": "C3", "size": "S" },
      { "name": "C3 Aircross", "size": "M" },
      { "name": "C4", "size": "M" },
      { "name": "C4 Cactus", "size": "M" },
      { "name": "C4 Picasso", "size": "L" },
      { "name": "C5", "size": "L" },
      { "name": "C5 Aircross", "size": "L" },
      { "name": "C5 X", "size": "L" },
      { "name": "Berlingo", "size": "L" },
      { "name": "SpaceTourer", "size": "L" },
      { "name": "DS3", "size": "S" },
      { "name": "DS4", "size": "M" },
      { "name": "DS5", "size": "L" },
      { "name": "ë-C4", "size": "M" },
      { "name": "Ami", "size": "S" }
    ]
  },
  {
    "brand": "Cupra",
    "models": [
      { "name": "Born", "size": "M" },
      { "name": "Formentor", "size": "L" },
      { "name": "Leon", "size": "M" },
      { "name": "Ateca", "size": "L" },
      { "name": "Tavascan", "size": "L" }
    ]
  },
  {
    "brand": "Dacia",
    "models": [
      { "name": "Sandero", "size": "S" },
      { "name": "Sandero Stepway", "size": "S" },
      { "name": "Logan", "size": "M" },
      { "name": "Logan MCV", "size": "M" },
      { "name": "Duster", "size": "M" },
      { "name": "Jogger", "size": "L" },
      { "name": "Spring", "size": "S" },
      { "name": "Lodgy", "size": "L" },
      { "name": "Dokker", "size": "L" }
    ]
  },
  {
    "brand": "DS",
    "models": [
      { "name": "DS 3", "size": "S" },
      { "name": "DS 3 Crossback", "size": "M" },
      { "name": "DS 4", "size": "M" },
      { "name": "DS 7", "size": "L" },
      { "name": "DS 9", "size": "L" }
    ]
  },
  {
    "brand": "Fiat",
    "models": [
      { "name": "500", "size": "S" },
      { "name": "500C", "size": "S" },
      { "name": "500e", "size": "S" },
      { "name": "500L", "size": "M" },
      { "name": "500X", "size": "M" },
      { "name": "Panda", "size": "S" },
      { "name": "Punto", "size": "S" },
      { "name": "Tipo", "size": "M" },
      { "name": "Doblo", "size": "L" },
      { "name": "Ducato", "size": "L" },
      { "name": "Fiorino", "size": "M" },
      { "name": "Fullback", "size": "L" },
      { "name": "124 Spider", "size": "S" },
      { "name": "Bravo", "size": "M" },
      { "name": "Linea", "size": "M" },
      { "name": "Qubo", "size": "M" },
      { "name": "Talento", "size": "L" },
      { "name": "600e", "size": "M" }
    ]
  },
  {
    "brand": "Ford",
    "models": [
      { "name": "Fiesta", "size": "S" },
      { "name": "Focus", "size": "M" },
      { "name": "Mondeo", "size": "L" },
      { "name": "Puma", "size": "M" },
      { "name": "Kuga", "size": "L" },
      { "name": "EcoSport", "size": "M" },
      { "name": "Edge", "size": "L" },
      { "name": "Explorer", "size": "L" },
      { "name": "Mustang", "size": "L" },
      { "name": "Mustang Mach-E", "size": "L" },
      { "name": "Galaxy", "size": "L" },
      { "name": "S-Max", "size": "L" },
      { "name": "C-Max", "size": "M" },
      { "name": "B-Max", "size": "S" },
      { "name": "Transit", "size": "L" },
      { "name": "Transit Connect", "size": "L" },
      { "name": "Transit Custom", "size": "L" },
      { "name": "Transit Courier", "size": "M" },
      { "name": "Ranger", "size": "L" },
      { "name": "Ka+", "size": "S" },
      { "name": "Tourneo Connect", "size": "L" },
      { "name": "Tourneo Custom", "size": "L" },
      { "name": "Tourneo Courier", "size": "M" }
    ]
  },
  {
    "brand": "Honda",
    "models": [
      { "name": "Jazz", "size": "S" },
      { "name": "Civic", "size": "M" },
      { "name": "Accord", "size": "L" },
      { "name": "HR-V", "size": "M" },
      { "name": "CR-V", "size": "L" },
      { "name": "e", "size": "S" },
      { "name": "e:Ny1", "size": "M" },
      { "name": "ZR-V", "size": "L" },
      { "name": "CR-Z", "size": "S" },
      { "name": "Insight", "size": "M" },
      { "name": "NSX", "size": "M" },
      { "name": "S2000", "size": "M" },
      { "name": "Legend", "size": "L" }
    ]
  },
  {
    "brand": "Hyundai",
    "models": [
      { "name": "i10", "size": "S" },
      { "name": "i20", "size": "S" },
      { "name": "i30", "size": "M" },
      { "name": "i40", "size": "L" },
      { "name": "Elantra", "size": "M" },
      { "name": "Sonata", "size": "L" },
      { "name": "Kona", "size": "M" },
      { "name": "Kona Electric", "size": "M" },
      { "name": "Tucson", "size": "L" },
      { "name": "Santa Fe", "size": "L" },
      { "name": "Ioniq", "size": "M" },
      { "name": "Ioniq 5", "size": "L" },
      { "name": "Ioniq 6", "size": "L" },
      { "name": "Bayon", "size": "S" },
      { "name": "Nexo", "size": "L" },
      { "name": "Staria", "size": "L" },
      { "name": "ix20", "size": "S" },
      { "name": "ix35", "size": "M" },
      { "name": "Veloster", "size": "M" },
      { "name": "Genesis Coupe", "size": "M" },
      { "name": "i30 N", "size": "M" }
    ]
  },
  {
    "brand": "Jaguar",
    "models": [
      { "name": "XE", "size": "M" },
      { "name": "XF", "size": "L" },
      { "name": "XJ", "size": "L" },
      { "name": "F-Type", "size": "M" },
      { "name": "F-Pace", "size": "L" },
      { "name": "E-Pace", "size": "M" },
      { "name": "I-Pace", "size": "L" },
      { "name": "XK", "size": "L" },
      { "name": "S-Type", "size": "L" },
      { "name": "X-Type", "size": "M" }
    ]
  },
  {
    "brand": "Jeep",
    "models": [
      { "name": "Renegade", "size": "M" },
      { "name": "Compass", "size": "M" },
      { "name": "Cherokee", "size": "L" },
      { "name": "Grand Cherokee", "size": "L" },
      { "name": "Wrangler", "size": "L" },
      { "name": "Gladiator", "size": "L" },
      { "name": "Commander", "size": "L" },
      { "name": "Patriot", "size": "M" },
      { "name": "Avenger", "size": "M" }
    ]
  },
  {
    "brand": "Kia",
    "models": [
      { "name": "Picanto", "size": "S" },
      { "name": "Rio", "size": "S" },
      { "name": "Ceed", "size": "M" },
      { "name": "ProCeed", "size": "M" },
      { "name": "XCeed", "size": "M" },
      { "name": "Stonic", "size": "M" },
      { "name": "Niro", "size": "M" },
      { "name": "EV6", "size": "L" },
      { "name": "EV9", "size": "L" },
      { "name": "Sportage", "size": "L" },
      { "name": "Sorento", "size": "L" },
      { "name": "Carnival", "size": "L" },
      { "name": "Stinger", "size": "L" },
      { "name": "Optima", "size": "L" },
      { "name": "Soul", "size": "M" },
      { "name": "e-Soul", "size": "M" },
      { "name": "Venga", "size": "M" },
      { "name": "Carens", "size": "L" },
      { "name": "Cee'd", "size": "M" }
    ]
  },
  {
    "brand": "Land Rover",
    "models": [
      { "name": "Range Rover", "size": "L" },
      { "name": "Range Rover Sport", "size": "L" },
      { "name": "Range Rover Velar", "size": "L" },
      { "name": "Range Rover Evoque", "size": "M" },
      { "name": "Discovery", "size": "L" },
      { "name": "Discovery Sport", "size": "L" },
      { "name": "Defender", "size": "L" },
      { "name": "Freelander", "size": "M" }
    ]
  },
  {
    "brand": "Lexus",
    "models": [
      { "name": "CT", "size": "M" },
      { "name": "IS", "size": "M" },
      { "name": "ES", "size": "L" },
      { "name": "GS", "size": "L" },
      { "name": "LS", "size": "L" },
      { "name": "UX", "size": "M" },
      { "name": "NX", "size": "L" },
      { "name": "RX", "size": "L" },
      { "name": "RZ", "size": "L" },
      { "name": "LX", "size": "L" },
      { "name": "LC", "size": "L" },
      { "name": "RC", "size": "M" },
      { "name": "LBX", "size": "M" }
    ]
  },
  {
    "brand": "Maserati",
    "models": [
      { "name": "Ghibli", "size": "L" },
      { "name": "Quattroporte", "size": "L" },
      { "name": "Levante", "size": "L" },
      { "name": "GranTurismo", "size": "L" },
      { "name": "GranCabrio", "size": "L" },
      { "name": "MC20", "size": "M" },
      { "name": "Grecale", "size": "L" }
    ]
  },
  {
    "brand": "Mazda",
    "models": [
      { "name": "2", "size": "S" },
      { "name": "3", "size": "M" },
      { "name": "6", "size": "L" },
      { "name": "CX-3", "size": "M" },
      { "name": "CX-30", "size": "M" },
      { "name": "CX-5", "size": "L" },
      { "name": "CX-60", "size": "L" },
      { "name": "CX-90", "size": "L" },
      { "name": "MX-5", "size": "S" },
      { "name": "MX-30", "size": "M" },
      { "name": "5", "size": "M" },
      { "name": "CX-7", "size": "L" },
      { "name": "CX-9", "size": "L" },
      { "name": "RX-8", "size": "M" }
    ]
  },
  {
    "brand": "Mercedes-Benz",
    "models": [
      { "name": "Klasa A", "size": "M" },
      { "name": "Klasa B", "size": "M" },
      { "name": "Klasa C", "size": "M" },
      { "name": "Klasa E", "size": "L" },
      { "name": "Klasa S", "size": "L" },
      { "name": "CLA", "size": "M" },
      { "name": "CLS", "size": "L" },
      { "name": "GLA", "size": "M" },
      { "name": "GLB", "size": "M" },
      { "name": "GLC", "size": "L" },
      { "name": "GLE", "size": "L" },
      { "name": "GLS", "size": "L" },
      { "name": "Klasa G", "size": "L" },
      { "name": "EQA", "size": "M" },
      { "name": "EQB", "size": "M" },
      { "name": "EQC", "size": "L" },
      { "name": "EQE", "size": "L" },
      { "name": "EQS", "size": "L" },
      { "name": "AMG GT", "size": "L" },
      { "name": "SL", "size": "L" },
      { "name": "SLC", "size": "M" },
      { "name": "Klasa V", "size": "L" },
      { "name": "Vito", "size": "L" },
      { "name": "Sprinter", "size": "L" },
      { "name": "Citan", "size": "M" },
      { "name": "eVito", "size": "L" },
      { "name": "eSprinter", "size": "L" },
      { "name": "EQV", "size": "L" },
      { "name": "Klasa R", "size": "L" },
      { "name": "Klasa X", "size": "L" }
    ]
  },
  {
    "brand": "MINI",
    "models": [
      { "name": "Cooper", "size": "S" },
      { "name": "Cooper S", "size": "S" },
      { "name": "Cooper SE", "size": "S" },
      { "name": "Clubman", "size": "M" },
      { "name": "Countryman", "size": "M" },
      { "name": "Paceman", "size": "M" },
      { "name": "Cabrio", "size": "S" },
      { "name": "John Cooper Works", "size": "S" },
      { "name": "Coupe", "size": "S" },
      { "name": "Roadster", "size": "S" }
    ]
  },
  {
    "brand": "Mitsubishi",
    "models": [
      { "name": "Space Star", "size": "S" },
      { "name": "Colt", "size": "S" },
      { "name": "Lancer", "size": "M" },
      { "name": "ASX", "size": "M" },
      { "name": "Eclipse Cross", "size": "M" },
      { "name": "Outlander", "size": "L" },
      { "name": "Outlander PHEV", "size": "L" },
      { "name": "Pajero", "size": "L" },
      { "name": "L200", "size": "L" },
      { "name": "Pajero Sport", "size": "L" },
      { "name": "i-MiEV", "size": "S" }
    ]
  },
  {
    "brand": "Nissan",
    "models": [
      { "name": "Micra", "size": "S" },
      { "name": "Note", "size": "S" },
      { "name": "Juke", "size": "M" },
      { "name": "Qashqai", "size": "M" },
      { "name": "X-Trail", "size": "L" },
      { "name": "Ariya", "size": "L" },
      { "name": "Leaf", "size": "M" },
      { "name": "e-NV200", "size": "L" },
      { "name": "Pulsar", "size": "M" },
      { "name": "Sentra", "size": "M" },
      { "name": "Navara", "size": "L" },
      { "name": "Pathfinder", "size": "L" },
      { "name": "Murano", "size": "L" },
      { "name": "370Z", "size": "M" },
      { "name": "GT-R", "size": "L" },
      { "name": "Townstar", "size": "M" },
      { "name": "Primastar", "size": "L" },
      { "name": "Interstar", "size": "L" }
    ]
  },
  {
    "brand": "Opel",
    "models": [
      { "name": "Corsa", "size": "S" },
      { "name": "Corsa-e", "size": "S" },
      { "name": "Astra", "size": "M" },
      { "name": "Astra-e", "size": "M" },
      { "name": "Insignia", "size": "L" },
      { "name": "Mokka", "size": "M" },
      { "name": "Mokka-e", "size": "M" },
      { "name": "Crossland", "size": "M" },
      { "name": "Grandland", "size": "L" },
      { "name": "Combo", "size": "L" },
      { "name": "Combo-e", "size": "L" },
      { "name": "Vivaro", "size": "L" },
      { "name": "Vivaro-e", "size": "L" },
      { "name": "Movano", "size": "L" },
      { "name": "Zafira", "size": "L" },
      { "name": "Zafira Life", "size": "L" },
      { "name": "Meriva", "size": "M" },
      { "name": "Adam", "size": "S" },
      { "name": "Karl", "size": "S" },
      { "name": "Cascada", "size": "M" },
      { "name": "Ampera", "size": "M" },
      { "name": "Ampera-e", "size": "M" },
      { "name": "GT", "size": "M" },
      { "name": "Manta", "size": "M" },
      { "name": "Rocks-e", "size": "S" },
      { "name": "Frontera", "size": "L" }
    ]
  },
  {
    "brand": "Peugeot",
    "models": [
      { "name": "108", "size": "S" },
      { "name": "208", "size": "S" },
      { "name": "e-208", "size": "S" },
      { "name": "308", "size": "M" },
      { "name": "e-308", "size": "M" },
      { "name": "408", "size": "L" },
      { "name": "508", "size": "L" },
      { "name": "2008", "size": "M" },
      { "name": "e-2008", "size": "M" },
      { "name": "3008", "size": "L" },
      { "name": "E-3008", "size": "L" },
      { "name": "5008", "size": "L" },
      { "name": "E-5008", "size": "L" },
      { "name": "Rifter", "size": "L" },
      { "name": "e-Rifter", "size": "L" },
      { "name": "Partner", "size": "L" },
      { "name": "Traveller", "size": "L" },
      { "name": "e-Traveller", "size": "L" },
      { "name": "Expert", "size": "L" },
      { "name": "e-Expert", "size": "L" },
      { "name": "Boxer", "size": "L" },
      { "name": "e-Boxer", "size": "L" },
      { "name": "RCZ", "size": "M" },
      { "name": "iOn", "size": "S" },
      { "name": "107", "size": "S" },
      { "name": "206", "size": "S" },
      { "name": "207", "size": "S" },
      { "name": "301", "size": "M" },
      { "name": "307", "size": "M" },
      { "name": "407", "size": "L" },
      { "name": "607", "size": "L" },
      { "name": "807", "size": "L" },
      { "name": "4007", "size": "L" },
      { "name": "4008", "size": "L" }
    ]
  },
  {
    "brand": "Porsche",
    "models": [
      { "name": "911", "size": "M" },
      { "name": "718 Cayman", "size": "M" },
      { "name": "718 Boxster", "size": "M" },
      { "name": "Taycan", "size": "L" },
      { "name": "Panamera", "size": "L" },
      { "name": "Macan", "size": "L" },
      { "name": "Cayenne", "size": "L" },
      { "name": "Cayman", "size": "M" },
      { "name": "Boxster", "size": "M" }
    ]
  },
  {
    "brand": "Renault",
    "models": [
      { "name": "Twingo", "size": "S" },
      { "name": "Clio", "size": "S" },
      { "name": "Megane", "size": "M" },
      { "name": "Megane E-Tech", "size": "M" },
      { "name": "Scenic", "size": "L" },
      { "name": "Scenic E-Tech", "size": "L" },
      { "name": "Talisman", "size": "L" },
      { "name": "Captur", "size": "M" },
      { "name": "Kadjar", "size": "L" },
      { "name": "Austral", "size": "L" },
      { "name": "Koleos", "size": "L" },
      { "name": "Espace", "size": "L" },
      { "name": "Arkana", "size": "L" },
      { "name": "ZOE", "size": "S" },
      { "name": "Kangoo", "size": "L" },
      { "name": "Kangoo E-Tech", "size": "L" },
      { "name": "Express", "size": "L" },
      { "name": "Trafic", "size": "L" },
      { "name": "Master", "size": "L" },
      { "name": "Fluence", "size": "M" },
      { "name": "Laguna", "size": "L" },
      { "name": "Latitude", "size": "L" },
      { "name": "Modus", "size": "S" },
      { "name": "Twizy", "size": "S" },
      { "name": "Rafale", "size": "L" }
    ]
  },
  {
    "brand": "SEAT",
    "models": [
      { "name": "Mii", "size": "S" },
      { "name": "Ibiza", "size": "S" },
      { "name": "Leon", "size": "M" },
      { "name": "Arona", "size": "M" },
      { "name": "Ateca", "size": "L" },
      { "name": "Tarraco", "size": "L" },
      { "name": "Alhambra", "size": "L" },
      { "name": "Toledo", "size": "M" },
      { "name": "Exeo", "size": "M" },
      { "name": "Altea", "size": "M" }
    ]
  },
  {
    "brand": "Škoda",
    "models": [
      { "name": "Citigo", "size": "S" },
      { "name": "Fabia", "size": "S" },
      { "name": "Scala", "size": "M" },
      { "name": "Rapid", "size": "M" },
      { "name": "Octavia", "size": "M" },
      { "name": "Superb", "size": "L" },
      { "name": "Kamiq", "size": "M" },
      { "name": "Karoq", "size": "L" },
      { "name": "Kodiaq", "size": "L" },
      { "name": "Enyaq", "size": "L" },
      { "name": "Enyaq Coupe", "size": "L" },
      { "name": "Yeti", "size": "M" },
      { "name": "Roomster", "size": "M" },
      { "name": "Elroq", "size": "L" }
    ]
  },
  {
    "brand": "Subaru",
    "models": [
      { "name": "Impreza", "size": "M" },
      { "name": "Legacy", "size": "L" },
      { "name": "Outback", "size": "L" },
      { "name": "Forester", "size": "L" },
      { "name": "XV", "size": "M" },
      { "name": "Crosstrek", "size": "M" },
      { "name": "BRZ", "size": "M" },
      { "name": "WRX", "size": "M" },
      { "name": "Levorg", "size": "L" },
      { "name": "Solterra", "size": "L" },
      { "name": "Tribeca", "size": "L" }
    ]
  },
  {
    "brand": "Suzuki",
    "models": [
      { "name": "Ignis", "size": "S" },
      { "name": "Swift", "size": "S" },
      { "name": "Baleno", "size": "S" },
      { "name": "S-Cross", "size": "M" },
      { "name": "SX4", "size": "M" },
      { "name": "SX4 S-Cross", "size": "M" },
      { "name": "Vitara", "size": "M" },
      { "name": "Jimny", "size": "S" },
      { "name": "Swace", "size": "M" },
      { "name": "Across", "size": "L" },
      { "name": "Celerio", "size": "S" },
      { "name": "Alto", "size": "S" },
      { "name": "Splash", "size": "S" },
      { "name": "Grand Vitara", "size": "L" },
      { "name": "Kizashi", "size": "M" }
    ]
  },
  {
    "brand": "Tesla",
    "models": [
      { "name": "Model 3", "size": "M" },
      { "name": "Model S", "size": "L" },
      { "name": "Model X", "size": "L" },
      { "name": "Model Y", "size": "L" },
      { "name": "Cybertruck", "size": "L" },
      { "name": "Roadster", "size": "M" }
    ]
  },
  {
    "brand": "Toyota",
    "models": [
      { "name": "Aygo", "size": "S" },
      { "name": "Aygo X", "size": "S" },
      { "name": "Yaris", "size": "S" },
      { "name": "Yaris Cross", "size": "M" },
      { "name": "GR Yaris", "size": "S" },
      { "name": "Corolla", "size": "M" },
      { "name": "Corolla Cross", "size": "L" },
      { "name": "GR Corolla", "size": "M" },
      { "name": "Camry", "size": "L" },
      { "name": "C-HR", "size": "M" },
      { "name": "RAV4", "size": "L" },
      { "name": "Highlander", "size": "L" },
      { "name": "Land Cruiser", "size": "L" },
      { "name": "Land Cruiser 300", "size": "L" },
      { "name": "bZ4X", "size": "L" },
      { "name": "Prius", "size": "M" },
      { "name": "Mirai", "size": "L" },
      { "name": "GR86", "size": "M" },
      { "name": "Supra", "size": "M" },
      { "name": "Proace", "size": "L" },
      { "name": "Proace City", "size": "L" },
      { "name": "Proace Verso", "size": "L" },
      { "name": "Hilux", "size": "L" },
      { "name": "Auris", "size": "M" },
      { "name": "Avensis", "size": "L" },
      { "name": "Verso", "size": "L" },
      { "name": "GT86", "size": "M" },
      { "name": "IQ", "size": "S" },
      { "name": "Urban Cruiser", "size": "S" }
    ]
  },
  {
    "brand": "Volkswagen",
    "models": [
      { "name": "up!", "size": "S" },
      { "name": "e-up!", "size": "S" },
      { "name": "Polo", "size": "S" },
      { "name": "Golf", "size": "M" },
      { "name": "Golf Variant", "size": "M" },
      { "name": "Golf Sportsvan", "size": "M" },
      { "name": "ID.3", "size": "M" },
      { "name": "ID.4", "size": "L" },
      { "name": "ID.5", "size": "L" },
      { "name": "ID.7", "size": "L" },
      { "name": "ID. Buzz", "size": "L" },
      { "name": "Passat", "size": "L" },
      { "name": "Passat Variant", "size": "L" },
      { "name": "Arteon", "size": "L" },
      { "name": "Arteon Shooting Brake", "size": "L" },
      { "name": "T-Cross", "size": "M" },
      { "name": "T-Roc", "size": "M" },
      { "name": "Taigo", "size": "M" },
      { "name": "Tiguan", "size": "L" },
      { "name": "Tiguan Allspace", "size": "L" },
      { "name": "Touareg", "size": "L" },
      { "name": "Touran", "size": "L" },
      { "name": "Sharan", "size": "L" },
      { "name": "Caddy", "size": "L" },
      { "name": "Transporter", "size": "L" },
      { "name": "Multivan", "size": "L" },
      { "name": "Caravelle", "size": "L" },
      { "name": "California", "size": "L" },
      { "name": "Crafter", "size": "L" },
      { "name": "Amarok", "size": "L" },
      { "name": "Scirocco", "size": "M" },
      { "name": "Beetle", "size": "M" },
      { "name": "CC", "size": "L" },
      { "name": "Eos", "size": "M" },
      { "name": "Jetta", "size": "M" },
      { "name": "Phaeton", "size": "L" },
      { "name": "Golf GTI", "size": "M" },
      { "name": "Golf R", "size": "M" },
      { "name": "Golf GTD", "size": "M" },
      { "name": "Golf GTE", "size": "M" }
    ]
  },
  {
    "brand": "Volvo",
    "models": [
      { "name": "XC40", "size": "M" },
      { "name": "XC40 Recharge", "size": "M" },
      { "name": "C40 Recharge", "size": "M" },
      { "name": "XC60", "size": "L" },
      { "name": "XC90", "size": "L" },
      { "name": "EX30", "size": "M" },
      { "name": "EX90", "size": "L" },
      { "name": "S60", "size": "L" },
      { "name": "S90", "size": "L" },
      { "name": "V40", "size": "M" },
      { "name": "V60", "size": "L" },
      { "name": "V60 Cross Country", "size": "L" },
      { "name": "V90", "size": "L" },
      { "name": "V90 Cross Country", "size": "L" },
      { "name": "C30", "size": "S" },
      { "name": "S40", "size": "M" },
      { "name": "V50", "size": "M" },
      { "name": "V70", "size": "L" },
      { "name": "XC70", "size": "L" }
    ]
  }
];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Flatten all models
    const models: { brand: string; name: string; size: string }[] = [];
    let sortOrder = 0;
    
    for (const brandData of carsListData) {
      for (const model of brandData.models) {
        models.push({
          brand: brandData.brand,
          name: model.name,
          size: model.size,
        });
        sortOrder++;
      }
    }

    console.log(`Seeding ${models.length} car models...`);

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < models.length; i += batchSize) {
      const batch = models.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('car_models')
        .upsert(batch, { 
          onConflict: 'brand,name',
          ignoreDuplicates: true 
        })
        .select();

      if (error) {
        console.error('Batch insert error:', error);
        throw error;
      }

      inserted += data?.length || 0;
    }

    skipped = models.length - inserted;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Seeded ${inserted} car models (${skipped} already existed)`,
        total: models.length,
        inserted,
        skipped
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error seeding car models:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
